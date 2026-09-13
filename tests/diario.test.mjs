import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTENUTI_DIARIO } from '../diario-contenuti.js';
import { GIORNI_DEL_DIARIO, ETICHETTE, indiceDelGiorno, numeroDelGiorno, contenutoDelGiorno } from '../diario.js';

test('i giorni del diario sono duecentoquaranta, tutti diversi', () => {
  assert.equal(CONTENUTI_DIARIO.length, 240);
  assert.equal(GIORNI_DEL_DIARIO, 240);
  const scritti = CONTENUTI_DIARIO.map((voce) => JSON.stringify(voce));
  assert.equal(new Set(scritti).size, 240, 'due giorni identici vorrebbero dire un giorno sprecato');
});

test('ogni giorno è completo e del tipo giusto', () => {
  for (const [indice, voce] of CONTENUTI_DIARIO.entries()) {
    assert.ok(ETICHETTE[voce.t], `il giorno ${indice} ha un tipo che nessuno sa presentare: ${voce.t}`);
    if (voce.t === 'quiz') {
      assert.equal(voce.risposte.length, 3, `il quiz ${indice} non ha tre risposte`);
      assert.ok(Number.isInteger(voce.giusta) && voce.giusta >= 0 && voce.giusta < 3, `il quiz ${indice} non dice quale risposta è giusta`);
      assert.equal(new Set(voce.risposte).size, 3, `il quiz ${indice} ripete una risposta`);
      assert.ok(voce.domanda.trim().length > 8 && voce.dopo.trim().length > 8, `il quiz ${indice} è monco`);
      continue;
    }
    const testo = voce.testo || voce.significato;
    assert.ok(testo && testo.trim().length > 15, `il giorno ${indice} ha un testo troppo corto`);
    if (voce.t === 'curiosita') assert.ok(voce.titolo?.trim(), `la curiosità ${indice} non ha titolo`);
    if (voce.t === 'oroscopo') assert.ok(voce.segno?.trim(), `l’oroscopo ${indice} non ha il suo segno`);
    if (voce.t === 'parola') assert.ok(voce.parola?.trim(), `la parola ${indice} manca`);
  }
});

test('in duecentoquaranta giorni escono tutti e duecentoquaranta i biglietti, uno per uno', () => {
  const usciti = new Set();
  const partenza = new Date(2026, 8, 1);
  for (let giorno = 0; giorno < 240; giorno += 1) {
    const data = new Date(partenza);
    data.setDate(partenza.getDate() + giorno);
    usciti.add(indiceDelGiorno(data));
  }
  assert.equal(usciti.size, 240, 'nessun biglietto deve tornare prima che siano usciti tutti');
});

test('al giorno duecentoquarantuno il giro ricomincia da capo', () => {
  const partenza = new Date(2026, 8, 1);
  const dopoUnGiro = new Date(2026, 8, 1);
  dopoUnGiro.setDate(partenza.getDate() + 240);
  assert.equal(indiceDelGiorno(dopoUnGiro), indiceDelGiorno(partenza));
});

test('due giorni di fila non danno quasi mai lo stesso tipo di biglietto', () => {
  const partenza = new Date(2026, 8, 1);
  let uguali = 0;
  let precedente = null;
  for (let giorno = 0; giorno < 240; giorno += 1) {
    const data = new Date(partenza);
    data.setDate(partenza.getDate() + giorno);
    const tipo = contenutoDelGiorno(data).t;
    if (tipo === precedente) uguali += 1;
    precedente = tipo;
  }
  assert.ok(uguali <= 24, `troppi giorni di fila dello stesso tipo: ${uguali} su 240`);
});

test('lo stesso giorno dà sempre lo stesso biglietto, a qualunque ora', () => {
  const mattina = new Date(2026, 10, 7, 7, 30);
  const sera = new Date(2026, 10, 7, 22, 45);
  assert.equal(indiceDelGiorno(mattina), indiceDelGiorno(sera));
  assert.notEqual(indiceDelGiorno(mattina), indiceDelGiorno(new Date(2026, 10, 8, 7, 30)));
});

test('il conto dei giorni regge anche prima del punto di partenza', () => {
  // Un iPad con la data indietro non deve far uscire un indice negativo.
  const prima = new Date(2025, 0, 15);
  assert.ok(numeroDelGiorno(prima) < 0);
  const indice = indiceDelGiorno(prima);
  assert.ok(indice >= 0 && indice < 240);
  assert.ok(contenutoDelGiorno(prima));
});

test('il cambio dell’ora legale non fa saltare un giorno', () => {
  // In Italia l'ora legale finisce l'ultima domenica di ottobre.
  const sabato = new Date(2026, 9, 24, 12, 0);
  const domenica = new Date(2026, 9, 25, 12, 0);
  const lunedi = new Date(2026, 9, 26, 12, 0);
  assert.equal(numeroDelGiorno(domenica) - numeroDelGiorno(sabato), 1);
  assert.equal(numeroDelGiorno(lunedi) - numeroDelGiorno(domenica), 1);
});

test('le curiosità non promettono di essere battute, e le battute non si spacciano per fatti', () => {
  // Controllo di forma, non di verità: le due famiglie restano separate,
  // così un ragazzo sa sempre se quel che legge è uno scherzo o un fatto.
  const tipi = new Set(CONTENUTI_DIARIO.map((voce) => voce.t));
  assert.deepEqual([...tipi].sort(), ['battuta', 'curiosita', 'oroscopo', 'parola', 'quiz', 'sfida']);
  assert.equal(ETICHETTE.curiosita, 'Lo sapevi?');
  assert.equal(ETICHETTE.battuta, 'La battuta di oggi');
});
