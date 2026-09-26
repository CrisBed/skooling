import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ORIENTAMENTI, orientamentoNuovaPagina, orientamentoPagina, misuraEsportazione, righiInteri, TIPI_FOGLIO } from '../quaderni.js';
import { riquadroElemento, ridimensionaElemento } from '../strumenti.js';

// Richiesta di Gabriel (26/09/2026): il foglio a pentagramma e' ORIZZONTALE,
// cosi' ogni rigo corre sul lato lungo. Queste prove falliscono se torna verticale.

test('il foglio a pentagramma nasce orizzontale, gli altri restano verticali', () => {
  assert.equal(orientamentoNuovaPagina('pentagramma'), ORIENTAMENTI.orizzontale);
  for (const tipo of Object.keys(TIPI_FOGLIO).filter((nome) => nome !== 'pentagramma')) {
    assert.equal(orientamentoNuovaPagina(tipo), ORIENTAMENTI.verticale, tipo);
  }
});

test('pagine a pentagramma di prima: vuote diventano orizzontali, scritte restano verticali', () => {
  assert.equal(orientamentoPagina('pentagramma', { elementi: [] }), ORIENTAMENTI.orizzontale);
  assert.equal(orientamentoPagina('pentagramma', {}), ORIENTAMENTI.orizzontale, 'pagina senza elementi');
  const scritta = { elementi: [{ tipo: 'simbolo', segno: 'semiminima', x: 0.3, y: 0.1, unita: 0.015 }] };
  assert.equal(orientamentoPagina('pentagramma', scritta), ORIENTAMENTI.verticale);
  // una volta scritto, l'orientamento resta: il primo segno non la fa girare
  assert.equal(orientamentoPagina('pentagramma', { ...scritta, orientamento: 'orizzontale' }), ORIENTAMENTI.orizzontale);
  assert.equal(orientamentoPagina('pentagramma', { elementi: [], orientamento: 'verticale' }), ORIENTAMENTI.verticale);
  // gli altri fogli non cambiano mai
  assert.equal(orientamentoPagina('righe', { elementi: [] }), ORIENTAMENTI.verticale);
  assert.equal(orientamentoPagina('millimetrato', {}), ORIENTAMENTI.verticale);
});

test('l\'esportazione di un foglio orizzontale e\' piu\' larga che alta', () => {
  const orizzontale = misuraEsportazione(ORIENTAMENTI.orizzontale);
  const verticale = misuraEsportazione(ORIENTAMENTI.verticale);
  assert.ok(orizzontale.width > orizzontale.height);
  assert.ok(verticale.height > verticale.width);
});

test('il CSS disegna il foglio orizzontale piu\' largo che alto', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  const regola = css.match(/\.notebook-paper\.orizzontale\s*\{([^}]*)\}/);
  assert.ok(regola, 'manca la regola del foglio orizzontale');
  const [, larghezza, altezza] = regola[1].match(/aspect-ratio:\s*([\d.]+)\s*\/\s*([\d.]+)/);
  assert.ok(Number(larghezza) > Number(altezza), 'il foglio orizzontale deve avere il lato lungo in larghezza');
});

test('ogni pagina nuova di quaderno riceve il suo orientamento', async () => {
  const codice = await readFile(new URL('../quaderni.js', import.meta.url), 'utf8');
  const creazioni = codice.match(/idQuaderno: [^\n]*elementi: \[\][^\n]*/g) || [];
  assert.equal(creazioni.length, 3, 'nuovo quaderno, quaderno senza pagine, aggiungi pagina');
  for (const riga of creazioni) assert.match(riga, /orientamento: orientamentoNuovaPagina\(/);
  // la pagina vecchia riceve l'orientamento una volta e lo salva
  assert.match(codice, /page\.orientamento = orientamentoPagina\(/);
});

test('il riquadro di un simbolo usa la misura orizzontale giusta sul foglio largo', () => {
  // foglio orizzontale 1100x778: il passo del rigo, 16 px, e' 16/778 in altezza e 16/1100 in larghezza
  const segno = { tipo: 'simbolo', segno: 'semiminima', x: 0.5, y: 0.5, unita: 16 / 778, unitaX: 16 / 1100 };
  const bordi = riquadroElemento(segno);
  const vecchio = riquadroElemento({ ...segno, unitaX: undefined });
  assert.ok(bordi.destra - bordi.sinistra < vecchio.destra - vecchio.sinistra, 'piu\' stretto del calcolo con la sola altezza');
  assert.equal(bordi.alto, vecchio.alto);
  // tirato con le maniglie, cresce in proporzione nei due versi
  const grande = ridimensionaElemento({ ...segno }, segno, {
    sinistra: bordi.sinistra, alto: bordi.alto,
    destra: bordi.sinistra + (bordi.destra - bordi.sinistra) * 2, basso: bordi.alto + (bordi.basso - bordi.alto) * 2,
  });
  assert.ok(Math.abs(grande.unita / segno.unita - 2) < 1e-9);
  assert.ok(Math.abs(grande.unitaX / segno.unitaX - 2) < 1e-9);
});

test('a schermo si disegnano solo i righi interi, come nell\'esportazione', () => {
  // foglio orizzontale alto 622: righi a 15, 165, 315, 465; quello a 615 non ci sta
  assert.equal(righiInteri(622), 4);
  assert.equal(righiInteri(229), 1, 'ultima riga del secondo rigo a 229: non ci sta');
  assert.equal(righiInteri(230), 2);
  assert.equal(righiInteri(50), 0);
});
