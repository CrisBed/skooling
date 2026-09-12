// Lettore PDF basato sulla copia locale di PDF.js.
import * as pdfjsLib from './vendor/pdf.mjs';
import { DB } from './db.js';
import { DrawingSurface, SurfaceGroup, attachToolbox, creaGestoCondiviso, creaRilevatoreSwipe, ditaAppoggiate } from './strumenti.js';

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
    this.pagesBox = document.querySelector('#pdf-pages');
    this.canvas = document.querySelector('#pdf-canvas');
    this.canvas2 = document.querySelector('#pdf-canvas-2');
    this.annotationCanvas = document.querySelector('#pdf-annotations');
    this.annotationCanvas2 = document.querySelector('#pdf-annotations-2');
    this.pageWrap = document.querySelector('#pdf-page-wrap');
    this.pageWrap2 = document.querySelector('#pdf-page-wrap-2');
    this.scroll = document.querySelector('#pdf-scroll');
    this.loading = document.querySelector('#reader-loading');
    this.pageNumberInput = document.querySelector('#page-number');
    this.pdf = null;
    this.book = null;
    this.pageNumber = 1;
    this.doppia = false;
    this.zoom = 1;
    this.renderTask = null;
    this.renderTask2 = null;
    this.thumbnailObserver = null;
    this.pinch = null;
    this.lastTap = 0;
    this.ultimoTocco = 0;
    this.annotationSaveToken = 0;
    this.annotationSaveToken2 = 0;
    // Un disegno di pagina alla volta. PDF.js rifiuta due render sullo stesso
    // canvas, quindi ogni richiesta aspetta che la precedente abbia finito di
    // liberarlo; il numero dice quale richiesta è l'ultima arrivata.
    this.renderCorsa = 0;
    this.renderInCoda = Promise.resolve();
    // Sfioramento orizzontale: cambia pagina senza toccare i pulsanti.
    this.swipe = creaRilevatoreSwipe();
    // Il foglio non lo scorre più il browser: lo scorre l'app, così la penna
    // può scrivere senza che la pagina le scappi sotto.
    this.ultimoPunto = null;
    this.schermoPieno = false;
    this.astuccioAperto = false;
    // Un solo gesto per le due pagine: le due dita possono cadere su fogli diversi.
    const gesto = creaGestoCondiviso();
    const gestoTocco = (phase, event, touches) => this.handleTouchGesture(phase, event, touches);
    this.drawing = new DrawingSurface(this.annotationCanvas, {
      gesto,
      onChange: (elements) => this.saveAnnotations(0, elements),
      onTouchGesture: gestoTocco,
    });
    this.drawing2 = new DrawingSurface(this.annotationCanvas2, {
      gesto,
      onChange: (elements) => this.saveAnnotations(1, elements),
      onTouchGesture: gestoTocco,
    });
    // Un unico astuccio comanda tutte e due le pagine, come nei quaderni.
    this.group = new SurfaceGroup([this.drawing, this.drawing2]);
    attachToolbox(document.querySelector('#reader-tools'), this.group);
    this.bind();
  }

  // Il dito disegna oppure scorre: la scelta vale per tutte e due le pagine.
  setDrawWithFinger(value) {
    this.group.setDrawWithFinger(value);
  }

  bind() {
    document.querySelector('#close-reader').addEventListener('click', () => this.close());
    document.querySelector('#prev-page').addEventListener('click', () => this.goTo(this.pageNumber - this.passo()));
    document.querySelector('#next-page').addEventListener('click', () => this.goTo(this.pageNumber + this.passo()));
    document.querySelector('#reader-two-pages').addEventListener('click', () => this.toggleDoppia());
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
      const notte = !this.pageWrap.classList.contains('night');
      this.pageWrap.classList.toggle('night', notte);
      this.pageWrap2.classList.toggle('night', notte);
      event.currentTarget.classList.toggle('active', notte);
    });
    document.querySelector('#toggle-bookmark').addEventListener('click', () => this.toggleBookmark());
    document.querySelector('#reader-fullscreen').addEventListener('click', () => this.setSchermoPieno(!this.schermoPieno));
    document.querySelector('#reader-exit-fullscreen').addEventListener('click', () => this.setSchermoPieno(false));
    // Col mouse il doppio clic riporta la pagina alla misura naturale. Sul
    // tocco ci pensa già il doppio tocco: qui il doppio clic arriverebbe
    // subito dopo e chiederebbe lo stesso ingrandimento una seconda volta.
    this.scroll.addEventListener('dblclick', () => {
      if (Date.now() - this.ultimoTocco < 700) return;
      this.setZoom(1);
    });
    window.addEventListener('keydown', (event) => {
      if (this.root.hidden) return;
      if (event.key === 'ArrowLeft') this.goTo(this.pageNumber - this.passo());
      if (event.key === 'ArrowRight') this.goTo(this.pageNumber + this.passo());
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
      this.pageNumber = this.allinea(Math.max(1, Math.min(Number(page || this.book.ultimaPagina || 1), this.pdf.numPages)));
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
    this.renderTask2?.cancel?.();
    await this.pdf?.destroy?.().catch(() => {});
    this.pdf = null;
    this.book = null;
    this.drawing.setElements([]);
    this.drawing2.setElements([]);
    this.pageWrap2.hidden = true;
    this.pagesBox.style.transform = '';
    // Il libro successivo si apre con le barre in vista: chi riapre deve
    // ritrovare il pulsante per chiudere, non una pagina senza comandi.
    this.setSchermoPieno(false);
    this.swipe.annulla();
    this.root.hidden = true;
    document.body.classList.remove('workspace-open');
    document.dispatchEvent(new CustomEvent('skooling:reader-closed'));
  }

  // A due pagine si sfoglia di due in due, in coppie 1-2, 3-4, 5-6...
  passo() { return this.doppia ? 2 : 1; }

  allinea(numero) { return this.doppia ? numero - ((numero - 1) % 2) : numero; }

  async goTo(number) {
    if (!this.pdf) return;
    const next = this.allinea(Math.max(1, Math.min(this.pdf.numPages, Math.round(number || 1))));
    if (next === this.pageNumber && this.canvas.width) {
      // Già su questa coppia: il campo torna a mostrare la pagina di sinistra.
      this.pageNumberInput.value = this.pageNumber;
      return;
    }
    this.pageNumber = next;
    this.zoom = 1;
    await this.renderPage();
  }

  async toggleDoppia() {
    this.doppia = !this.doppia;
    const button = document.querySelector('#reader-two-pages');
    button.textContent = this.doppia ? '1 pagina' : '2 pagine';
    button.setAttribute('aria-pressed', String(this.doppia));
    button.classList.toggle('active', this.doppia);
    this.pageNumber = this.allinea(this.pageNumber);
    this.zoom = 1;
    if (this.pdf) await this.renderPage();
  }

  // Disegna una delle due pagine: il PDF sotto, le annotazioni sopra.
  async renderOne(offset, numero, available, annotations) {
    const canvas = offset ? this.canvas2 : this.canvas;
    const wrap = offset ? this.pageWrap2 : this.pageWrap;
    const surface = offset ? this.drawing2 : this.drawing;
    const page = await this.pdf.getPage(numero);
    const base = page.getViewport({ scale: 1 });
    const ratio = Math.min(2, devicePixelRatio || 1);
    const viewport = page.getViewport({ scale: (available / base.width) * this.zoom * ratio });
    const cssWidth = viewport.width / ratio;
    const cssHeight = viewport.height / ratio;
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    wrap.style.width = `${cssWidth}px`;
    wrap.style.height = `${cssHeight}px`;
    const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
    if (offset) this.renderTask2 = task; else this.renderTask = task;
    await task.promise;
    surface.setElements(annotations.filter((item) => item.idLibro === this.book.id && item.pagina === numero));
  }

  // Disegna la pagina corrente. Le chiamate si mettono in fila una dietro
  // l'altra: cambiare pagina, ingrandire e ruotare l'iPad possono arrivare a
  // pochi millisecondi di distanza, e due render sovrapposti sullo stesso
  // canvas facevano scattare un avviso di errore anche quando la pagina si
  // vedeva benissimo. Se nel frattempo è arrivata una richiesta più nuova,
  // questa si ferma in silenzio: a disegnare ci pensa l'ultima.
  async renderPage() {
    if (!this.pdf) return;
    const corsa = ++this.renderCorsa;
    this.loading.hidden = false;
    this.renderTask?.cancel?.();
    this.renderTask2?.cancel?.();
    const precedente = this.renderInCoda;
    let liberaLaCoda;
    this.renderInCoda = new Promise((resolve) => { liberaLaCoda = resolve; });
    await precedente;
    if (corsa !== this.renderCorsa || !this.pdf) { liberaLaCoda(); return; }
    try {
      const destra = this.doppia && this.pageNumber + 1 <= this.pdf.numPages ? this.pageNumber + 1 : null;
      this.pageWrap2.hidden = !destra;
      // Con due pagine la larghezza si divide, meno lo spazio tra i due fogli.
      const available = destra
        ? Math.max(200, (this.scroll.clientWidth - 56 - 18) / 2)
        : Math.max(280, this.scroll.clientWidth - 56);
      this.pagesBox.style.transform = '';
      const annotations = await DB.getAll('annotazioni');
      await this.renderOne(0, this.pageNumber, available, annotations);
      if (destra) await this.renderOne(1, destra, available, annotations);
      else this.drawing2.setElements([]);
      this.setDrawWithFinger(this.drawing.drawWithFinger);
      this.pageNumberInput.value = this.pageNumber;
      document.querySelector('#zoom-label').textContent = `${Math.round(this.zoom * 100)}%`;
      this.updateThumbnailSelection();
      await DB.put('libri', { ...this.book, ultimaPagina: this.pageNumber });
      this.book.ultimaPagina = this.pageNumber;
      this.updateBookmarkButton();
      for (const nearby of [this.pageNumber - 1, this.pageNumber + this.passo() + 1]) {
        if (nearby >= 1 && nearby <= this.pdf.numPages) this.pdf.getPage(nearby).catch(() => {});
      }
      this.scroll.scrollTo({ top: 0, left: 0 });
    } catch (error) {
      // Si avvisa solo per un guasto vero dell'ultima richiesta: un render
      // annullato o sorpassato da uno più nuovo non è un errore da mostrare.
      const sorpassato = corsa !== this.renderCorsa || error?.name === 'RenderingCancelledException';
      if (!sorpassato) {
        document.dispatchEvent(new CustomEvent('skooling:message', { detail: { text: 'La pagina non si è caricata. Riprova.', error: true } }));
      }
    } finally {
      if (corsa === this.renderCorsa) this.loading.hidden = true;
      liberaLaCoda();
    }
  }

  async setZoom(value) {
    const prossimo = Math.max(0.75, Math.min(3.5, value));
    // Ingrandimento identico a quello di adesso: non c'è nulla da ridisegnare.
    if (Math.abs(prossimo - this.zoom) < 0.005) {
      this.pagesBox.style.transform = '';
      return;
    }
    this.zoom = prossimo;
    await this.renderPage();
  }

  handleTouchGesture(phase, event, touches) {
    const dita = ditaAppoggiate(touches);
    if (phase === 'start') {
      this.swipe.inizio(touches);
      this.ultimoPunto = null;
      if (dita.length === 2) {
        const [a, b] = dita;
        this.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: this.zoom, preview: this.zoom };
      }
      return;
    }
    if (phase === 'move') {
      this.swipe.muovi(touches);
      if (this.pinch && dita.length >= 2) {
        const [a, b] = dita;
        const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        this.pinch.preview = Math.max(0.75, Math.min(3.5, this.pinch.zoom * distance / this.pinch.distance));
        this.pagesBox.style.transform = `scale(${this.pinch.preview / this.zoom})`;
        return;
      }
      if (touches.size === 1) this.scorriFoglio(touches);
      return;
    }
    if (phase !== 'end') return;
    this.ultimoPunto = null;
    if (event.pointerType === 'touch') this.ultimoTocco = Date.now();
    // A pagina ingrandita le dita servono a spostare e a ridurre: si cambia
    // pagina soltanto quando il foglio è alla sua misura naturale.
    const direzione = this.zoom <= 1.01 ? this.swipe.fine(touches) : (this.swipe.annulla(), 0);
    if (direzione) {
      this.pinch = null;
      this.pagesBox.style.transform = '';
      this.lastTap = 0;
      this.goTo(this.pageNumber + direzione * this.passo());
      return;
    }
    if (this.pinch) {
      const preview = this.pinch.preview;
      this.pinch = null;
      this.setZoom(preview);
      return;
    }
    if (event.pointerType === 'touch') {
      const now = Date.now();
      if (now - this.lastTap < 320) {
        this.lastTap = 0; // il doppio tocco è servito: un terzo tocco riparte da zero
        this.setZoom(1);
      } else {
        this.lastTap = now;
      }
    }
  }

  // Un dito solo che non scrive porta in giro il foglio. Lo scorrimento lo fa
  // l'app perché al browser il foglio è vietato: altrimenti si riprenderebbe
  // anche i tratti della penna.
  scorriFoglio(touches) {
    const [punto] = [...touches.values()];
    if (!punto) return;
    if (this.ultimoPunto) {
      this.scroll.scrollLeft -= punto.x - this.ultimoPunto.x;
      this.scroll.scrollTop -= punto.y - this.ultimoPunto.y;
    }
    this.ultimoPunto = { x: punto.x, y: punto.y };
  }

  // Vista a schermo intero: restano soltanto le pagine, senza barra in alto,
  // controlli in basso e astuccio. Si esce col pulsante che resta in un angolo
  // oppure toccando di nuovo il pulsante nella barra.
  setSchermoPieno(attivo) {
    this.schermoPieno = Boolean(attivo);
    this.root.classList.toggle('schermo-pieno', this.schermoPieno);
    const bottone = document.querySelector('#reader-fullscreen');
    bottone.setAttribute('aria-pressed', String(this.schermoPieno));
    bottone.classList.toggle('active', this.schermoPieno);
    const astuccio = document.querySelector('#reader-tools');
    const interruttore = document.querySelector('#toggle-reader-tools');
    if (this.schermoPieno) {
      this.astuccioAperto = !astuccio.hidden;
      astuccio.hidden = true;
      interruttore.classList.remove('active');
    } else if (this.astuccioAperto) {
      astuccio.hidden = false;
      interruttore.classList.add('active');
    }
  }

  // Salva le annotazioni della pagina toccata: 0 = sinistra, 1 = destra.
  async saveAnnotations(offset, elements) {
    if (!this.book || !this.pdf) return;
    const page = this.pageNumber + offset;
    if (offset && (!this.doppia || page > this.pdf.numPages)) return;
    const chiave = offset ? 'annotationSaveToken2' : 'annotationSaveToken';
    const token = ++this[chiave];
    const bookId = this.book.id;
    await waitFrame();
    if (token !== this[chiave]) return;
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
