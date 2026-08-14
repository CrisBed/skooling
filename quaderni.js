// Gestione dei quaderni e delle loro pagine vettoriali.
import { DB, createId } from './db.js';
import { DrawingSurface, attachToolbox, drawElement, canvasToJpeg, makePdfFromJpegs, downloadBlob } from './strumenti.js';

function safeFilename(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'quaderno';
}

function drawPaper(context, type, width, height) {
  context.fillStyle = '#fffefa';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#c9d9f2';
  context.lineWidth = 2;
  const spacing = type === 'quadretti' ? 36 : 46;
  for (let y = spacing; y < height; y += spacing) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }
  if (type === 'quadretti') {
    for (let x = spacing; x < width; x += spacing) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    }
  }
  context.strokeStyle = '#ef9b9b';
  context.beginPath(); context.moveTo(width * 0.08, 0); context.lineTo(width * 0.08, height); context.stroke();
}

export class NotebookManager {
  constructor(options = {}) {
    this.notify = options.notify || (() => {});
    this.showProgress = options.showProgress || (() => {});
    this.hideProgress = options.hideProgress || (() => {});
    this.current = null;
    this.pages = [];
    this.pageIndex = 0;
    this.saveToken = 0;
    this.canvas = document.querySelector('#notebook-canvas');
    this.surface = new DrawingSurface(this.canvas, { onChange: (elements) => this.savePage(elements) });
    attachToolbox(document.querySelector('#notebook-tools'), this.surface);
    this.bind();
  }

  bind() {
    document.querySelector('#new-notebook').addEventListener('click', () => {
      document.querySelector('#notebook-form').reset();
      document.querySelector('#notebook-dialog').showModal();
    });
    document.querySelector('#notebook-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = document.querySelector('#new-notebook-title').value.trim();
      const subject = document.querySelector('#new-notebook-subject').value.trim();
      const type = new FormData(event.currentTarget).get('paper-type');
      if (!title || !subject) return;
      const notebook = { id: createId('quaderno'), titolo: title, materia: subject, tipo: type, data: Date.now(), pagine: 1 };
      const page = { id: createId('pagina'), idQuaderno: notebook.id, numero: 1, elementi: [], data: Date.now() };
      await DB.put('quaderni', notebook);
      await DB.put('paginequaderno', page);
      document.querySelector('#notebook-dialog').close();
      await this.renderList();
      await this.open(notebook.id, 1);
    });
    document.querySelector('#close-notebook').addEventListener('click', () => this.close());
    document.querySelector('#notebook-prev').addEventListener('click', () => this.goTo(this.pageIndex - 1));
    document.querySelector('#notebook-next').addEventListener('click', () => this.goTo(this.pageIndex + 1));
    document.querySelector('#notebook-add-page').addEventListener('click', () => this.addPage());
    document.querySelector('#notebook-delete-page').addEventListener('click', () => this.deletePage());
    document.querySelector('#export-notebook-page').addEventListener('click', () => this.exportPage());
    document.querySelector('#export-notebook-pdf').addEventListener('click', () => this.exportPdf());
    document.querySelector('#toggle-notebook-tools').addEventListener('click', (event) => {
      const tools = document.querySelector('#notebook-tools');
      tools.hidden = !tools.hidden;
      event.currentTarget.classList.toggle('active', !tools.hidden);
    });
  }

  async renderList() {
    const notebooks = (await DB.getAll('quaderni')).sort((a, b) => b.data - a.data);
    const grid = document.querySelector('#notebook-grid');
    document.querySelector('#notebook-empty').hidden = notebooks.length > 0;
    grid.replaceChildren();
    for (const notebook of notebooks) {
      const card = document.createElement('article');
      card.className = 'notebook-card';
      card.innerHTML = `<button type="button" class="notebook-cover" aria-label="Apri ${escapeHtml(notebook.titolo)}"><span class="notebook-binding" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><strong>${escapeHtml(notebook.titolo)}</strong><span>${escapeHtml(notebook.materia)} · ${notebook.pagine} ${notebook.pagine === 1 ? 'pagina' : 'pagine'}</span></button><button type="button" class="card-menu" aria-label="Azioni quaderno">⋯</button><div class="card-actions" hidden><button type="button" data-open>Apri</button><button type="button" data-delete class="danger-text">Elimina</button></div>`;
      card.querySelector('.notebook-cover').addEventListener('click', () => this.open(notebook.id));
      card.querySelector('[data-open]').addEventListener('click', () => this.open(notebook.id));
      card.querySelector('.card-menu').addEventListener('click', () => { const menu = card.querySelector('.card-actions'); menu.hidden = !menu.hidden; });
      card.querySelector('[data-delete]').addEventListener('click', async () => {
        if (!confirm(`Eliminare il quaderno “${notebook.titolo}” e tutte le sue pagine?`)) return;
        await DB.delete('quaderni', notebook.id);
        await DB.deleteWhere('paginequaderno', (page) => page.idQuaderno === notebook.id);
        await this.renderList();
        this.notify('Quaderno eliminato.');
      });
      grid.append(card);
    }
  }

  async open(id, pageNumber = 1) {
    this.current = await DB.get('quaderni', id);
    if (!this.current) return this.notify('Questo quaderno non è più disponibile.', true);
    this.pages = (await DB.getAll('paginequaderno')).filter((page) => page.idQuaderno === id).sort((a, b) => a.numero - b.numero);
    if (!this.pages.length) {
      const page = { id: createId('pagina'), idQuaderno: id, numero: 1, elementi: [], data: Date.now() };
      await DB.put('paginequaderno', page);
      this.pages = [page];
    }
    this.pageIndex = Math.max(0, Math.min(this.pages.length - 1, Number(pageNumber) - 1));
    document.querySelector('#notebook-title').textContent = this.current.titolo;
    document.querySelector('#notebook-subject').textContent = this.current.materia;
    document.querySelector('#editor-quaderno').hidden = false;
    document.body.classList.add('workspace-open');
    this.showPage();
  }

  close() {
    document.querySelector('#editor-quaderno').hidden = true;
    document.body.classList.remove('workspace-open');
    this.current = null;
    this.pages = [];
    this.surface.setElements([]);
    this.renderList();
  }

  showPage() {
    const page = this.pages[this.pageIndex];
    const wrap = document.querySelector('#notebook-page-wrap');
    wrap.classList.toggle('lined', this.current.tipo === 'righe');
    wrap.classList.toggle('squared', this.current.tipo === 'quadretti');
    this.surface.setElements(page.elementi || []);
    // Nel quaderno si SCRIVE: il dito disegna sempre, senza bisogno della Pencil
    // né di attivare un'opzione. (Nei libri il dito resta per scorrere e leggere.)
    this.surface.setDrawWithFinger(true);
    this.canvas.classList.toggle('finger-draw', true);
    document.querySelector('#notebook-page-label').textContent = `Pagina ${this.pageIndex + 1} di ${this.pages.length}`;
    document.querySelector('#notebook-prev').disabled = this.pageIndex === 0;
    document.querySelector('#notebook-next').disabled = this.pageIndex === this.pages.length - 1;
    requestAnimationFrame(() => this.surface.resize());
  }

  goTo(index) {
    if (index < 0 || index >= this.pages.length) return;
    this.pageIndex = index;
    this.showPage();
  }

  async savePage(elements) {
    if (!this.current) return;
    const page = this.pages[this.pageIndex];
    const token = ++this.saveToken;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (token !== this.saveToken || !page) return;
    page.elementi = elements;
    await DB.put('paginequaderno', page);
  }

  async addPage() {
    const page = { id: createId('pagina'), idQuaderno: this.current.id, numero: this.pages.length + 1, elementi: [], data: Date.now() };
    await DB.put('paginequaderno', page);
    this.pages.push(page);
    this.pageIndex = this.pages.length - 1;
    this.current.pagine = this.pages.length;
    await DB.put('quaderni', this.current);
    this.showPage();
  }

  async deletePage() {
    if (this.pages.length === 1) return this.notify('Un quaderno deve avere almeno una pagina.');
    if (!confirm(`Eliminare la pagina ${this.pageIndex + 1}?`)) return;
    await DB.delete('paginequaderno', this.pages[this.pageIndex].id);
    this.pages.splice(this.pageIndex, 1);
    this.pageIndex = Math.min(this.pageIndex, this.pages.length - 1);
    for (let index = 0; index < this.pages.length; index += 1) {
      this.pages[index].numero = index + 1;
      await DB.put('paginequaderno', this.pages[index]);
    }
    this.current.pagine = this.pages.length;
    await DB.put('quaderni', this.current);
    this.showPage();
  }

  renderPageToCanvas(page) {
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    const context = canvas.getContext('2d');
    drawPaper(context, this.current.tipo, canvas.width, canvas.height);
    for (const element of page.elementi || []) drawElement(context, element, canvas.width, canvas.height);
    return canvas;
  }

  exportPage() {
    const canvas = this.renderPageToCanvas(this.pages[this.pageIndex]);
    canvas.toBlob((blob) => downloadBlob(blob, `${safeFilename(this.current.titolo)}-pagina-${this.pageIndex + 1}.png`), 'image/png');
  }

  async exportPdf() {
    this.showProgress('Creo il PDF del quaderno', 'Preparo le pagine…', 0);
    try {
      const images = [];
      for (let index = 0; index < this.pages.length; index += 1) {
        images.push(await canvasToJpeg(this.renderPageToCanvas(this.pages[index]), 0.9));
        this.showProgress('Creo il PDF del quaderno', `Pagina ${index + 1} di ${this.pages.length}`, (index + 1) / this.pages.length);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const bytes = makePdfFromJpegs(images);
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${safeFilename(this.current.titolo)}.pdf`);
      this.notify('PDF del quaderno pronto.');
    } finally {
      this.hideProgress();
    }
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}
