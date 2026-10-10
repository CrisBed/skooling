import test from 'node:test';
import assert from 'node:assert/strict';
import { DrawingSurface, SurfaceGroup } from '../strumenti.js';
import * as quaderni from '../quaderni.js';

function canvas() {
  const context = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
  return { width: 1000, height: 1414, getContext: () => context, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 1414 }) };
}

test('scegliere Penna dopo Leggi sblocca davvero Apple Pencil su entrambi i fogli', () => {
  const surfaces = [new DrawingSurface(canvas()), new DrawingSurface(canvas())];
  const group = new SurfaceGroup(surfaces);
  group.setReadOnly(true);
  assert.ok(surfaces.every((s) => !s.canDraw({ pointerType: 'pen' })));
  group.setTool('penna');
  assert.ok(surfaces.every((s) => s.canDraw({ pointerType: 'pen' })));
  assert.ok(surfaces.every((s) => !s.canDraw({ pointerType: 'touch' })));
});

test('le guide nuove tengono la misura A4 anche cambiando larghezza del foglio', () => {
  assert.equal(typeof quaderni.geometriaGuide, 'function');
  for (const [tipo, mm] of [['righe', 8], ['quadretti', 5], ['millimetrato', 1]]) {
    const piccola = quaderni.geometriaGuide(tipo, 420);
    const grande = quaderni.geometriaGuide(tipo, 840);
    assert.equal(piccola.passo, mm * 2);
    assert.equal(grande.passo, piccola.passo * 2);
  }
});

test('le pagine scritte senza versione mantengono le guide vecchie, le vuote adottano A4', () => {
  assert.equal(typeof quaderni.versioneGuidePagina, 'function');
  assert.equal(quaderni.versioneGuidePagina('righe', { elementi: [{ tipo: 'penna' }] }), 1);
  assert.equal(quaderni.versioneGuidePagina('quadretti', { elementi: [] }), 2);
  assert.equal(quaderni.versioneGuidePagina('righe', { versioneGuide: 2, elementi: [{ tipo: 'penna' }] }), 2);
  assert.equal(quaderni.versioneGuidePagina('pentagramma', {}), 0);
});

test('le righe esportate hanno la stessa posizione relativa delle guide A4 a schermo', () => {
  const lines = [];
  const context = { fillRect() {}, beginPath() {}, moveTo(x, y) { this.start = [x, y]; }, lineTo(x, y) { lines.push([this.start, [x, y]]); }, stroke() {} };
  quaderni.drawPaper(context, 'righe', 1240, 1754, 420, 0, 2);
  const horizontal = lines.filter(([a, b]) => a[1] === b[1]);
  assert.ok(Math.abs(horizontal[0][0][1] / 1240 - 8 / 210) < 0.000001);
});

test('un ridimensionamento arrivato dopo la chiusura del quaderno non usa la pagina chiusa', () => {
  const wrap = { style: {}, dataset: { versioneGuide: '2' }, offsetWidth: 780 };
  assert.doesNotThrow(() => quaderni.NotebookManager.prototype.soloRighiInteri.call({ current: null }, wrap));
});

test('Foglio intero torna alla posizione in cui si stava scrivendo, anche in fondo alla pagina', () => {
  const primaDocument = globalThis.document;
  const box = { offsetWidth: 780, offsetHeight: 1103, style: {} };
  const scroll = { clientWidth: 1180, clientHeight: 568, scrollTop: 420, scrollLeft: 35 };
  const button = { textContent: '', setAttribute() {}, classList: { toggle() {} } };
  const label = { textContent: '' };
  globalThis.document = { querySelector(selector) {
    return ({ '#notebook-pages': box, '#editor-quaderno .page-scroll': scroll, '#notebook-overview': button, '#notebook-zoom': label })[selector];
  } };
  try {
    const notebook = Object.create(quaderni.NotebookManager.prototype);
    Object.assign(notebook, { overview: false, zoom: 1.8, panX: -90, panY: -130, group: new SurfaceGroup([new DrawingSurface(canvas())]) });
    notebook.toggleOverview();
    assert.equal(scroll.scrollTop, 0);
    notebook.toggleOverview();
    assert.equal(notebook.zoom, 1.8);
    assert.equal(scroll.scrollTop, 420);
    assert.equal(scroll.scrollLeft, 35);
  } finally {
    if (primaDocument === undefined) delete globalThis.document;
    else globalThis.document = primaDocument;
  }
});
