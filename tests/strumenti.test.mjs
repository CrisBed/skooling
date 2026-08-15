import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePoint, hitTestElement, HistoryStack, makePdfFromJpegs, drawElement, DrawingSurface } from '../strumenti.js';

function makeCanvas() {
  const context = {
    clearRect() {}, save() {}, restore() {}, setLineDash() {}, strokeRect() {}, fillRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    measureText(value) { return { width: value.length * 8 }; }, fillText() {},
  };
  return {
    width: 1000, height: 1000,
    getContext() { return context; },
    addEventListener() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 1000 }; },
    setPointerCapture() {},
  };
}

test('le coordinate diventano relative alla superficie', () => {
  assert.deepEqual(
    normalizePoint({ clientX: 110, clientY: 70, pressure: 0.6, tiltX: 12, tiltY: -4 }, { left: 10, top: 20, width: 200, height: 100 }),
    { x: 0.5, y: 0.5, pressure: 0.6, tiltX: 12, tiltY: -4 },
  );
});

test('la gomma riconosce un tratto vicino e ignora quello lontano', () => {
  const stroke = { tipo: 'penna', punti: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }] };
  assert.equal(hitTestElement(stroke, { x: 0.5, y: 0.51 }, 0.03), true);
  assert.equal(hitTestElement(stroke, { x: 0.1, y: 0.8 }, 0.03), false);
});

test('la gomma riconosce forme e caselle di testo', () => {
  assert.equal(hitTestElement({ tipo: 'rettangolo', x1: 0.2, y1: 0.2, x2: 0.6, y2: 0.6 }, { x: 0.2, y: 0.4 }, 0.03), true);
  assert.equal(hitTestElement({ tipo: 'testo', x: 0.2, y: 0.2, w: 0.4, h: 0.2 }, { x: 0.3, y: 0.3 }, 0.01), true);
});

test('la cronologia conserva almeno venti operazioni e scarta il futuro dopo una modifica', () => {
  const history = new HistoryStack(20);
  for (let index = 0; index < 25; index += 1) history.push([{ id: index }]);
  assert.equal(history.undo().at(0).id, 23);
  history.push([{ id: 99 }]);
  assert.equal(history.redo(), null);
});

test('il generatore produce un PDF leggibile con una pagina JPEG', () => {
  const tinyJpeg = '/9j/2Q==';
  const pdf = makePdfFromJpegs([{ bytes: Uint8Array.from(atob(tinyJpeg), (c) => c.charCodeAt(0)), width: 1, height: 1 }]);
  assert.equal(new TextDecoder().decode(pdf.slice(0, 8)), '%PDF-1.4');
  assert.match(new TextDecoder().decode(pdf.slice(-32)), /%%EOF/);
});

test('il testo usa dimensione, carattere, stile e allineamento scelti', () => {
  const calls = [];
  const context = {
    save() {}, restore() {}, setLineDash() {}, strokeRect() {}, fillRect() {},
    measureText(value) { return { width: value.length * 8 }; },
    fillText(value, x, y) { calls.push({ value, x, y, font: this.font, align: this.textAlign }); },
  };

  drawElement(context, {
    tipo: 'testo', testo: 'Titolo', x: 0.1, y: 0.2, w: 0.5, h: 0.2,
    colore: '#db3a34', dimensioneTesto: 42, carattere: 'serif',
    grassetto: true, corsivo: true, allineamento: 'center',
  }, 1000, 1000);

  assert.equal(calls[0].font, 'italic 700 42px Georgia, "Times New Roman", serif');
  assert.equal(calls[0].align, 'center');
  assert.equal(calls[0].x, 350);
});

test('toccando un punto vuoto col testo si crea la casella lì, col colore e la grandezza scelti', () => {
  const surface = new DrawingSurface(makeCanvas());
  surface.setTool('testo');
  surface.setColor('#8b5cf6');
  surface.setWidth(10);

  surface.pointerDown({
    pointerId: 1, pointerType: 'mouse', clientX: 200, clientY: 300,
    pressure: 0.5, preventDefault() {},
  });

  assert.equal(surface.elements.length, 1);
  const el = surface.elements[0];
  assert.equal(el.tipo, 'testo');
  assert.equal(el.testo, ''); // vuota: la si scrive nella casella in-place
  assert.equal(el.x, 0.2);
  assert.equal(el.y, 0.3);
  assert.equal(el.colore, '#8b5cf6');
  assert.equal(el.dimensioneTesto, 60); // spessore grande -> testo grande
});

test('il testo selezionato può essere riscritto e riformattato', () => {
  const surface = new DrawingSurface(makeCanvas());
  surface.elements = [{
    id: 'testo-1', tipo: 'testo', testo: 'Prima', x: 0.1, y: 0.1, w: 0.4, h: 0.2,
    colore: '#2457d6', dimensioneTesto: 24, carattere: 'sans',
    grassetto: false, corsivo: false, allineamento: 'left', timestamp: 1,
  }];
  surface.history.reset(surface.elements);
  surface.selectedId = 'testo-1';

  const updated = surface.updateSelectedText?.({
    testo: 'Dopo', colore: '#15956d', dimensioneTesto: 42, carattere: 'serif',
    grassetto: true, corsivo: true, allineamento: 'center',
  });

  assert.equal(updated, true);
  assert.deepEqual(
    {
      testo: surface.elements[0].testo, colore: surface.elements[0].colore,
      dimensioneTesto: surface.elements[0].dimensioneTesto, carattere: surface.elements[0].carattere,
      grassetto: surface.elements[0].grassetto, corsivo: surface.elements[0].corsivo,
      allineamento: surface.elements[0].allineamento,
    },
    {
      testo: 'Dopo', colore: '#15956d', dimensioneTesto: 42, carattere: 'serif',
      grassetto: true, corsivo: true, allineamento: 'center',
    },
  );
});

test('una casella di testo creata vicino al bordo resta dentro la pagina', () => {
  const surface = new DrawingSurface(makeCanvas());
  surface.setTool('testo');

  surface.pointerDown({
    pointerId: 2, pointerType: 'mouse', clientX: 990, clientY: 990,
    pressure: 0.5, preventDefault() {},
  });

  assert.equal(surface.elements[0].x, 0.92);
  assert.equal(surface.elements[0].y, 0.94);
});

test('la gomma divide un tratto a penna senza cancellarlo interamente', () => {
  const surface = new DrawingSurface(makeCanvas());
  surface.elements = [{
    id: 'tratto-1', tipo: 'penna', colore: '#2457d6', spessore: 5, timestamp: 1,
    punti: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }],
  }];
  surface.history.reset(surface.elements);
  surface.setTool('gomma');
  surface.setWidth(10);

  surface.pointerDown({
    pointerId: 3, pointerType: 'mouse', clientX: 500, clientY: 500,
    pressure: 0.5, preventDefault() {},
  });

  assert.equal(surface.elements.length, 2);
  assert.ok(surface.elements[0].punti.at(-1).x < 0.5);
  assert.ok(surface.elements[1].punti[0].x > 0.5);
});

test('la gomma apre un vuoto nella sottolineatura', () => {
  const surface = new DrawingSurface(makeCanvas());
  surface.elements = [{
    id: 'sotto-1', tipo: 'sottolineatura', colore: '#db3a34', spessore: 5,
    x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5, timestamp: 1,
  }];
  surface.history.reset(surface.elements);
  surface.setTool('gomma');
  surface.setWidth(10);

  surface.pointerDown({
    pointerId: 4, pointerType: 'mouse', clientX: 500, clientY: 500,
    pressure: 0.5, preventDefault() {},
  });

  assert.equal(surface.elements.length, 2);
  assert.ok(surface.elements[0].x2 < 0.5);
  assert.ok(surface.elements[1].x1 > 0.5);
});

test('trascinando la gomma viene cancellato tutto il percorso attraversato', async () => {
  const changes = [];
  const surface = new DrawingSurface(makeCanvas(), { onChange: (elements) => changes.push(elements) });
  surface.elements = [{
    id: 'tratto-lungo', tipo: 'penna', colore: '#2457d6', spessore: 5, timestamp: 1,
    punti: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }],
  }];
  surface.history.reset(surface.elements);
  surface.setTool('gomma');
  surface.setWidth(5);
  const event = (clientX) => ({
    pointerId: 5, pointerType: 'mouse', clientX, clientY: 500,
    pressure: 0.5, preventDefault() {},
  });

  surface.pointerDown(event(300));
  surface.pointerMove(event(700));
  surface.pointerUp(event(700));
  await Promise.resolve();

  const remainingX = surface.elements.flatMap((element) => element.punti.map((point) => point.x));
  assert.equal(remainingX.some((x) => x > 0.35 && x < 0.65), false);
  assert.equal(changes.length, 1);
});
