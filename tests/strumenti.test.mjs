import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePoint, hitTestElement, HistoryStack, makePdfFromJpegs, drawElement, DrawingSurface, creaGestoCondiviso, creaRilevatoreSwipe, spostaElemento, riquadroElemento, ditaAppoggiate, disegnaElementi, INGROSSO_EVIDENZIATORE, TINTA_EVIDENZIATORE, risoluzioneAmmessa, PIXEL_MASSIMI, maniglieElemento, maniglieSotto, bordiTrascinando, ridimensionaElemento } from '../strumenti.js';

function makeCanvas() {
  const context = {
    clearRect() {}, save() {}, restore() {}, setLineDash() {}, strokeRect() {}, fillRect() {},
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    ellipse() {}, arc() {}, bezierCurveTo() {}, rect() {}, translate() {}, rotate() {}, drawImage() {},
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
  // Misura e stile vengono dai comandi dell'astuccio, non piu' dallo spessore
  // della penna: prima erano tre misure fisse e nessun modo di cambiarle.
  surface.setTextDraft({ dimensioneTesto: 40, grassetto: true, corsivo: true });

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
  assert.equal(el.dimensioneTesto, 40);
  assert.equal(el.grassetto, true);
  assert.equal(el.corsivo, true);
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

// ---- Spostare una figura o un testo gia' sul foglio ------------------------

test('un tratto a mano libera si sposta tutto intero, senza cambiare forma', () => {
  const originale = { tipo: 'penna', punti: [{ x: 0.2, y: 0.2, pressure: 0.4 }, { x: 0.4, y: 0.5, pressure: 0.7 }] };
  const spostato = spostaElemento(structuredClone(originale), originale, 0.1, -0.05);
  assert.deepEqual(spostato.punti.map((p) => [+p.x.toFixed(3), +p.y.toFixed(3)]), [[0.3, 0.15], [0.5, 0.45]]);
  assert.equal(spostato.punti[1].pressure, 0.7, 'la pressione del tratto non si perde');
});

test('una figura si sposta senza cambiare misura', () => {
  const originale = { tipo: 'rettangolo', x1: 0.2, y1: 0.2, x2: 0.5, y2: 0.6 };
  const spostato = spostaElemento({ ...originale }, originale, 0.2, 0.1);
  assert.deepEqual(
    [+spostato.x1.toFixed(3), +spostato.y1.toFixed(3), +spostato.x2.toFixed(3), +spostato.y2.toFixed(3)],
    [0.4, 0.3, 0.7, 0.7],
  );
  assert.equal(+(spostato.x2 - spostato.x1).toFixed(3), +(originale.x2 - originale.x1).toFixed(3));
  assert.equal(+(spostato.y2 - spostato.y1).toFixed(3), +(originale.y2 - originale.y1).toFixed(3));
});

test('una casella di testo si sposta senza cambiare contenuto', () => {
  const originale = { tipo: 'testo', x: 0.1, y: 0.1, w: 0.3, h: 0.1, testo: 'ciao' };
  const spostato = spostaElemento({ ...originale }, originale, 0.25, 0.3);
  assert.equal(+spostato.x.toFixed(3), 0.35);
  assert.equal(+spostato.y.toFixed(3), 0.4);
  assert.equal(spostato.w, 0.3);
  assert.equal(spostato.testo, 'ciao');
});

test('lo spostamento si ferma al bordo del foglio, non lo fa uscire', () => {
  const originale = { tipo: 'rettangolo', x1: 0.6, y1: 0.1, x2: 0.9, y2: 0.3 };
  const spostato = spostaElemento({ ...originale }, originale, 0.8, -0.8);
  assert.equal(+spostato.x2.toFixed(3), 1, 'il lato destro si ferma sul bordo');
  assert.equal(+spostato.y1.toFixed(3), 0, 'il lato alto si ferma sul bordo');
  assert.equal(+(spostato.x2 - spostato.x1).toFixed(3), 0.3, 'la misura resta quella');
});

test('il riquadro di un elemento racchiude tutti i suoi punti', () => {
  assert.deepEqual(riquadroElemento({ tipo: 'penna', punti: [{ x: 0.3, y: 0.8 }, { x: 0.1, y: 0.2 }] }),
    { sinistra: 0.1, destra: 0.3, alto: 0.2, basso: 0.8 });
  assert.equal(riquadroElemento({ tipo: 'penna', punti: [] }), null);
});

test('fra i puntatori del gesto contano come dita solo quelle vere', () => {
  const puntatori = new Map([
    [1, { x: 10, y: 10, tipo: 'touch' }],
    [2, { x: 90, y: 10, tipo: 'pen' }],
    [3, { x: 50, y: 60, tipo: 'touch' }],
  ]);
  assert.equal(ditaAppoggiate(puntatori).length, 2);
  // senza il tipo si considera un dito, come nelle versioni precedenti
  assert.equal(ditaAppoggiate(new Map([[1, { x: 0, y: 0 }]])).length, 1);
});

// ---- Evidenziatore, gomma e sottolineatura --------------------------------

test('l’evidenziatore è molto più largo della penna, così copre una riga in una passata', () => {
  const larghezze = [];
  const context = {
    ...makeCanvas().getContext(), save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {},
    stroke() {}, ellipse() {}, arc() {}, translate() {}, rotate() {}, fill() {},
    set lineWidth(valore) { larghezze.push(valore); }, get lineWidth() { return 0; },
    set globalAlpha(v) {}, set strokeStyle(v) {}, set fillStyle(v) {}, set lineCap(v) {}, set lineJoin(v) {},
  };
  const tratto = { tipo: 'evidenziatore', spessore: 5, punti: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }] };
  drawElement(context, tratto, 1000, 1000);
  assert.equal(larghezze.at(-1), 5 * INGROSSO_EVIDENZIATORE);
  assert.ok(INGROSSO_EVIDENZIATORE >= 6, 'deve essere ben più spesso della penna');
});

test('gli evidenziatori si posano tutti insieme in trasparenza, una volta sola', () => {
  // È questo che impedisce al colore di scurirsi quando si ripassa.
  const registro = [];
  const foglioDiLavoro = { getContext: () => ({
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    clearRect() {}, ellipse() {}, arc() {}, translate() {}, rotate() {}, fill() {}, fillRect() {},
    set lineWidth(v) {}, set globalAlpha(v) {}, set strokeStyle(v) {}, set fillStyle(v) {},
    set lineCap(v) {}, set lineJoin(v) {},
  }) };
  const principale = {
    save() { registro.push('salva'); }, restore() { registro.push('ripristina'); },
    clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() { registro.push('tratto'); },
    ellipse() {}, arc() {}, translate() {}, rotate() {}, fill() {}, fillRect() {},
    drawImage() { registro.push('posa'); },
    set globalAlpha(valore) { if (valore !== 1) registro.push('trasparenza:' + valore); },
    set lineWidth(v) {}, set strokeStyle(v) {}, set fillStyle(v) {}, set lineCap(v) {}, set lineJoin(v) {},
  };
  const elementi = [
    { id: 'a', tipo: 'evidenziatore', spessore: 5, punti: [{ x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }] },
    { id: 'b', tipo: 'evidenziatore', spessore: 5, punti: [{ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }] },
  ];
  disegnaElementi(principale, elementi, 1000, 1000, { creaFoglio: () => foglioDiLavoro });
  assert.equal(registro.filter((v) => v === 'posa').length, 1, 'una sola posa per tutti gli evidenziatori');
  assert.ok(registro.includes('trasparenza:' + TINTA_EVIDENZIATORE), 'la trasparenza si dà alla posa, non al tratto');
  assert.equal(registro.filter((v) => v === 'tratto').length, 0, 'sul foglio principale non si traccia nessun evidenziatore');
});

test('la sottolineatura resta orizzontale anche se la mano scende', () => {
  const surface = new DrawingSurface(makeCanvas(), {});
  surface.setDrawWithFinger(true);
  surface.setTool('sottolineatura');
  surface.pointerDown({ pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 500, preventDefault() {} });
  surface.pointerMove({ pointerId: 1, pointerType: 'touch', clientX: 600, clientY: 620, preventDefault() {} });
  surface.pointerUp({ pointerId: 1, pointerType: 'touch', clientX: 600, clientY: 620, preventDefault() {} });
  const riga = surface.elements.at(-1);
  assert.equal(riga.tipo, 'sottolineatura');
  assert.equal(riga.y1, riga.y2, 'la riga sotto le parole non si inclina');
  assert.ok(riga.x2 > riga.x1, 'ma segue la mano in orizzontale');
});

test('la gomma toglie il tratto toccato e lascia stare quelli vicini', () => {
  const surface = new DrawingSurface(makeCanvas(), {});
  surface.setElements([
    { id: 'sopra', tipo: 'penna', spessore: 5, punti: [{ x: 0.2, y: 0.40 }, { x: 0.8, y: 0.40 }] },
    { id: 'mezzo', tipo: 'penna', spessore: 5, punti: [{ x: 0.2, y: 0.42 }, { x: 0.8, y: 0.42 }] },
    { id: 'sotto', tipo: 'penna', spessore: 5, punti: [{ x: 0.2, y: 0.44 }, { x: 0.8, y: 0.44 }] },
  ]);
  surface.setWidth(5);
  assert.equal(surface.eraseAt({ x: 0.5, y: 0.42 }), true, 'il tratto toccato viene inciso');
  const quote = new Set(surface.elements.map((e) => Math.round(e.punti[0].y * 100)));
  assert.ok(quote.has(40) && quote.has(44), 'i tratti vicini restano al loro posto');
});

// ---- Tetto ai pixel della tela --------------------------------------------

test('una tela piccola usa tutta la risoluzione che le spetta', () => {
  assert.equal(risoluzioneAmmessa(900, 1124, 2), 2, 'a misura naturale niente da tagliare');
  assert.equal(risoluzioneAmmessa(400, 500, 1), 1, 'non si inventa risoluzione che non è stata chiesta');
});

test('una tela grande viene tenuta sotto il tetto di pixel', () => {
  // Il foglio a ingrandimento massimo: senza tetto si arrivava a 49 milioni di
  // pixel, oltre il limite di Safari su iPad.
  const larghezza = 3150, altezza = 3934;
  const r = risoluzioneAmmessa(larghezza, altezza, 2);
  assert.ok(r < 2, 'la risoluzione viene ridotta');
  assert.ok(larghezza * r * altezza * r <= PIXEL_MASSIMI * 1.001, 'e il risultato sta sotto il tetto');
});

test('la risoluzione non scende mai sotto la metà, per non sgranare l’inchiostro', () => {
  assert.equal(risoluzioneAmmessa(20000, 20000, 2), 0.5);
});

// ---- Ridimensionare quel che è già sul foglio -----------------------------

const RETTANGOLO = { id: 'r1', tipo: 'rettangolo', x1: 0.2, y1: 0.2, x2: 0.6, y2: 0.5 };

test('un elemento scelto mostra quattro maniglie, una per angolo', () => {
  const maniglie = maniglieElemento(RETTANGOLO);
  assert.equal(maniglie.length, 4);
  assert.deepEqual(maniglie.map((m) => m.angolo).sort(),
    ['alto-destra', 'alto-sinistra', 'basso-destra', 'basso-sinistra']);
  const bassoDestra = maniglie.find((m) => m.angolo === 'basso-destra');
  assert.deepEqual([bassoDestra.x, bassoDestra.y], [0.6, 0.5]);
});

test('si riconosce la maniglia che si sta toccando, non quelle lontane', () => {
  assert.equal(maniglieSotto(RETTANGOLO, { x: 0.605, y: 0.505 })?.angolo, 'basso-destra');
  assert.equal(maniglieSotto(RETTANGOLO, { x: 0.2, y: 0.2 })?.angolo, 'alto-sinistra');
  assert.equal(maniglieSotto(RETTANGOLO, { x: 0.4, y: 0.35 }), null, 'in mezzo non c’è nessuna maniglia');
});

test('tirando una maniglia l’angolo opposto resta fermo', () => {
  const bordi = { sinistra: 0.2, destra: 0.6, alto: 0.2, basso: 0.5 };
  const nuovi = bordiTrascinando(bordi, 'basso-destra', { x: 0.8, y: 0.7 });
  assert.deepEqual([nuovi.sinistra, nuovi.alto], [0.2, 0.2], 'l’angolo in alto a sinistra non si muove');
  assert.deepEqual([nuovi.destra, nuovi.basso], [0.8, 0.7]);
  const daSopra = bordiTrascinando(bordi, 'alto-sinistra', { x: 0.1, y: 0.05 });
  assert.deepEqual([daSopra.destra, daSopra.basso], [0.6, 0.5], 'tirando dall’altro angolo resta fermo quello in basso a destra');
});

test('un elemento non si può rimpicciolire fino a sparire né uscire dal foglio', () => {
  const bordi = { sinistra: 0.2, destra: 0.6, alto: 0.2, basso: 0.5 };
  const schiacciato = bordiTrascinando(bordi, 'basso-destra', { x: 0.2, y: 0.2 });
  assert.ok(schiacciato.destra - schiacciato.sinistra >= 0.029, 'resta una larghezza minima');
  assert.ok(schiacciato.basso - schiacciato.alto >= 0.029, 'e una altezza minima');
  const fuori = bordiTrascinando(bordi, 'basso-destra', { x: 1.8, y: 1.9 });
  assert.deepEqual([fuori.destra, fuori.basso], [1, 1], 'non si esce dal foglio');
});

test('ridimensionando una figura le proporzioni seguono i bordi nuovi', () => {
  const nuovo = ridimensionaElemento({ ...RETTANGOLO }, RETTANGOLO,
    { sinistra: 0.2, destra: 1.0, alto: 0.2, basso: 0.8 });
  assert.equal(+(nuovo.x2 - nuovo.x1).toFixed(3), 0.8, 'larghezza raddoppiata');
  assert.equal(+(nuovo.y2 - nuovo.y1).toFixed(3), 0.6, 'altezza raddoppiata');
  assert.deepEqual([+nuovo.x1.toFixed(3), +nuovo.y1.toFixed(3)], [0.2, 0.2], 'l’angolo fermo è rimasto fermo');
});

test('ridimensionando un tratto a mano libera ogni punto segue in proporzione', () => {
  const tratto = { id: 't', tipo: 'penna', punti: [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.6 }, { x: 0.6, y: 0.4 }] };
  const nuovo = ridimensionaElemento(structuredClone(tratto), tratto,
    { sinistra: 0.2, destra: 1.0, alto: 0.2, basso: 0.6 });
  // il punto di mezzo stava a metà larghezza: ci resta
  assert.equal(+nuovo.punti[1].x.toFixed(3), 0.6);
  assert.equal(+nuovo.punti[0].x.toFixed(3), 0.2, 'il primo punto è sull’angolo fermo');
  assert.equal(+nuovo.punti[2].x.toFixed(3), 1.0);
});

test('una casella di testo cambia misura, un simbolo musicale cresce uguale nei due versi', () => {
  const casella = { id: 'c', tipo: 'testo', x: 0.2, y: 0.2, w: 0.3, h: 0.1, testo: 'ciao' };
  const grande = ridimensionaElemento({ ...casella }, casella, { sinistra: 0.2, destra: 0.8, alto: 0.2, basso: 0.4 });
  assert.equal(+grande.w.toFixed(3), 0.6, 'la casella raddoppia in larghezza');
  assert.equal(grande.testo, 'ciao', 'il contenuto non cambia');

  const nota = { id: 'n', tipo: 'simbolo', segno: 'semiminima', x: 0.5, y: 0.5, unita: 0.016 };
  const bordi = { sinistra: 0.4, destra: 0.6, alto: 0.3, basso: 0.7 };
  const cresciuta = ridimensionaElemento({ ...nota }, nota,
    { sinistra: bordi.sinistra, destra: bordi.sinistra + (bordi.destra - bordi.sinistra) * 2,
      alto: bordi.alto, basso: bordi.alto + (bordi.basso - bordi.alto) * 2 });
  assert.ok(cresciuta.unita > nota.unita, 'il simbolo diventa più grande');
  assert.equal(cresciuta.segno, 'semiminima', 'e resta lo stesso segno');
});

test('una sottolineatura piatta si sposta senza schiacciarsi', () => {
  const riga = { id: 'l', tipo: 'sottolineatura', x1: 0.2, y1: 0.5, x2: 0.6, y2: 0.5 };
  const nuovo = ridimensionaElemento({ ...riga }, riga, { sinistra: 0.2, destra: 1.0, alto: 0.3, basso: 0.3 });
  assert.equal(+(nuovo.x2 - nuovo.x1).toFixed(3), 0.8, 'si allunga');
  assert.equal(nuovo.y1, nuovo.y2, 'e resta dritta');
});

// ---- Gomma sulle forme geometriche ---------------------------------------
// Prima la gomma toglieva l'intera figura al primo tocco, perche' un cerchio e'
// un oggetto solo. Ora la figura toccata viene riscritta nei tratti che la
// disegnano e si cancella a pezzi come un segno di penna.

function fogliaConGomma(elements, larghezza = 10) {
  const surface = new DrawingSurface(makeCanvas());
  surface.elements = elements;
  surface.history.reset(surface.elements);
  surface.setTool('gomma');
  surface.setWidth(larghezza);
  return surface;
}

function tocca(surface, clientX, clientY, pointerId = 90) {
  surface.pointerDown({ pointerId, pointerType: 'mouse', clientX, clientY, pressure: 0.5, preventDefault() {} });
}

test('la gomma apre un varco nel cerchio e lascia in piedi il resto', () => {
  const surface = fogliaConGomma([{
    id: 'cerchio-1', tipo: 'cerchio', colore: '#db3a34', spessore: 5, timestamp: 1,
    x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.8,
  }]);

  // il punto piu' a destra del cerchio: x = 0.8, y = 0.5
  tocca(surface, 800, 500);

  assert.ok(surface.elements.length >= 1, 'il cerchio non sparisce tutto');
  assert.ok(surface.elements.every((element) => element.tipo === 'penna'), 'quel che resta e’ fatto di tratti');
  const punti = surface.elements.flatMap((element) => element.punti);
  assert.ok(punti.length > 40, 'resta quasi tutta la circonferenza');
  // nel varco non c'e' piu' niente
  assert.equal(punti.some((punto) => Math.hypot(punto.x - 0.8, punto.y - 0.5) < 0.012), false);
  // il lato opposto e' intatto
  assert.equal(punti.some((punto) => Math.hypot(punto.x - 0.2, punto.y - 0.5) < 0.01), true);
});

test('la gomma dentro al cerchio non lo tocca: si cancella il bordo, non l’aria', () => {
  const cerchio = {
    id: 'cerchio-2', tipo: 'cerchio', colore: '#db3a34', spessore: 5, timestamp: 1,
    x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.8,
  };
  const surface = fogliaConGomma([cerchio]);

  tocca(surface, 500, 500); // il centro, dove non c'e' inchiostro

  assert.deepEqual(surface.elements, [cerchio], 'il cerchio resta l’oggetto intero che era');
});

test('del quadrato si toglie solo il lato toccato', () => {
  const surface = fogliaConGomma([{
    id: 'quadrato-1', tipo: 'rettangolo', colore: '#1f2937', spessore: 5, timestamp: 1,
    x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.8,
  }]);

  tocca(surface, 500, 200); // in mezzo al lato di sopra

  const punti = surface.elements.flatMap((element) => element.punti);
  assert.equal(punti.some((punto) => Math.abs(punto.y - 0.2) < 0.005 && Math.abs(punto.x - 0.5) < 0.012), false, 'il varco e’ aperto');
  for (const angolo of [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]) {
    assert.ok(
      punti.some((punto) => Math.hypot(punto.x - angolo[0], punto.y - angolo[1]) < 0.01),
      `l’angolo ${angolo} resta al suo posto`,
    );
  }
});

test('della freccia si toglie l’asta e la punta resta', () => {
  const surface = fogliaConGomma([{
    id: 'freccia-1', tipo: 'freccia', colore: '#15956d', spessore: 5, timestamp: 1,
    x1: 0.1, y1: 0.5, x2: 0.9, y2: 0.5,
  }]);

  tocca(surface, 400, 500); // sull'asta, lontano dalla punta

  const puntiVicinoAllaPunta = surface.elements
    .flatMap((element) => element.punti)
    .filter((punto) => punto.x > 0.86);
  assert.ok(puntiVicinoAllaPunta.length >= 3, 'le due barbe della punta sono ancora li’');
  const nelVarco = surface.elements
    .flatMap((element) => element.punti)
    .some((punto) => Math.abs(punto.x - 0.4) < 0.012 && Math.abs(punto.y - 0.5) < 0.012);
  assert.equal(nelVarco, false);
});

test('la riga si spezza in due invece di sparire', () => {
  const surface = fogliaConGomma([{
    id: 'riga-1', tipo: 'linea', colore: '#2457d6', spessore: 5, timestamp: 1,
    x1: 0.1, y1: 0.3, x2: 0.9, y2: 0.3,
  }]);

  tocca(surface, 500, 300);

  assert.equal(surface.elements.length, 2);
  assert.ok(surface.elements[0].punti.at(-1).x < 0.5);
  assert.ok(surface.elements[1].punti[0].x > 0.5);
});

test('quel che resta di una forma tagliata tiene colore e spessore', () => {
  const surface = fogliaConGomma([{
    id: 'cerchio-3', tipo: 'cerchio', colore: '#f0b429', spessore: 10, timestamp: 7,
    x1: 0.2, y1: 0.2, x2: 0.8, y2: 0.8,
  }]);

  tocca(surface, 800, 500);

  for (const element of surface.elements) {
    assert.equal(element.colore, '#f0b429');
    assert.equal(element.spessore, 10);
  }
});

// ---- Dimensione, grassetto e corsivo del testo ----------------------------

test('i comandi del testo cambiano la casella scelta senza toccare quel che c’e’ scritto', () => {
  const surface = new DrawingSurface(makeCanvas());
  surface.elements = [{
    id: 'testo-9', tipo: 'testo', testo: 'Compito di storia', x: 0.1, y: 0.1, w: 0.4, h: 0.2,
    colore: '#2457d6', dimensioneTesto: 24, carattere: 'sans',
    grassetto: false, corsivo: false, allineamento: 'left', timestamp: 1,
  }];
  surface.history.reset(surface.elements);
  surface.selectedId = 'testo-9';

  assert.equal(surface.applicaStileTesto({ dimensioneTesto: 56, grassetto: true }), true);

  const el = surface.elements[0];
  assert.equal(el.testo, 'Compito di storia');
  assert.equal(el.dimensioneTesto, 56);
  assert.equal(el.grassetto, true);
  assert.equal(el.corsivo, false, 'quel che non si passa non si tocca');
});

test('senza casella scelta i comandi del testo non hanno su cosa agire', () => {
  const surface = new DrawingSurface(makeCanvas());
  surface.elements = [{ id: 'tratto', tipo: 'penna', punti: [{ x: 0.1, y: 0.1 }], colore: '#000', spessore: 2 }];
  surface.history.reset(surface.elements);

  assert.equal(surface.applicaStileTesto({ dimensioneTesto: 56 }), false);
  assert.equal(surface.testoCorrente(), null);
});

test('il testo disegnato segue grassetto e corsivo della casella', () => {
  const scritte = [];
  const context = {
    save() {}, restore() {}, setLineDash() {}, strokeRect() {}, fillRect() {},
    measureText(value) { return { width: value.length * 8 }; },
    fillText(value) { scritte.push(this.font); },
  };
  drawElement(context, {
    tipo: 'testo', testo: 'Ciao', x: 0.1, y: 0.1, w: 0.5, h: 0.2,
    dimensioneTesto: 40, carattere: 'serif', grassetto: true, corsivo: true, allineamento: 'left',
  }, 1000, 1000);
  assert.match(scritte[0], /^italic 700 40px/);
});
