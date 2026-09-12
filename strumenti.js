// Motore vettoriale condiviso da libri e quaderni.
import { createId } from './db.js';

export const COLORS = ['#1f2937', '#2457d6', '#db3a34', '#15956d', '#f0b429', '#8b5cf6', '#f472b6'];
export const WIDTHS = [2, 5, 10];
export const TEXT_SIZES = [16, 20, 24, 32, 40, 42, 56, 72];
export const TEXT_FONTS = {
  sans: '-apple-system, BlinkMacSystemFont, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"SFMono-Regular", Consolas, monospace',
};

export function normalizePoint(point, rect) {
  return {
    x: Math.min(1, Math.max(0, (point.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (point.clientY - rect.top) / rect.height)),
    pressure: point.pressure || 0.5,
    tiltX: point.tiltX || 0,
    tiltY: point.tiltY || 0,
  };
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

export function hitTestElement(element, point, tolerance = 0.025) {
  if (element.tipo === 'testo') {
    return point.x >= element.x - tolerance && point.x <= element.x + element.w + tolerance
      && point.y >= element.y - tolerance && point.y <= element.y + element.h + tolerance;
  }
  if (['rettangolo', 'cerchio'].includes(element.tipo)) {
    const left = Math.min(element.x1, element.x2);
    const right = Math.max(element.x1, element.x2);
    const top = Math.min(element.y1, element.y2);
    const bottom = Math.max(element.y1, element.y2);
    if (element.tipo === 'rettangolo') {
      const onVertical = Math.abs(point.x - left) <= tolerance || Math.abs(point.x - right) <= tolerance;
      const onHorizontal = Math.abs(point.y - top) <= tolerance || Math.abs(point.y - bottom) <= tolerance;
      return (onVertical && point.y >= top - tolerance && point.y <= bottom + tolerance)
        || (onHorizontal && point.x >= left - tolerance && point.x <= right + tolerance);
    }
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const rx = Math.max((right - left) / 2, 0.001);
    const ry = Math.max((bottom - top) / 2, 0.001);
    const edge = Math.hypot((point.x - cx) / rx, (point.y - cy) / ry);
    return Math.abs(edge - 1) <= tolerance / Math.max(rx, ry);
  }
  const points = element.punti ?? (element.x1 !== undefined
    ? [{ x: element.x1, y: element.y1 }, { x: element.x2, y: element.y2 }]
    : []);
  for (let index = 1; index < points.length; index += 1) {
    if (distanceToSegment(point, points[index - 1], points[index]) <= tolerance) return true;
  }
  return points.length === 1 && Math.hypot(point.x - points[0].x, point.y - points[0].y) <= tolerance;
}

function clone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function interpolatePoint(start, end, amount) {
  const point = {
    x: start.x + (end.x - start.x) * amount,
    y: start.y + (end.y - start.y) * amount,
  };
  for (const key of ['pressure', 'tiltX', 'tiltY']) {
    if (start[key] !== undefined || end[key] !== undefined) {
      point[key] = (start[key] || 0) + ((end[key] || 0) - (start[key] || 0)) * amount;
    }
  }
  return point;
}

function splitFreehandStroke(element, eraserPoint, tolerance) {
  const points = element.punti || [];
  const hit = points.slice(1).some((point, index) => distanceToSegment(eraserPoint, points[index], point) <= tolerance);
  if (!hit) return null;

  const densePoints = points.length ? [points[0]] : [];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / (tolerance / 2)));
    for (let step = 1; step <= steps; step += 1) densePoints.push(interpolatePoint(start, end, step / steps));
  }

  const chunks = [];
  let current = [];
  for (const point of densePoints) {
    if (Math.hypot(point.x - eraserPoint.x, point.y - eraserPoint.y) > tolerance) current.push(point);
    else if (current.length >= 2) { chunks.push(current); current = []; }
    else current = [];
  }
  if (current.length >= 2) chunks.push(current);
  return chunks.map((chunk, index) => ({ ...element, id: index ? createId('segno') : element.id, punti: chunk }));
}

function splitUnderline(element, eraserPoint, tolerance) {
  const pieces = splitFreehandStroke(
    { ...element, punti: [{ x: element.x1, y: element.y1 }, { x: element.x2, y: element.y2 }] },
    eraserPoint,
    tolerance,
  );
  if (!pieces) return null;
  return pieces.map(({ punti, ...piece }) => ({
    ...piece,
    x1: punti[0].x,
    y1: punti[0].y,
    x2: punti.at(-1).x,
    y2: punti.at(-1).y,
  }));
}

export class HistoryStack {
  constructor(limit = 30) {
    this.limit = Math.max(20, limit);
    this.states = [];
    this.index = -1;
  }

  reset(state = []) {
    this.states = [clone(state)];
    this.index = 0;
  }

  // Ultimo stato salvato: serve per tornare indietro da un gesto annullato.
  current() {
    return this.states[this.index] ? clone(this.states[this.index]) : [];
  }

  push(state) {
    this.states = this.states.slice(0, this.index + 1);
    this.states.push(clone(state));
    if (this.states.length > this.limit + 1) this.states.shift();
    this.index = this.states.length - 1;
  }

  undo() {
    if (this.index <= 0) return null;
    this.index -= 1;
    return clone(this.states[this.index]);
  }

  redo() {
    if (this.index >= this.states.length - 1) return null;
    this.index += 1;
    return clone(this.states[this.index]);
  }
}

function drawArrowHead(context, start, end, size) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - size * Math.cos(angle - Math.PI / 6), end.y - size * Math.sin(angle - Math.PI / 6));
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - size * Math.cos(angle + Math.PI / 6), end.y - size * Math.sin(angle + Math.PI / 6));
  context.stroke();
}

export function drawElement(context, element, width, height, selected = false) {
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = element.colore || COLORS[0];
  context.fillStyle = element.colore || COLORS[0];
  context.lineWidth = element.spessore || WIDTHS[0];
  context.globalAlpha = element.tipo === 'evidenziatore' ? 0.28 : 1;

  if (['penna', 'evidenziatore'].includes(element.tipo)) {
    const points = element.punti || [];
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const point = points[index];
      const pressure = element.tipo === 'evidenziatore' ? 1 : (previous.pressure + point.pressure) / 2 || 0.5;
      context.lineWidth = (element.spessore || 2) * (0.65 + pressure * 0.7);
      context.beginPath();
      context.moveTo(previous.x * width, previous.y * height);
      context.lineTo(point.x * width, point.y * height);
      context.stroke();
    }
  } else if (element.tipo === 'testo') {
    const x = element.x * width;
    const y = element.y * height;
    const boxWidth = element.w * width;
    const boxHeight = element.h * height;
    const fontSize = element.dimensioneTesto
      ? Math.max(10, element.dimensioneTesto * (height / 1000))
      : Math.max(14, (element.spessore || 5) * 4);
    const fontFamily = TEXT_FONTS[element.carattere] || TEXT_FONTS.sans;
    const fontStyle = element.corsivo ? 'italic ' : '';
    const fontWeight = element.grassetto ? '700 ' : '';
    context.font = `${fontStyle}${fontWeight}${fontSize}px ${fontFamily}`;
    context.textBaseline = 'top';
    const alignment = ['left', 'center', 'right'].includes(element.allineamento) ? element.allineamento : 'left';
    context.textAlign = alignment;
    const textX = alignment === 'center' ? x + boxWidth / 2 : alignment === 'right' ? x + boxWidth - 4 : x + 4;
    const words = (element.testo || '').split(/\s+/);
    let line = '';
    let lineY = y + 4;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width > boxWidth - 8 && line) {
        context.fillText(line, textX, lineY);
        line = word;
        lineY += fontSize * 1.25;
      } else line = candidate;
    }
    context.fillText(line, textX, lineY);
    if (selected) {
      context.globalAlpha = 1;
      context.strokeStyle = '#2457d6';
      context.lineWidth = 2;
      context.setLineDash([6, 4]);
      context.strokeRect(x, y, boxWidth, boxHeight);
      context.setLineDash([]);
      context.fillStyle = '#2457d6';
      context.fillRect(x + boxWidth - 7, y + boxHeight - 7, 14, 14);
    }
  } else {
    const x1 = element.x1 * width;
    const y1 = element.y1 * height;
    const x2 = element.x2 * width;
    const y2 = element.y2 * height;
    context.beginPath();
    if (element.tipo === 'cerchio') {
      context.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
    } else if (element.tipo === 'rettangolo') {
      context.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    } else {
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
    }
    context.stroke();
    if (element.tipo === 'freccia') drawArrowHead(context, { x: x1, y: y1 }, { x: x2, y: y2 }, 12 + element.spessore);
  }
  context.restore();
}

// Stato del gesto a due dita, condiviso da più fogli affiancati: le due dita
// possono cadere su fogli diversi (doppia pagina) e devono comunque contare
// come un solo gesto. `touches` tiene i tocchi vivi in coordinate schermo.
export function creaGestoCondiviso() {
  return { touches: new Map(), attivo: false, fogli: [] };
}

// Sfioramento orizzontale per cambiare pagina. Guarda le dita appoggiate sul
// foglio e risponde soltanto a un movimento netto di lato, così chi scrive o
// chi ingrandisce non cambia pagina per sbaglio: un segno di penna resta corto
// o va in tutte le direzioni, e un ingrandimento apre o chiude le dita.
export function creaRilevatoreSwipe(opzioni = {}) {
  const distanzaMinima = opzioni.distanzaMinima ?? 70;        // px percorsi di lato
  const quantoOrizzontale = opzioni.quantoOrizzontale ?? 1.8; // quanto più di lato che in alto
  const durataMassima = opzioni.durataMassima ?? 900;         // ms: è uno sfioramento, non un trascinamento
  const aperturaAmmessa = opzioni.aperturaAmmessa ?? 45;      // px di apertura fra due dita
  const adesso = opzioni.adesso ?? (() => Date.now());
  let traccia = null;

  const misura = (touches) => {
    const dita = [...touches.values()];
    return {
      numero: dita.length,
      posizioni: dita.map((dito) => ({ x: dito.x, y: dito.y })),
      apertura: dita.length >= 2 ? Math.hypot(dita[0].x - dita[1].x, dita[0].y - dita[1].y) : 0,
    };
  };

  const media = (posizioni, asse) => posizioni.reduce((somma, punto) => somma + punto[asse], 0) / posizioni.length;

  return {
    // Ogni dito che si appoggia ricomincia la misura: il gesto vero parte da
    // quando tutte le dita sono a terra.
    inizio(touches) {
      const stato = misura(touches);
      if (!stato.numero) { traccia = null; return; }
      traccia = {
        numero: stato.numero,
        partenza: stato.posizioni.map((punto) => ({ ...punto })),
        posizioni: stato.posizioni,
        apertura: stato.apertura,
        tempo: adesso(),
        scartoMassimo: 0,
      };
    },

    muovi(touches) {
      if (!traccia) return;
      const stato = misura(touches);
      if (stato.numero !== traccia.numero) { traccia = null; return; }
      // Quanto si sono allontanate o avvicinate le dita rispetto alla partenza.
      // Il movimento di ogni dito arriva in un momento suo, quindi durante uno
      // sfioramento la distanza fra le due oscilla: qui si tiene solo lo scarto
      // più grande, e il giudizio si dà alla fine.
      if (traccia.numero >= 2) {
        traccia.scartoMassimo = Math.max(traccia.scartoMassimo, Math.abs(stato.apertura - traccia.apertura));
      }
      traccia.posizioni = stato.posizioni;
    },

    // Risponde -1 per la pagina precedente, +1 per la successiva, 0 se non era
    // uno sfioramento. Va chiamato quando il primo dito si stacca.
    fine(touches) {
      const corsa = traccia;
      traccia = null;
      if (!corsa) return 0;
      if (adesso() - corsa.tempo > durataMassima) return 0;
      const stato = misura(touches);
      if (stato.numero !== corsa.numero) return 0;
      if (corsa.numero >= 2) {
        // Alla fine le dita sono distanti come all'inizio: sono andate insieme.
        // Se invece si sono aperte o chiuse, anche solo a metà strada, era un
        // ingrandimento e la pagina non deve cambiare.
        if (Math.abs(stato.apertura - corsa.apertura) > aperturaAmmessa) return 0;
        if (corsa.scartoMassimo > aperturaAmmessa * 3) return 0;
      }
      const dx = media(corsa.posizioni, 'x') - media(corsa.partenza, 'x');
      const dy = media(corsa.posizioni, 'y') - media(corsa.partenza, 'y');
      if (Math.abs(dx) < distanzaMinima) return 0;
      if (Math.abs(dx) < Math.abs(dy) * quantoOrizzontale) return 0;
      // Tutte le dita devono andare dalla stessa parte: due dita che vanno in
      // versi opposti stanno ingrandendo o ruotando.
      for (let indice = 0; indice < corsa.numero; indice += 1) {
        const passo = corsa.posizioni[indice].x - corsa.partenza[indice].x;
        if (Math.sign(passo) !== Math.sign(dx) || Math.abs(passo) < distanzaMinima / 2) return 0;
      }
      return dx < 0 ? 1 : -1; // dito verso sinistra: pagina successiva
    },

    annulla() { traccia = null; },
  };
}

// La casella di testo può essere già stata tolta dal foglio: toglierla di nuovo
// non deve fermare l'app.
function togliDalFoglio(elemento) {
  try { elemento.remove(); } catch { /* già tolta */ }
}

export class DrawingSurface {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.elements = [];
    this.tool = 'penna';
    this.color = COLORS[1];
    this.width = WIDTHS[1];
    this.readOnly = false;
    this.drawWithFinger = false;
    this.textDraft = {
      testo: '', colore: COLORS[1], dimensioneTesto: 24, carattere: 'sans',
      grassetto: false, corsivo: false, allineamento: 'left',
    };
    this.active = null;
    this.selectedId = null;
    this.editingId = null;   // id della casella di testo aperta per scriverci
    this.textEditor = null;  // l'elemento HTML editabile in-place (apre la tastiera grande)
    this.pointers = new Map();
    this.gesto = options.gesto || creaGestoCondiviso();
    this.gesto.fogli.push(this);
    this.history = new HistoryStack(30);
    this.history.reset([]);
    this.onChange = options.onChange || (() => {});
    this.onTouchGesture = options.onTouchGesture || (() => {});
    this.onTextRequired = options.onTextRequired || (() => {});
    this.onTextSelection = options.onTextSelection || (() => {});
    this.onActivate = options.onActivate || (() => {}); // "sono io il foglio su cui si scrive"
    this.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.resize()) : null;
    this.resizeObserver?.observe(canvas);
    this.bindEvents();
    this.resize();
  }

  bindEvents() {
    this.canvas.addEventListener('pointerdown', (event) => this.pointerDown(event));
    this.canvas.addEventListener('pointermove', (event) => this.pointerMove(event));
    this.canvas.addEventListener('pointerup', (event) => this.pointerUp(event));
    this.canvas.addEventListener('pointercancel', (event) => this.pointerUp(event));
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  resize() {
    // Misura di impaginazione, non quella a schermo: se il foglio è ingrandito
    // con una trasformazione CSS la risoluzione del canvas non deve cambiare.
    const rect = this.canvas.getBoundingClientRect();
    const width = this.canvas.offsetWidth || rect.width;
    const height = this.canvas.offsetHeight || rect.height;
    if (!width || !height) return;
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.render();
  }

  setElements(elements = []) {
    this.scartaEditorTesto(); // cambio pagina: la casella aperta non deve restare appesa
    this.elements = clone(elements);
    this.selectedId = null;
    this.history.reset(this.elements);
    this.render();
  }

  setTool(tool) { this.tool = tool; this.selectedId = null; this.render(); }
  setColor(color) {
    this.color = color;
    if (this.tool === 'testo') this.textDraft = { ...this.textDraft, colore: color };
  }
  setWidth(width) { this.width = Number(width); }
  setReadOnly(value) { this.readOnly = Boolean(value); }
  setDrawWithFinger(value) { this.drawWithFinger = Boolean(value); }

  eraseAt(point) {
    const tolerance = Math.max(0.012, this.width / 250);
    let changed = false;
    const next = [];
    for (const element of this.elements) {
      if (['penna', 'evidenziatore'].includes(element.tipo)) {
        const pieces = splitFreehandStroke(element, point, tolerance);
        if (pieces) { changed = true; next.push(...pieces); }
        else next.push(element);
      } else if (element.tipo === 'sottolineatura') {
        const pieces = splitUnderline(element, point, tolerance);
        if (pieces) { changed = true; next.push(...pieces); }
        else next.push(element);
      } else if (hitTestElement(element, point, tolerance)) changed = true;
      else next.push(element);
    }
    if (changed) this.elements = next;
    return changed;
  }

  eraseBetween(start, end) {
    const tolerance = Math.max(0.012, this.width / 250);
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const steps = Math.max(1, Math.ceil(distance / (tolerance / 2)));
    let changed = false;
    for (let step = 1; step <= steps; step += 1) {
      changed = this.eraseAt(interpolatePoint(start, end, step / steps)) || changed;
    }
    return changed;
  }

  setTextDraft(draft = {}) {
    this.textDraft = { ...this.textDraft, ...draft };
  }

  updateSelectedText(draft = this.textDraft) {
    const element = this.elements.find((item) => item.id === this.selectedId && item.tipo === 'testo');
    const text = draft.testo?.trim();
    if (!element || !text) return false;
    Object.assign(element, {
      testo: text,
      colore: draft.colore || element.colore || this.color,
      dimensioneTesto: Number(draft.dimensioneTesto) || element.dimensioneTesto || 24,
      carattere: TEXT_FONTS[draft.carattere] ? draft.carattere : (element.carattere || 'sans'),
      grassetto: Boolean(draft.grassetto),
      corsivo: Boolean(draft.corsivo),
      allineamento: ['left', 'center', 'right'].includes(draft.allineamento) ? draft.allineamento : 'left',
    });
    this.textDraft = { ...this.textDraft, ...draft, testo: text };
    this.commit();
    return true;
  }

  canDraw(event) {
    return !this.readOnly && (event.pointerType === 'pen' || event.pointerType === 'mouse' || this.drawWithFinger);
  }

  pointFromEvent(event) { return normalizePoint(event, this.canvas.getBoundingClientRect()); }

  // Un gesto è in corso quando il dito non scrive (allora scorre e ingrandisce)
  // oppure quando sono arrivate due dita insieme.
  inGesto(event) {
    return event.pointerType === 'touch' && (this.gesto.attivo || !this.drawWithFinger);
  }

  // Il secondo dito trasforma il tocco in gesto: il segno appena cominciato
  // viene tolto, così l'ingrandimento non lascia scarabocchi sul foglio.
  annullaTrattoInCorso() {
    const active = this.active;
    if (!active) return;
    this.active = null;
    if (active.kind === 'erase') this.elements = this.history.current();
    else if (active.kind === 'move-text') {
      const element = this.elements.find((item) => item.id === active.id);
      if (element) Object.assign(element, active.original);
    } else if (active.id) {
      this.elements = this.elements.filter((item) => item.id !== active.id);
      if (this.selectedId === active.id) this.selectedId = null;
    }
    this.render();
  }

  pointerDown(event) {
    if (event.pointerType === 'touch') this.gesto.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.pointers.set(event.pointerId, this.pointFromEvent(event));
    if (this.textEditor) { this.textEditor.blur(); return; } // il tocco conferma/chiude la casella aperta
    if (event.pointerType === 'touch' && this.gesto.touches.size >= 2 && !this.gesto.attivo) {
      this.gesto.attivo = true;
      for (const foglio of this.gesto.fogli) foglio.annullaTrattoInCorso();
    }
    if (this.inGesto(event)) {
      this.onTouchGesture('start', event, this.gesto.touches);
      return;
    }
    if (!this.canDraw(event)) return;
    this.onActivate(); // questo foglio diventa quello attivo per astuccio, testo e annulla
    event.preventDefault();
    // Se il puntatore è già stato rilasciato la cattura non serve e non deve
    // interrompere il tratto: si prosegue senza.
    try { this.canvas.setPointerCapture?.(event.pointerId); } catch { /* puntatore già chiuso */ }
    const point = this.pointFromEvent(event);
    if (this.tool === 'gomma') {
      this.active = { kind: 'erase', last: point, changed: this.eraseAt(point) };
      this.render();
      return;
    }
    if (this.tool === 'testo') {
      const existing = [...this.elements].reverse().find((item) => item.tipo === 'testo' && hitTestElement(item, point, 0.02));
      if (existing) {
        // tocco una casella: mi preparo a spostarla; se non trascino (tap) la apro per scriverci
        this.selectedId = existing.id;
        this.active = { kind: 'move-text', id: existing.id, start: point, original: clone(existing), moved: false };
        this.render();
        return;
      }
      // punto vuoto: creo la casella qui e la apro subito per scrivere (tastiera grande, come Anteprima)
      const element = {
        id: createId('segno'), tipo: 'testo', testo: '',
        x: Math.max(0, Math.min(0.92, point.x)),
        y: Math.max(0, Math.min(0.94, point.y)),
        w: 0.4, h: 0.1,
        colore: this.color,
        dimensioneTesto: this.textSizeFromWidth(),
        allineamento: 'left',
        timestamp: Date.now(),
      };
      this.elements.push(element);
      this.selectedId = element.id;
      this.render();
      this.apriEditorTesto(element);
      return;
    }
    const base = { id: createId('segno'), tipo: this.tool, colore: this.color, spessore: this.width, timestamp: Date.now() };
    if (['penna', 'evidenziatore'].includes(this.tool)) base.punti = [point];
    else Object.assign(base, { x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    this.active = base;
    this.elements.push(base);
    this.render();
  }

  pointerMove(event) {
    const point = this.pointFromEvent(event);
    if (event.pointerType === 'touch' && this.gesto.touches.has(event.pointerId)) {
      this.gesto.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    this.pointers.set(event.pointerId, point);
    if (this.inGesto(event)) {
      this.onTouchGesture('move', event, this.gesto.touches);
      return;
    }
    if (!this.active || !this.canDraw(event)) return;
    event.preventDefault();
    if (this.active.kind === 'erase') {
      this.active.changed = this.eraseBetween(this.active.last, point) || this.active.changed;
      this.active.last = point;
    } else if (this.active.kind) {
      const element = this.elements.find((item) => item.id === this.active.id);
      if (!element) return;
      const dx = point.x - this.active.start.x;
      const dy = point.y - this.active.start.y;
      if (this.active.kind === 'move-text') {
        element.x = Math.max(0, Math.min(1 - element.w, this.active.original.x + dx));
        element.y = Math.max(0, Math.min(1 - element.h, this.active.original.y + dy));
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) this.active.moved = true;
      } else {
        element.w = Math.max(0.12, Math.min(1 - element.x, this.active.original.w + dx));
        element.h = Math.max(0.07, Math.min(1 - element.y, this.active.original.h + dy));
      }
    } else if (this.active.punti) {
      const last = this.active.punti.at(-1);
      if (Math.hypot(point.x - last.x, point.y - last.y) > 0.0015) this.active.punti.push(point);
    } else {
      this.active.x2 = point.x;
      this.active.y2 = point.y;
    }
    this.render();
  }

  pointerUp(event) {
    const gesto = this.inGesto(event);
    if (gesto) this.onTouchGesture('end', event, this.gesto.touches);
    if (event.pointerType === 'touch') this.gesto.touches.delete(event.pointerId);
    this.pointers.delete(event.pointerId);
    // Finché resta a terra un dito del gesto non si torna a scrivere.
    if (this.gesto.attivo && this.gesto.touches.size === 0) this.gesto.attivo = false;
    if (gesto) return;
    if (!this.active || !this.canDraw(event)) return;
    if (this.active.kind === 'erase') {
      const changed = this.active.changed;
      this.active = null;
      if (changed) this.commit();
      else this.render();
      return;
    }
    if (this.active.kind === 'move-text' && !this.active.moved) {
      // tap su una casella esistente (non spostata): la apro per scriverci
      const el = this.elements.find((e) => e.id === this.active.id);
      this.active = null;
      if (el) this.apriEditorTesto(el);
      return;
    }
    if (!this.active.kind && this.active.punti?.length === 1) this.active.punti.push({ ...this.active.punti[0], x: this.active.punti[0].x + 0.0001 });
    this.active = null;
    this.commit();
  }

  textSizeFromWidth() {
    return this.width <= 2 ? 26 : this.width >= 10 ? 60 : 40;
  }

  // Apre una casella di testo editabile IN-PLACE sul foglio: la tastiera grande del
  // dispositivo si apre e si scrive dentro. Al termine (tocco fuori o Invio) il testo
  // resta al suo posto; se la casella resta vuota, si annulla.
  apriEditorTesto(element) {
    const parent = this.canvas.parentElement;
    if (!parent || typeof document === 'undefined') return; // senza DOM (es. test): niente casella
    this.editingId = element.id;
    this.render();
    const rect = this.canvas.getBoundingClientRect();
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.className = 'text-inplace';
    editor.textContent = element.testo || '';
    editor.style.left = `${element.x * 100}%`;
    editor.style.top = `${element.y * 100}%`;
    editor.style.color = element.colore;
    editor.style.fontSize = `${Math.max(12, element.dimensioneTesto * rect.height / 1000)}px`;
    editor.style.maxWidth = `${Math.max(10, (1 - element.x) * 100)}%`;
    parent.appendChild(editor);
    this.textEditor = editor;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const chiudi = () => {
      if (this.textEditor !== editor) return;
      const testo = editor.textContent.replace(/ /g, ' ').replace(/\s+$/,'').trim();
      this.textEditor = null;
      this.editingId = null;
      togliDalFoglio(editor);
      const el = this.elements.find((e) => e.id === element.id);
      if (el) {
        if (!testo) this.elements = this.elements.filter((e) => e.id !== element.id);
        else el.testo = testo;
      }
      this.commit();
    };
    editor.addEventListener('blur', chiudi);
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editor.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); editor.blur(); }
    });
  }

  // Toglie la casella senza salvare: si usa quando il foglio cambia sotto.
  scartaEditorTesto() {
    if (!this.textEditor) return;
    const editor = this.textEditor;
    this.textEditor = null;
    this.editingId = null;
    togliDalFoglio(editor);
  }

  commit() {
    this.history.push(this.elements);
    this.render();
    Promise.resolve().then(() => this.onChange(clone(this.elements)));
  }

  undo() {
    const state = this.history.undo();
    if (!state) return false;
    this.elements = state;
    this.selectedId = null;
    this.render();
    Promise.resolve().then(() => this.onChange(clone(this.elements)));
    return true;
  }

  redo() {
    const state = this.history.redo();
    if (!state) return false;
    this.elements = state;
    this.selectedId = null;
    this.render();
    Promise.resolve().then(() => this.onChange(clone(this.elements)));
    return true;
  }

  render(context = this.context, width = this.canvas.width, height = this.canvas.height) {
    context.clearRect(0, 0, width, height);
    for (const element of this.elements) {
      if (element.id === this.editingId) continue; // in scrittura: lo mostra la casella HTML
      drawElement(context, element, width, height, element.id === this.selectedId);
    }
  }

  destroy() {
    this.resizeObserver?.disconnect();
  }
}

// Raggruppa più fogli (DrawingSurface) sotto un unico astuccio: le scelte comuni
// (strumento, colore, spessore...) valgono per tutti i fogli; annulla/ripeti e il
// testo agiscono sul foglio ATTIVO, cioè l'ultimo toccato. Espone la stessa
// interfaccia che attachToolbox si aspetta da una singola surface, così l'astuccio
// non sa nemmeno che i fogli sono più di uno.
export class SurfaceGroup {
  constructor(surfaces) {
    this.surfaces = surfaces;
    this.active = surfaces[0];
    this._onTextRequired = () => {};
    this._onTextSelection = () => {};
    for (const s of surfaces) {
      s.onActivate = () => { this.active = s; };
      s.onTextRequired = () => this._onTextRequired();
      s.onTextSelection = (element) => this._onTextSelection(element);
    }
  }

  // Scelte comuni: valgono per tutti i fogli
  setTool(tool) { this.surfaces.forEach((s) => s.setTool(tool)); }
  setColor(color) { this.surfaces.forEach((s) => s.setColor(color)); }
  setWidth(width) { this.surfaces.forEach((s) => s.setWidth(width)); }
  setReadOnly(value) { this.surfaces.forEach((s) => s.setReadOnly(value)); }
  setDrawWithFinger(value) { this.surfaces.forEach((s) => s.setDrawWithFinger(value)); }
  setTextDraft(draft) { this.surfaces.forEach((s) => s.setTextDraft(draft)); }

  // Azioni sul foglio attivo
  undo() { return this.active.undo(); }
  redo() { return this.active.redo(); }
  updateSelectedText(draft) { return this.active.updateSelectedText(draft); }
  render() { this.active.render(); }

  get textDraft() { return this.active.textDraft; }
  get selectedId() { return this.active.selectedId; }
  set selectedId(value) { this.active.selectedId = value; }
  get onTextRequired() { return this._onTextRequired; }
  set onTextRequired(fn) { this._onTextRequired = fn; }
  get onTextSelection() { return this._onTextSelection; }
  set onTextSelection(fn) { this._onTextSelection = fn; }
}

function ascii(value) { return new TextEncoder().encode(value); }

function concatBytes(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

export function makePdfFromJpegs(images) {
  if (!images.length) throw new Error('Non ci sono pagine da esportare.');
  const parts = [ascii('%PDF-1.4\n%Skooling\n')];
  const offsets = [0];
  let total = parts[0].length;
  const objectCount = 2 + images.length * 3;
  const addObject = (number, chunks) => {
    offsets[number] = total;
    const objectParts = [ascii(`${number} 0 obj\n`), ...chunks, ascii('\nendobj\n')];
    parts.push(...objectParts);
    total += objectParts.reduce((sum, part) => sum + part.length, 0);
  };
  addObject(1, [ascii('<< /Type /Catalog /Pages 2 0 R >>')]);
  const kids = images.map((_, index) => `${3 + index * 3} 0 R`).join(' ');
  addObject(2, [ascii(`<< /Type /Pages /Count ${images.length} /Kids [${kids}] >>`)]);
  images.forEach((image, index) => {
    const pageNumber = 3 + index * 3;
    const contentNumber = pageNumber + 1;
    const imageNumber = pageNumber + 2;
    const landscape = image.width > image.height;
    const pageWidth = landscape ? 842 : 595;
    const pageHeight = landscape ? 595 : 842;
    const scale = Math.min(pageWidth / image.width, pageHeight / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;
    const stream = `q ${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${index} Do Q`;
    addObject(pageNumber, [ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im${index} ${imageNumber} 0 R >> >> /Contents ${contentNumber} 0 R >>`)]);
    addObject(contentNumber, [ascii(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)]);
    addObject(imageNumber, [
      ascii(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`),
      image.bytes,
      ascii('\nendstream'),
    ]);
  });
  const xrefOffset = total;
  const xref = [`xref\n0 ${objectCount + 1}\n`, '0000000000 65535 f \n'];
  for (let number = 1; number <= objectCount; number += 1) xref.push(`${String(offsets[number]).padStart(10, '0')} 00000 n \n`);
  xref.push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  parts.push(ascii(xref.join('')));
  return concatBytes(parts);
}

export async function canvasToJpeg(canvas, quality = 0.9) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function attachToolbox(root, surface) {
  const palette = root.querySelector('[data-palette]');
  palette.replaceChildren(...COLORS.map((color, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `color-button${index === 1 ? ' active' : ''}`;
    button.style.background = color;
    button.dataset.color = color;
    button.setAttribute('aria-label', `Colore ${index + 1}`);
    return button;
  }));

  const textPanel = document.createElement('section');
  textPanel.className = 'text-panel';
  textPanel.dataset.textPanel = '';
  textPanel.hidden = true;
  textPanel.innerHTML = `
    <label class="text-field">Testo<textarea data-text-value rows="3" maxlength="500" placeholder="Scrivi qui il testo"></textarea></label>
    <div class="text-control-row">
      <label>Dimensione<select data-text-size>${TEXT_SIZES.map((size) => `<option value="${size}"${size === 24 ? ' selected' : ''}>${size}</option>`).join('')}</select></label>
      <label>Carattere<select data-text-font><option value="sans">Semplice</option><option value="serif">Classico</option><option value="mono">Monospazio</option></select></label>
    </div>
    <div class="text-style-buttons" role="group" aria-label="Stile del testo">
      <button type="button" data-text-bold aria-pressed="false" aria-label="Grassetto"><strong>G</strong></button>
      <button type="button" data-text-italic aria-pressed="false" aria-label="Corsivo"><em>C</em></button>
      <button type="button" data-text-align="left" class="active" aria-label="Allinea a sinistra">≡</button>
      <button type="button" data-text-align="center" aria-label="Allinea al centro">≡</button>
      <button type="button" data-text-align="right" aria-label="Allinea a destra">≡</button>
    </div>
    <p class="text-help" data-text-help>Scrivi il testo, scegli lo stile e premi Prepara.</p>
    <div class="text-actions">
      <button type="button" data-text-new>Nuovo</button>
      <button type="button" data-text-apply class="primary-mini">Prepara</button>
    </div>`;
  root.querySelector('.widths')?.insertAdjacentElement('afterend', textPanel);

  const textValue = textPanel.querySelector('[data-text-value]');
  const textSize = textPanel.querySelector('[data-text-size]');
  const textFont = textPanel.querySelector('[data-text-font]');
  const textHelp = textPanel.querySelector('[data-text-help]');
  const textApply = textPanel.querySelector('[data-text-apply]');
  const boldButton = textPanel.querySelector('[data-text-bold]');
  const italicButton = textPanel.querySelector('[data-text-italic]');

  const setPressed = (button, pressed) => {
    button.setAttribute('aria-pressed', String(Boolean(pressed)));
    button.classList.toggle('active', Boolean(pressed));
  };
  const selectedAlignment = () => textPanel.querySelector('[data-text-align].active')?.dataset.textAlign || 'left';
  const readTextDraft = () => ({
    testo: textValue.value,
    colore: surface.textDraft.colore || surface.color,
    dimensioneTesto: Number(textSize.value),
    carattere: textFont.value,
    grassetto: boldButton.getAttribute('aria-pressed') === 'true',
    corsivo: italicButton.getAttribute('aria-pressed') === 'true',
    allineamento: selectedAlignment(),
  });
  const fillTextPanel = (element = surface.textDraft) => {
    textValue.value = element.testo || '';
    textSize.value = String(element.dimensioneTesto || Math.max(16, (element.spessore || 6) * 4));
    if (!textSize.value) textSize.value = '24';
    textFont.value = TEXT_FONTS[element.carattere] ? element.carattere : 'sans';
    setPressed(boldButton, element.grassetto);
    setPressed(italicButton, element.corsivo);
    textPanel.querySelectorAll('[data-text-align]').forEach((button) => button.classList.toggle('active', button.dataset.textAlign === (element.allineamento || 'left')));
    if (element.colore) {
      surface.setColor(element.colore);
      root.querySelectorAll('[data-color]').forEach((button) => button.classList.toggle('active', button.dataset.color === element.colore));
    }
  };
  const prepareNewText = () => {
    surface.selectedId = null;
    textValue.value = '';
    surface.setTextDraft(readTextDraft());
    surface.render();
    textApply.textContent = 'Prepara';
    textHelp.textContent = 'Scrivi il testo, scegli lo stile e premi Prepara.';
    textValue.focus();
  };

  surface.onTextRequired = () => {
    textPanel.hidden = false;
    textHelp.textContent = 'Prima scrivi il testo nel pannello e premi Prepara.';
    textValue.focus();
  };
  surface.onTextSelection = (element) => {
    fillTextPanel(element);
    textApply.textContent = 'Applica';
    textHelp.textContent = 'Modifica le opzioni e premi Applica. Trascina il testo per spostarlo.';
  };

  textPanel.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-text-bold')) setPressed(button, button.getAttribute('aria-pressed') !== 'true');
    else if (button.hasAttribute('data-text-italic')) setPressed(button, button.getAttribute('aria-pressed') !== 'true');
    else if (button.dataset.textAlign) {
      textPanel.querySelectorAll('[data-text-align]').forEach((item) => item.classList.toggle('active', item === button));
    } else if (button.hasAttribute('data-text-new')) {
      prepareNewText();
      return;
    } else if (button.hasAttribute('data-text-apply')) {
      const draft = readTextDraft();
      if (!draft.testo.trim()) {
        textHelp.textContent = 'Scrivi prima il testo da inserire.';
        textValue.focus();
        return;
      }
      surface.setTextDraft(draft);
      if (surface.updateSelectedText(draft)) {
        textHelp.textContent = 'Modifiche applicate. Puoi trascinare il testo sulla pagina.';
      } else {
        textHelp.textContent = 'Ora tocca il punto della pagina in cui vuoi inserire il testo.';
      }
      return;
    }
    surface.setTextDraft(readTextDraft());
  });
  textPanel.addEventListener('change', () => surface.setTextDraft(readTextDraft()));

  root.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.tool) {
      root.querySelectorAll('[data-tool]').forEach((item) => item.classList.toggle('active', item === button));
      surface.setTool(button.dataset.tool);
      // niente pannello di scrittura laterale: il testo si scrive in-place sul foglio
      textPanel.hidden = true;
      root.classList.remove('text-tool-active');
    } else if (button.dataset.color) {
      root.querySelectorAll('[data-color]').forEach((item) => item.classList.toggle('active', item === button));
      surface.setColor(button.dataset.color);
      if (!textPanel.hidden) surface.setTextDraft(readTextDraft());
    } else if (button.dataset.width) {
      root.querySelectorAll('[data-width]').forEach((item) => item.classList.toggle('active', item === button));
      surface.setWidth(Number(button.dataset.width));
    } else if (button.hasAttribute('data-undo')) surface.undo();
    else if (button.hasAttribute('data-redo')) surface.redo();
  });
  root.querySelector('[data-readonly]')?.addEventListener('change', (event) => surface.setReadOnly(event.target.checked));
}
