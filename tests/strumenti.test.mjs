import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePoint, hitTestElement, HistoryStack, makePdfFromJpegs, drawElement, DrawingSurface, creaGestoCondiviso, creaRilevatoreSwipe } from '../strumenti.js';

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

function tocco(pointerId, clientX, clientY) {
  return { pointerId, pointerType: 'touch', clientX, clientY, pressure: 0.5, preventDefault() {} };
}

test('nel quaderno un dito scrive, il secondo dito annulla il segno e diventa gesto', () => {
  const fasi = [];
  const surface = new DrawingSurface(makeCanvas(), { onTouchGesture: (fase) => fasi.push(fase) });
  surface.setDrawWithFinger(true);
  surface.setTool('penna');

  surface.pointerDown(tocco(1, 100, 100));
  surface.pointerMove(tocco(1, 200, 200));
  assert.equal(surface.elements.length, 1, 'con un dito solo si scrive');

  surface.pointerDown(tocco(2, 400, 400));
  assert.equal(surface.elements.length, 0, 'il segno appena iniziato viene tolto');
  assert.equal(surface.gesto.attivo, true);
  assert.deepEqual(fasi, ['start']);

  surface.pointerMove(tocco(2, 500, 500));
  assert.equal(surface.elements.length, 0, 'muovendo due dita non si disegna');
  assert.deepEqual(fasi, ['start', 'move']);
});

test('finché resta a terra un dito del gesto non si torna a scrivere', () => {
  const surface = new DrawingSurface(makeCanvas(), { onTouchGesture: () => {} });
  surface.setDrawWithFinger(true);
  surface.setTool('penna');

  surface.pointerDown(tocco(1, 100, 100));
  surface.pointerDown(tocco(2, 400, 400));
  surface.pointerUp(tocco(2, 400, 400));
  surface.pointerMove(tocco(1, 300, 300));
  assert.equal(surface.elements.length, 0, 'il dito rimasto non riprende a disegnare');
  assert.equal(surface.gesto.attivo, true);

  surface.pointerUp(tocco(1, 300, 300));
  assert.equal(surface.gesto.attivo, false, 'alzate tutte le dita il gesto finisce');

  surface.pointerDown(tocco(3, 120, 120));
  surface.pointerMove(tocco(3, 220, 220));
  assert.equal(surface.elements.length, 1, 'dopo il gesto si torna a scrivere');
});

test('due fogli affiancati contano le dita insieme', () => {
  const gesto = creaGestoCondiviso();
  const fasi = [];
  const sinistro = new DrawingSurface(makeCanvas(), { gesto, onTouchGesture: (fase) => fasi.push(fase) });
  const destro = new DrawingSurface(makeCanvas(), { gesto, onTouchGesture: (fase) => fasi.push(fase) });
  for (const foglio of [sinistro, destro]) { foglio.setDrawWithFinger(true); foglio.setTool('penna'); }

  sinistro.pointerDown(tocco(1, 100, 100));
  sinistro.pointerMove(tocco(1, 200, 200));
  assert.equal(sinistro.elements.length, 1);

  // il secondo dito cade sull'altro foglio: è comunque un gesto solo
  destro.pointerDown(tocco(2, 300, 300));
  assert.equal(sinistro.elements.length, 0, 'il segno sul foglio di sinistra viene tolto');
  assert.equal(destro.elements.length, 0);
  assert.equal(gesto.attivo, true);
  assert.deepEqual(fasi, ['start']);
});

test('la gomma interrotta dal secondo dito non lascia cancellature a metà', () => {
  const surface = new DrawingSurface(makeCanvas(), { onTouchGesture: () => {} });
  surface.setDrawWithFinger(true);
  surface.setElements([{ id: 'segno-1', tipo: 'penna', colore: '#000', spessore: 5, punti: [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }] }]);
  surface.setTool('gomma');

  surface.pointerDown(tocco(1, 500, 100));
  assert.notEqual(surface.elements.length, 1, 'la gomma ha già spezzato il tratto');

  surface.pointerDown(tocco(2, 200, 800));
  assert.equal(surface.elements.length, 1, 'il tratto torna intero');
  assert.equal(surface.elements[0].id, 'segno-1');
});

// ---- Sfioramento orizzontale per cambiare pagina ---------------------------

function dita(...punti) {
  return new Map(punti.map((punto, indice) => [indice + 1, punto]));
}

// Riproduce un gesto: le dita partono da `da`, si spostano di `dx`/`dy` in
// `durata` millisecondi e si staccano. Risponde come il rilevatore.
function gesto(rilevatore, { da, dx, dy = 0, durata = 200, apertura = 0, orologio }) {
  const arrivo = da.map((punto, indice) => ({
    x: punto.x + (Array.isArray(dx) ? dx[indice] : dx) + (indice === 1 ? apertura : 0),
    y: punto.y + dy,
  }));
  rilevatore.inizio(dita(...da));
  orologio.valore += durata;
  rilevatore.muovi(dita(...arrivo));
  return rilevatore.fine(dita(...arrivo));
}

function conOrologio() {
  const orologio = { valore: 0 };
  return { orologio, rilevatore: creaRilevatoreSwipe({ adesso: () => orologio.valore }) };
}

test('uno sfioramento netto verso sinistra manda alla pagina successiva', () => {
  const { rilevatore, orologio } = conOrologio();
  assert.equal(gesto(rilevatore, { da: [{ x: 500, y: 400 }], dx: -160, orologio }), 1);
});

test('uno sfioramento netto verso destra torna alla pagina precedente', () => {
  const { rilevatore, orologio } = conOrologio();
  assert.equal(gesto(rilevatore, { da: [{ x: 300, y: 400 }], dx: 160, orologio }), -1);
});

test('un segno corto di penna non fa cambiare pagina', () => {
  const { rilevatore, orologio } = conOrologio();
  assert.equal(gesto(rilevatore, { da: [{ x: 500, y: 400 }], dx: -30, orologio }), 0);
});

test('un movimento in su o in diagonale non fa cambiare pagina', () => {
  const { rilevatore, orologio } = conOrologio();
  assert.equal(gesto(rilevatore, { da: [{ x: 500, y: 600 }], dx: 0, dy: -200, orologio }), 0);
  assert.equal(gesto(rilevatore, { da: [{ x: 500, y: 600 }], dx: -150, dy: -140, orologio }), 0);
});

test('uno spostamento lento non è uno sfioramento', () => {
  const { rilevatore, orologio } = conOrologio();
  assert.equal(gesto(rilevatore, { da: [{ x: 500, y: 400 }], dx: -200, durata: 1400, orologio }), 0);
});

test('due dita che vanno insieme di lato cambiano pagina', () => {
  const { rilevatore, orologio } = conOrologio();
  assert.equal(gesto(rilevatore, { da: [{ x: 500, y: 400 }, { x: 620, y: 430 }], dx: -170, orologio }), 1);
});

test('due dita che si aprono ingrandiscono e non cambiano pagina', () => {
  const { rilevatore, orologio } = conOrologio();
  assert.equal(gesto(rilevatore, { da: [{ x: 500, y: 400 }, { x: 620, y: 400 }], dx: -150, apertura: 200, orologio }), 0);
});

test('due dita che vanno in versi opposti non cambiano pagina', () => {
  const { rilevatore, orologio } = conOrologio();
  assert.equal(gesto(rilevatore, { da: [{ x: 400, y: 400 }, { x: 700, y: 400 }], dx: [-150, 150], orologio }), 0);
});

test('un dito che si stacca senza che il gesto sia cominciato non cambia pagina', () => {
  const { rilevatore } = conOrologio();
  assert.equal(rilevatore.fine(dita({ x: 500, y: 400 })), 0);
});

test('annullare il gesto in corso spegne lo sfioramento', () => {
  const { rilevatore, orologio } = conOrologio();
  rilevatore.inizio(dita({ x: 500, y: 400 }));
  orologio.valore += 150;
  rilevatore.muovi(dita({ x: 320, y: 400 }));
  rilevatore.annulla();
  assert.equal(rilevatore.fine(dita({ x: 320, y: 400 })), 0);
});

// Sul dispositivo vero il movimento di ogni dito arriva in un evento suo: fra
// un evento e l'altro le due dita risultano più distanti o più vicine di
// quanto siano davvero. Uno sfioramento a due dita deve passare comunque.
test('due dita che si spostano una per volta cambiano pagina', () => {
  const { rilevatore, orologio } = conOrologio();
  let primo = { x: 700, y: 400 };
  let secondo = { x: 790, y: 400 };
  rilevatore.inizio(dita(primo, secondo));
  for (let passo = 1; passo <= 6; passo += 1) {
    const x = 700 - 320 * passo / 6;
    primo = { x, y: 400 };
    rilevatore.muovi(dita(primo, secondo)); // si muove solo il primo dito
    secondo = { x: x + 90, y: 400 };
    rilevatore.muovi(dita(primo, secondo)); // poi il secondo raggiunge
    orologio.valore += 18;
  }
  assert.equal(rilevatore.fine(dita(primo, secondo)), 1);
});

test('due dita che si aprono e tornano vicine non cambiano pagina', () => {
  const { rilevatore, orologio } = conOrologio();
  rilevatore.inizio(dita({ x: 500, y: 400 }, { x: 600, y: 400 }));
  orologio.valore += 80;
  rilevatore.muovi(dita({ x: 380, y: 400 }, { x: 900, y: 400 })); // si spalancano
  orologio.valore += 80;
  rilevatore.muovi(dita({ x: 300, y: 400 }, { x: 400, y: 400 })); // e tornano vicine
  assert.equal(rilevatore.fine(dita({ x: 300, y: 400 }, { x: 400, y: 400 })), 0);
});
