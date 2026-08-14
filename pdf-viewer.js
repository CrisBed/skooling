// Lettore PDF basato sulla copia locale di PDF.js.
import * as pdfjsLib from './vendor/pdf.mjs';
import { DB } from './db.js';
import { DrawingSurface, attachToolbox } from './strumenti.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.mjs';

function waitFrame() { return new Promise((resolve) => requestAnimationFrame(resolve)); }

export async function extractPdfCover(blob) {
  const task = pdfjsLib.getDocument({ data: await blob.arrayBuffer() });
  const pdf = await task.promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1, 360 / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78));
  } finally {
    await task.destroy();
  }
}

class Reader {
  constructor() {
    this.root = document.querySelector('#lettore-pdf');
    this.canvas = document.querySelector('#pdf-canvas');
    this.annotationCanvas = document.querySelector('#pdf-annotations');
    this.pageWrap = document.querySelector('#pdf-page-wrap');
    this.scroll = document.querySelector('#pdf-scroll');
    this.loading = document.querySelector('#reader-loading');
    this.pageNumberInput = document.querySelector('#page-number');
    this.pdf = null;
    this.book = null;
    this.pageNumber = 1;
    this.zoom = 1;
    this.renderTask = null;
    this.thumbnailObserver = null;
    this.pinch = null;
    this.lastTap = 0;
    this.annotationSaveToken = 0;
    this.drawing = new DrawingSurface(this.annotationCanvas, {
      onChange: (elements) => this.saveAnnotations(elements),
      onTouchGesture: (phase, event, pointers) => this.handleTouchGesture(phase, event, pointers),
    });
    attachToolbox(document.querySelector('#reader-tools'), this.drawing);
    this.bind();
  }

  bind() {
    document.querySelector('#close-reader').addEventListener('click', () => this.close());
    document.querySelector('#prev-page').addEventListener('click', () => this.goTo(this.pageNumber - 1));
    document.querySelector('#next-page').addEventListener('click', () => this.goTo(this.pageNumber + 1));
    this.pageNumberInput.addEventListener('change', () => this.goTo(Number(this.pageNumberInput.value)));
    document.querySelector('#fit-page').addEventListener('click', () => this.setZoom(1));
    document.querySelector('#toggle-thumbnails').addEventListener('click', (event) => {
      const panel = document.querySelector('#thumbnail-panel');
      panel.hidden = !panel.hidden;
      event.currentTarget.classList.toggle('active', !panel.hidden);
      if (!panel.hidden) this.observeThumbnails();
    });
    document.querySelector('#toggle-reader-tools').addEventListener('click', (event) => {
      const tools = document.querySelector('#reader-tools');
      tools.hidden = !tools.hidden;
      event.currentTarget.classList.toggle('active', !tools.hidden);
    });
    document.querySelector('#toggle-night').addEventListener('click', (event) => {
      this.pageWrap.classList.toggle('night');
      event.currentTarget.classList.toggle('active');
    });
    document.querySelector('#toggle-bookmark').addEventListener('click', () => this.toggleBookmark());
    this.scroll.addEventListener('dblclick', () => this.setZoom(1));
    window.addEventListener('keydown', (event) => {
      if (this.root.hidden) return;
      if (event.key === 'ArrowLeft') this.goTo(this.pageNumber - 1);
      if (event.key === 'ArrowRight') this.goTo(this.pageNumber + 1);
    });
    let resizeTimer;
    window.addEventListener('resize', () => {
      if (this.root.hidden || !this.pdf) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.renderPage(), 180);
    });
  }

  async open(bookId, page) {
    this.book = await DB.get('libri', bookId);
    if (!this.book) throw new Error('Questo libro non è più nella libreria.');
    this.root.hidden = false;
    document.body.classList.add('workspace-open');
    document.querySelector('#reader-title').textContent = this.book.titolo;
    document.querySelector('#reader-subject').textContent = this.book.materia;
    this.loading.hidden = false;
    try {
      const task = pdfjsLib.getDocument({ data: await this.book.blob.arrayBuffer() });
      this.pdf = await task.promise;
      this.pageNumber = Math.max(1, Math.min(Number(page || this.book.ultimaPagina || 1), this.pdf.numPages));
      this.pageNumberInput.max = this.pdf.numPages;
      document.querySelector('#page-total').textContent = `di ${this.pdf.numPages}`;
      this.buildThumbnails();
      await this.renderPage();
    } catch (error) {
      this.close();
      throw new Error('Non riesco ad aprire questo PDF. Prova a importarlo di nuovo.');
    } finally {
      this.loading.hidden = true;
    }
  }

  async close() {
    this.renderTask?.cancel?.();
    await this.pdf?.destroy?.().catch(() => {});
    this.pdf = null;
    this.book = null;
    this.drawing.setElements([]);
    this.root.hidden = true;
    document.body.classList.remove('workspace-open');
    document.dispatchEvent(new CustomEvent('skooling:reader-closed'));
  }

  async goTo(number) {
    if (!this.pdf) return;
    const next = Math.max(1, Math.min(this.pdf.numPages, Math.round(number || 1)));
    if (next === this.pageNumber && this.canvas.width) return;
    this.pageNumber = next;
    this.zoom = 1;
    await this.renderPage();
  }

  async renderPage() {
    if (!this.pdf) return;
    this.loading.hidden = false;
    this.renderTask?.cancel?.();
    try {
      const page = await this.pdf.getPage(this.pageNumber);
      const base = page.getViewport({ scale: 1 });
      const available = Math.max(280, this.scroll.clientWidth - 56);
      const fitScale = available / base.width;
      const ratio = Math.min(2, devicePixelRatio || 1);
      const viewport = page.getViewport({ scale: fitScale * this.zoom * ratio });
      const cssWidth = viewport.width / ratio;
      const cssHeight = viewport.height / ratio;
      this.canvas.width = Math.ceil(viewport.width);
      this.canvas.height = Math.ceil(viewport.height);
      this.canvas.style.width = `${cssWidth}px`;
      this.canvas.style.height = `${cssHeight}px`;
      this.pageWrap.style.width = `${cssWidth}px`;
      this.pageWrap.style.height = `${cssHeight}px`;
      this.pageWrap.style.transform = '';
      this.renderTask = page.render({ canvasContext: this.canvas.getContext('2d'), viewport });
      await this.renderTask.promise;
      const allAnnotations = await DB.getAll('annotazioni');
      const annotations = allAnnotations.filter((item) => item.idLibro === this.book.id && item.pagina === this.pageNumber);
      this.drawing.setElements(annotations);
      this.annotationCanvas.classList.toggle('finger-draw', this.drawing.drawWithFinger);
      this.pageNumberInput.value = this.pageNumber;
      document.querySelector('#zoom-label').textContent = `${Math.round(this.zoom * 100)}%`;
      this.updateThumbnailSelection();
      await DB.put('libri', { ...this.book, ultimaPagina: this.pageNumber });
      this.book.ultimaPagina = this.pageNumber;
      this.updateBookmarkButton();
      for (const nearby of [this.pageNumber - 1, this.pageNumber + 1]) {
        if (nearby >= 1 && nearby <= this.pdf.numPages) this.pdf.getPage(nearby).catch(() => {});
      }
      this.scroll.scrollTo({ top: 0, left: 0 });
    } catch (error) {
      if (error?.name !== 'RenderingCancelledException') {
        document.dispatchEvent(new CustomEvent('skooling:message', { detail: { text: 'La pagina non si è caricata. Riprova.', error: true } }));
      }
    } finally {
      this.loading.hidden = true;
    }
  }

  async setZoom(value) {
    this.zoom = Math.max(0.75, Math.min(3.5, value));
    await this.renderPage();
  }

  handleTouchGesture(phase, event, pointers) {
    if (phase === 'start' && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      this.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom, preview: this.zoom };
    } else if (phase === 'move' && this.pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      this.pinch.preview = Math.max(0.75, Math.min(3.5, this.pinch.zoom * distance / Math.max(0.01, this.pinch.distance)));
      this.pageWrap.style.transform = `scale(${this.pinch.preview / this.zoom})`;
    } else if (phase === 'end' && this.pinch) {
      const preview = this.pinch.preview;
      this.pinch = null;
      this.setZoom(preview);
    } else if (phase === 'end' && event.pointerType === 'touch') {
      const now = Date.now();
      if (now - this.lastTap < 320) this.setZoom(1);
      this.lastTap = now;
    }
  }

  async saveAnnotations(elements) {
    if (!this.book || !this.pdf) return;
    const token = ++this.annotationSaveToken;
    const bookId = this.book.id;
    const page = this.pageNumber;
    await waitFrame();
    if (token !== this.annotationSaveToken) return;
    await DB.deleteWhere('annotazioni', (item) => item.idLibro === bookId && item.pagina === page);
    await DB.putMany('annotazioni', elements.map((item) => ({ ...item, idLibro: bookId, pagina: page })));
  }

  buildThumbnails() {
    const list = document.querySelector('#thumbnail-list');
    list.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (let page = 1; page <= this.pdf.numPages; page += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'thumbnail';
      button.dataset.page = String(page);
      button.innerHTML = `<canvas width="120" height="150" aria-hidden="true"></canvas><span>Pagina ${page}</span>`;
      button.addEventListener('click', () => this.goTo(page));
      fragment.append(button);
    }
    list.append(fragment);
    this.thumbnailObserver?.disconnect();
    this.thumbnailObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) this.renderThumbnail(entry.target);
    }, { root: document.querySelector('#thumbnail-panel'), rootMargin: '160px' });
    this.observeThumbnails();
  }

  observeThumbnails() {
    document.querySelectorAll('.thumbnail:not([data-rendered])').forEach((item) => this.thumbnailObserver?.observe(item));
  }

  async renderThumbnail(button) {
    if (button.dataset.rendered || !this.pdf) return;
    button.dataset.rendered = 'loading';
    try {
      const page = await this.pdf.getPage(Number(button.dataset.page));
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 120 / base.width });
      const canvas = button.querySelector('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      button.dataset.rendered = 'true';
      this.thumbnailObserver?.unobserve(button);
    } catch {
      delete button.dataset.rendered;
    }
  }

  updateThumbnailSelection() {
    document.querySelectorAll('.thumbnail').forEach((item) => item.classList.toggle('active', Number(item.dataset.page) === this.pageNumber));
  }

  async bookmarks() {
    return (await DB.getAll('segnalibri')).filter((item) => item.idLibro === this.book.id);
  }

  async updateBookmarkButton() {
    const active = (await this.bookmarks()).some((item) => item.pagina === this.pageNumber);
    const button = document.querySelector('#toggle-bookmark');
    button.classList.toggle('active', active);
    button.textContent = active ? '★' : '☆';
    button.setAttribute('aria-label', active ? 'Rimuovi segnalibro' : 'Aggiungi segnalibro');
  }

  async toggleBookmark() {
    const bookmark = (await this.bookmarks()).find((item) => item.pagina === this.pageNumber);
    if (bookmark) await DB.delete('segnalibri', bookmark.id);
    else await DB.put('segnalibri', { id: `bookmark-${this.book.id}-${this.pageNumber}`, idLibro: this.book.id, pagina: this.pageNumber, timestamp: Date.now() });
    await this.updateBookmarkButton();
  }
}

export const PDFViewer = new Reader();
