// Gestione dei quaderni e delle loro pagine vettoriali.
import { DB, createId } from './db.js';
import { SEGNI_MUSICALI, disegnaSegnoMusicale, fontePronta } from './musica.js';
import { DrawingSurface, SurfaceGroup, attachToolbox, disegnaElementi, canvasToJpeg, makePdfFromJpegs, downloadBlob, creaGestoCondiviso, creaRilevatoreSwipe, ditaAppoggiate } from './strumenti.js';

function safeFilename(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'quaderno';
}

// I tipi di foglio: il nome che si salva nel quaderno e la classe che lo
// disegna a schermo. Aggiungerne uno vuol dire toccare questa tabella, il CSS
// e il disegno per l'esportazione qui sotto.
export const TIPI_FOGLIO = {
  righe: 'lined',
  quadretti: 'squared',
  bianco: 'blank',
  pentagramma: 'staff',
  millimetrato: 'graph',
};

// Misure del pentagramma, identiche a quelle del CSS: se cambiano li', vanno
// cambiate anche qui, altrimenti i simboli non cadono piu' sulle righe.
export const RIGO = { passoRiga: 16, passoRigo: 150, primaRiga: 15 };

// Porta una quota verticale sulla riga o sullo spazio piu' vicini. E' quel che
// fa la mano quando si scrive musica: le note non stanno a mezz'aria.
export function agganciaAlRigo(yNormalizzato, altezzaFoglio) {
  if (!altezzaFoglio) return yNormalizzato;
  const y = yNormalizzato * altezzaFoglio;
  const dentroRigo = ((y - RIGO.primaRiga) % RIGO.passoRigo + RIGO.passoRigo) % RIGO.passoRigo;
  const inizio = y - dentroRigo;
  // mezzo passo: cosi' si aggancia sia alle righe sia agli spazi in mezzo
  const mezzi = Math.round(dentroRigo / (RIGO.passoRiga / 2));
  // oltre il rigo (sopra la prima riga o sotto la quinta) si resta liberi
  if (mezzi < -2 || mezzi > 10) return yNormalizzato;
  return (inizio + mezzi * (RIGO.passoRiga / 2)) / altezzaFoglio;
}

function riga(context, x1, y1, x2, y2) {
  context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke();
}

// Ridisegna il foglio per l'esportazione in PNG e PDF: a schermo lo fa il CSS,
// qui va rifatto col pennello perche' l'immagine esca uguale a quel che si vede.
export function drawPaper(context, type, width, height) {
  context.fillStyle = '#fffefa';
  context.fillRect(0, 0, width, height);
  if (type === 'bianco') return;

  // Le misure a schermo sono pensate per un foglio largo 780: qui il foglio e'
  // piu' grande, quindi le guide si allargano nella stessa proporzione.
  const scala = width / 780;

  if (type === 'pentagramma') {
    context.strokeStyle = '#5b6472';
    context.lineWidth = Math.max(1, 1.4 * scala);
    const passoRiga = RIGO.passoRiga * scala;   // fra le cinque righe di un rigo
    const passoRigo = RIGO.passoRigo * scala;  // fra un rigo e quello dopo
    for (let alto = RIGO.primaRiga * scala; alto + passoRiga * 4 < height; alto += passoRigo) {
      for (let indice = 0; indice < 5; indice += 1) {
        riga(context, 0, alto + indice * passoRiga, width, alto + indice * passoRiga);
      }
    }
    return;
  }

  if (type === 'millimetrato') {
    const fine = 4 * scala;
    context.lineWidth = Math.max(0.5, 0.8 * scala);
    context.strokeStyle = '#dcebe1';
    for (let y = fine; y < height; y += fine) riga(context, 0, y, width, y);
    for (let x = fine; x < width; x += fine) riga(context, x, 0, x, height);
    context.lineWidth = Math.max(1, 1.4 * scala);
    context.strokeStyle = '#9cc4a8';
    for (let y = fine * 5; y < height; y += fine * 5) riga(context, 0, y, width, y);
    for (let x = fine * 5; x < width; x += fine * 5) riga(context, x, 0, x, height);
    return;
  }

  context.strokeStyle = '#c9d9f2';
  context.lineWidth = 2;
  const spacing = type === 'quadretti' ? 36 : 46;
  for (let y = spacing; y < height; y += spacing) riga(context, 0, y, width, y);
  if (type === 'quadretti') {
    for (let x = spacing; x < width; x += spacing) riga(context, x, 0, x, height);
  }
  context.strokeStyle = '#ef9b9b';
  riga(context, width * 0.08, 0, width * 0.08, height);
}

export class NotebookManager {
  constructor(options = {}) {
    this.notify = options.notify || (() => {});
    this.showProgress = options.showProgress || (() => {});
    this.hideProgress = options.hideProgress || (() => {});
    this.current = null;
    this.pages = [];
    this.pageIndex = 0;
    this.doppia = false;
    this.saveToken = 0;
    this.saveToken2 = 0;
    this.canvas = document.querySelector('#notebook-canvas');
    this.canvas2 = document.querySelector('#notebook-canvas-2');
    // Zoom del quaderno: un dito scrive, due dita ingrandiscono e spostano.
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.pinch = null;
    // Sfioramento orizzontale: cambia pagina senza toccare le frecce.
    this.swipe = creaRilevatoreSwipe();
    this.ultimoPunto = null;
    this.schermoPieno = false;
    this.astuccioAperto = false;
    // Un solo gesto per tutti e due i fogli: le due dita possono cadere su fogli diversi.
    const gesto = creaGestoCondiviso();
    const gestoDueDita = (fase, event, touches) => this.gestoDueDita(fase, touches);
    // due fogli: sinistro (offset 0) e destro (offset 1). onChange salva la pagina giusta.
    // Sul pentagramma i simboli si incollano alla riga piu' vicina.
    const aggancia = (canvas) => (y) => (this.current?.tipo === 'pentagramma'
      ? agganciaAlRigo(y, canvas.offsetHeight)
      : y);
    // Il segno musicale e' alto quanto il passo del rigo, ne' piu' ne' meno.
    const unita = (canvas) => () => (canvas.offsetHeight ? RIGO.passoRiga / canvas.offsetHeight : 0.016);
    this.surface = new DrawingSurface(this.canvas, { gesto, onChange: (elements) => this.savePage(0, elements), onTouchGesture: gestoDueDita, agganciaY: aggancia(this.canvas), unitaMusicale: unita(this.canvas) });
    this.surface2 = new DrawingSurface(this.canvas2, { gesto, onChange: (elements) => this.savePage(1, elements), onTouchGesture: gestoDueDita, agganciaY: aggancia(this.canvas2), unitaMusicale: unita(this.canvas2) });
    // un unico astuccio comanda entrambi i fogli (attivo = l'ultimo toccato)
    this.group = new SurfaceGroup([this.surface, this.surface2]);
    attachToolbox(document.querySelector('#notebook-tools'), this.group);
    this.bind();
  }

  // Costruisce la tavolozza dei simboli, ognuno disegnato davvero com'e': un
  // elenco di nomi non direbbe niente a chi cerca la nota che gli serve.
  costruisciTavolozzaMusicale() {
    const griglia = document.querySelector('#notebook-music-grid');
    if (griglia.childElementCount) return;
    for (const segno of SEGNI_MUSICALI) {
      const bottone = document.createElement('button');
      bottone.type = 'button';
      bottone.dataset.segno = segno.chiave;
      bottone.title = segno.nome;
      bottone.setAttribute('aria-label', segno.nome);
      const anteprima = document.createElement('canvas');
      anteprima.width = 68; anteprima.height = 92;
      const pennello = anteprima.getContext('2d');
      // una riga di rigo dietro al segno: senza, le due pause si somigliano
      pennello.strokeStyle = '#c3ccdb';
      pennello.lineWidth = 1;
      pennello.beginPath(); pennello.moveTo(4, 50.5); pennello.lineTo(64, 50.5); pennello.stroke();
      disegnaSegnoMusicale(pennello, segno.chiave, 34, 50, 9, '#1f2937');
      bottone.append(anteprima);
      bottone.addEventListener('click', () => this.scegliSegno(segno.chiave));
      griglia.append(bottone);
    }
  }

  scegliSegno(chiave) {
    this.group.setSegnoMusicale(chiave);
    this.group.setTool('simbolo');
    document.querySelectorAll('#notebook-music-grid button').forEach((b) => b.classList.toggle('active', b.dataset.segno === chiave));
    // nell'astuccio nessuno strumento resta acceso: comanda la tavolozza
    document.querySelectorAll('#notebook-tools [data-tool]').forEach((b) => b.classList.remove('active'));
  }

  // La tavolozza si vede solo dove serve: su un quaderno a pentagramma.
  aggiornaTavolozzaMusicale() {
    const pannello = document.querySelector('#notebook-music');
    const musicale = this.current?.tipo === 'pentagramma';
    pannello.hidden = !musicale;
    if (musicale) this.costruisciTavolozzaMusicale();
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
      if (!title || !subject || !TIPI_FOGLIO[type]) return;
      const notebook = { id: createId('quaderno'), titolo: title, materia: subject, tipo: type, data: Date.now(), pagine: 1 };
      const page = { id: createId('pagina'), idQuaderno: notebook.id, numero: 1, elementi: [], data: Date.now() };
      await DB.put('quaderni', notebook);
      await DB.put('paginequaderno', page);
      document.querySelector('#notebook-dialog').close();
      await this.renderList();
      await this.open(notebook.id, 1);
    });
    document.querySelector('#close-notebook').addEventListener('click', () => this.close());
    document.querySelector('#notebook-prev').addEventListener('click', () => this.goTo(this.pageIndex - (this.doppia ? 2 : 1)));
    document.querySelector('#notebook-next').addEventListener('click', () => this.goTo(this.pageIndex + (this.doppia ? 2 : 1)));
    document.querySelector('#notebook-two-pages').addEventListener('click', () => this.toggleDoppia());
    document.querySelector('#notebook-add-page').addEventListener('click', () => this.addPage());
    document.querySelector('#notebook-delete-page').addEventListener('click', () => this.deletePage());
    document.querySelector('#export-notebook-page').addEventListener('click', () => this.exportPage());
    document.querySelector('#export-notebook-pdf').addEventListener('click', () => this.exportPdf());
    document.querySelector('#notebook-tools').addEventListener('click', (event) => {
      if (event.target.closest('[data-tool]')) {
        document.querySelectorAll('#notebook-music-grid button').forEach((b) => b.classList.remove('active'));
      }
    });
    document.querySelector('#notebook-fullscreen').addEventListener('click', () => this.setSchermoPieno(!this.schermoPieno));
    document.querySelector('#notebook-exit-fullscreen').addEventListener('click', () => this.setSchermoPieno(false));
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
    this.azzeraZoom();
    this.aggiornaTavolozzaMusicale();
    this.showPage();
    // Finché il font di notazione non è caricato i simboli non si disegnano:
    // appena è pronto si ripassa la pagina.
    if (this.current.tipo === 'pentagramma') fontePronta().then(() => { if (this.current) this.showPage(); });
  }

  close() {
    this.azzeraZoom();
    // Il quaderno successivo si apre con le barre in vista: chi riapre deve
    // ritrovare il pulsante per chiudere, non un foglio senza comandi.
    this.setSchermoPieno(false);
    this.swipe.annulla();
    document.querySelector('#editor-quaderno').hidden = true;
    document.body.classList.remove('workspace-open');
    this.current = null;
    this.pages = [];
    this.surface.setElements([]);
    this.surface2.setElements([]);
    this.renderList();
    document.dispatchEvent(new CustomEvent('skooling:quaderno-chiuso'));
  }

  // ---- Zoom a due dita -----------------------------------------------------
  // Il riquadro dei fogli si ingrandisce con una trasformazione CSS. I canvas
  // restano gli stessi: le coordinate del disegno sono relative al foglio
  // visibile, quindi si continua a scrivere nel punto giusto anche ingranditi.
  gestoDueDita(fase, touches) {
    const box = document.querySelector('#notebook-pages');
    const dita = ditaAppoggiate(touches);
    if (fase === 'start') {
      this.swipe.inizio(touches);
      this.ultimoPunto = null;
      if (dita.length < 2) return;
      const [primo, secondo] = dita;
      const rect = box.getBoundingClientRect();
      this.pinch = {
        distanza: Math.hypot(primo.x - secondo.x, primo.y - secondo.y) || 1,
        zoom: this.zoom,
        panX: this.panX,
        panY: this.panY,
        // angolo del riquadro senza trasformazione (l'origine è in alto a sinistra)
        originX: rect.left - this.panX,
        originY: rect.top - this.panY,
        mediaX: (primo.x + secondo.x) / 2,
        mediaY: (primo.y + secondo.y) / 2,
      };
      return;
    }
    if (fase === 'move') {
      this.swipe.muovi(touches);
      // Un dito solo che non scrive scorre il foglio, come nel libro. Serve in
      // sola lettura: al foglio i gesti li governa l'app, non il browser.
      if (dita.length === 1 && !this.pinch) this.scorriFoglio(touches);
    }
    if (fase === 'move' && this.pinch && dita.length >= 2) {
      const [primo, secondo] = dita;
      const distanza = Math.hypot(primo.x - secondo.x, primo.y - secondo.y) || 1;
      const zoom = Math.max(1, Math.min(4, this.pinch.zoom * distanza / this.pinch.distanza));
      const mediaX = (primo.x + secondo.x) / 2;
      const mediaY = (primo.y + secondo.y) / 2;
      // il punto del foglio che stava sotto le due dita ci resta anche dopo
      const puntoX = (this.pinch.mediaX - this.pinch.originX - this.pinch.panX) / this.pinch.zoom;
      const puntoY = (this.pinch.mediaY - this.pinch.originY - this.pinch.panY) / this.pinch.zoom;
      this.applicaZoom(zoom, mediaX - this.pinch.originX - zoom * puntoX, mediaY - this.pinch.originY - zoom * puntoY);
      return;
    }
    if (fase !== 'end') return;
    this.pinch = null;
    this.ultimoPunto = null;
    // A foglio ingrandito le dita servono a spostare e a ridurre: si cambia
    // pagina soltanto quando il foglio è alla sua misura naturale.
    const direzione = this.zoom <= 1.01 ? this.swipe.fine(touches) : (this.swipe.annulla(), 0);
    if (direzione) this.goTo(this.pageIndex + direzione * (this.doppia ? 2 : 1));
  }

  // Vista a schermo intero: restano soltanto i fogli, senza barra in alto,
  // controlli in basso e astuccio. Si esce col pulsante che resta in un angolo
  // oppure toccando di nuovo il pulsante nella barra.
  setSchermoPieno(attivo) {
    this.schermoPieno = Boolean(attivo);
    document.querySelector('#editor-quaderno').classList.toggle('schermo-pieno', this.schermoPieno);
    const bottone = document.querySelector('#notebook-fullscreen');
    bottone.setAttribute('aria-pressed', String(this.schermoPieno));
    bottone.classList.toggle('active', this.schermoPieno);
    const astuccio = document.querySelector('#notebook-tools');
    const interruttore = document.querySelector('#toggle-notebook-tools');
    if (this.schermoPieno) {
      this.astuccioAperto = !astuccio.hidden;
      astuccio.hidden = true;
      interruttore.classList.remove('active');
    } else if (this.astuccioAperto) {
      astuccio.hidden = false;
      interruttore.classList.add('active');
    }
  }

  // Porta in giro il foglio col dito. Lo fa il codice perché al foglio i gesti
  // del browser sono vietati: senza, la penna scriverebbe mentre la pagina
  // scappa.
  scorriFoglio(touches) {
    const riquadro = document.querySelector('#editor-quaderno .page-scroll');
    const [punto] = [...touches.values()];
    if (!riquadro || !punto) return;
    if (this.ultimoPunto) {
      riquadro.scrollLeft -= punto.x - this.ultimoPunto.x;
      riquadro.scrollTop -= punto.y - this.ultimoPunto.y;
    }
    this.ultimoPunto = { x: punto.x, y: punto.y };
  }

  applicaZoom(zoom, panX, panY) {
    const box = document.querySelector('#notebook-pages');
    if (zoom <= 1.01) {
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
    } else {
      this.zoom = zoom;
      // lo spostamento non può portare il foglio fuori dal riquadro
      const limiteX = box.offsetWidth * (zoom - 1);
      const limiteY = box.offsetHeight * (zoom - 1);
      this.panX = Math.max(-limiteX, Math.min(0, panX));
      this.panY = Math.max(-limiteY, Math.min(0, panY));
    }
    box.style.transformOrigin = '0 0';
    box.style.transform = this.zoom === 1 ? '' : `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  azzeraZoom() {
    this.pinch = null;
    this.applicaZoom(1, 0, 0);
  }

  // Prepara un foglio (sfondo giusto, contenuto, dito che scrive, misura)
  mostraFoglio(wrap, canvas, surface, page) {
    for (const classe of Object.values(TIPI_FOGLIO)) wrap.classList.remove(classe);
    wrap.classList.add(TIPI_FOGLIO[this.current.tipo] || TIPI_FOGLIO.righe);
    surface.setElements(page ? (page.elementi || []) : []);
    // Nel quaderno si SCRIVE: il dito disegna sempre, senza bisogno della Pencil.
    surface.setDrawWithFinger(true);
    requestAnimationFrame(() => surface.resize());
  }

  showPage() {
    const totale = this.pages.length;
    document.querySelector('#notebook-pages').classList.toggle('doppia', this.doppia);

    // foglio sinistro (sempre)
    this.mostraFoglio(document.querySelector('#notebook-page-wrap'), this.canvas, this.surface, this.pages[this.pageIndex]);

    // foglio destro (solo in doppia e se esiste la pagina successiva)
    const wrap2 = document.querySelector('#notebook-page-wrap-2');
    const pagDx = this.doppia ? this.pages[this.pageIndex + 1] : null;
    wrap2.hidden = !pagDx;
    if (pagDx) this.mostraFoglio(wrap2, this.canvas2, this.surface2, pagDx);
    else this.surface2.setElements([]);

    // etichetta e navigazione
    const label = document.querySelector('#notebook-page-label');
    if (this.doppia) {
      const conDx = this.pageIndex + 1 < totale;
      label.textContent = `Pagine ${this.pageIndex + 1}${conDx ? '-' + (this.pageIndex + 2) : ''} di ${totale}`;
      document.querySelector('#notebook-prev').disabled = this.pageIndex === 0;
      document.querySelector('#notebook-next').disabled = this.pageIndex + 2 >= totale;
    } else {
      label.textContent = `Pagina ${this.pageIndex + 1} di ${totale}`;
      document.querySelector('#notebook-prev').disabled = this.pageIndex === 0;
      document.querySelector('#notebook-next').disabled = this.pageIndex === totale - 1;
    }
  }

  toggleDoppia() {
    this.doppia = !this.doppia;
    this.azzeraZoom(); // cambia l'impaginazione: si riparte dalla misura naturale
    // in doppia l'indice di sinistra è sempre pari (coppie 1-2, 3-4, ...)
    if (this.doppia) this.pageIndex -= this.pageIndex % 2;
    const btn = document.querySelector('#notebook-two-pages');
    btn.textContent = this.doppia ? '1 pagina' : '2 pagine';
    btn.setAttribute('aria-pressed', String(this.doppia));
    btn.classList.toggle('active', this.doppia);
    this.showPage();
  }

  goTo(index) {
    if (this.doppia) index -= index % 2;
    if (index < 0 || index >= this.pages.length) return;
    this.pageIndex = index;
    this.showPage();
  }

  async savePage(offset, elements) {
    if (!this.current) return;
    const page = this.pages[this.pageIndex + offset];
    if (!page) return;
    const key = offset === 0 ? 'saveToken' : 'saveToken2';
    const token = ++this[key];
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (token !== this[key]) return;
    page.elementi = elements;
    await DB.put('paginequaderno', page);
  }

  async addPage() {
    const page = { id: createId('pagina'), idQuaderno: this.current.id, numero: this.pages.length + 1, elementi: [], data: Date.now() };
    await DB.put('paginequaderno', page);
    this.pages.push(page);
    this.pageIndex = this.pages.length - 1;
    if (this.doppia) this.pageIndex -= this.pageIndex % 2;
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
    if (this.doppia) this.pageIndex -= this.pageIndex % 2;
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
    // Stessa posa che si vede a schermo, evidenziatori compresi: l'immagine
    // esportata deve somigliare al foglio, non essere disegnata in altro modo.
    disegnaElementi(context, page.elementi || [], canvas.width, canvas.height, { pulisci: false });
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
