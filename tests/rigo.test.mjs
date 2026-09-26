import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DISEGNI_RIGO, geometriaRigo, disegnoRigoPagina, disegnoRigoNuovaPagina, agganciaAlRigoProporzionale, sfondoRigo, RIGO } from '../quaderni.js';
import { ingombroSegno } from '../musica.js';

// Difetto trovato da Cristian sulla v25 (26/09/2026): il primo pentagramma era
// attaccato al bordo alto del foglio e sopra non ci stava una nota. Il disegno
// nuovo da' a ogni rigo lo stesso spazio libero sopra e sotto, primo e ultimo compresi.

// Le misure vere del foglio sull'iPad: orizzontale con e senza astuccio, a schermo
// intero, iPad in verticale, l'esportazione; e il foglio verticale.
const FOGLI = [[880, 622.3], [1124, 795], [1164, 823], [764, 540.3], [1754, 1240], [780, 1103], [640, 904.9], [1240, 1754]];

test('il primo rigo non e\' attaccato al bordo: sopra ha lo spazio che c\'e\' fra due righi', () => {
  for (const [larghezza, altezza] of FOGLI) {
    const g = geometriaRigo(DISEGNI_RIGO.proporzionale, larghezza, altezza);
    const nome = `${larghezza}x${altezza}`;
    assert.ok(g.righi >= 4, `${nome}: almeno quattro righi`);
    // sopra il primo rigo lo stesso spazio che fra un rigo e l'altro
    assert.ok(Math.abs(g.primaRiga - g.spazio) < 1e-9, `${nome}: spazio sopra il primo rigo`);
    assert.ok(Math.abs(g.passoRigo - g.passoRiga * 4 - g.spazio) < 1e-9, `${nome}: spazio fra i righi`);
    // e lo stesso sotto l'ultimo
    const fondoUltimo = g.primaRiga + (g.righi - 1) * g.passoRigo + g.passoRiga * 4;
    assert.ok(Math.abs(altezza - fondoUltimo - g.spazio) < 1e-6, `${nome}: spazio sotto l'ultimo rigo`);
    // sopra il primo rigo ci sta intera una nota sul secondo taglio con la
    // gamba in su: 2 spazi fino al taglio piu' 3,5 di gamba
    const semiminima = ingombroSegno('semiminima');
    assert.ok(g.primaRiga - 2 * g.passoRiga - semiminima.sopra * g.passoRiga >= -1e-9, `${nome}: il primo rigo e' troppo vicino al bordo (${g.primaRiga.toFixed(1)} px)`);
  }
});

test('una chiave di violino sul primo rigo si vede intera, e anche sull\'ultimo', () => {
  const chiave = ingombroSegno('chiave-violino');
  for (const [larghezza, altezza] of FOGLI) {
    const g = geometriaRigo(DISEGNI_RIGO.proporzionale, larghezza, altezza);
    // la chiave di violino si appoggia sulla riga del sol, la seconda dal basso
    const sulSol = g.primaRiga + g.passoRiga * 3;
    assert.ok(sulSol - chiave.sopra * g.passoRiga >= 0, `${larghezza}x${altezza}: la chiave esce dal bordo alto`);
    const solUltimo = g.primaRiga + (g.righi - 1) * g.passoRigo + g.passoRiga * 3;
    assert.ok(solUltimo + chiave.sotto * g.passoRiga <= altezza, `${larghezza}x${altezza}: la chiave esce dal bordo basso`);
  }
  // il difetto vecchio, perche' resti scritto: col disegno 1 la chiave usciva dal foglio
  const vecchio = geometriaRigo(DISEGNI_RIGO.fisso, 880, 622.3);
  assert.ok(vecchio.primaRiga + vecchio.passoRiga * 3 - chiave.sopra * vecchio.passoRiga < 0);
});

test('il disegno nuovo cresce col foglio: aprire l\'astuccio o girare l\'iPad non sposta le righe sotto i segni', () => {
  const a = geometriaRigo(DISEGNI_RIGO.proporzionale, 880, 880 / 1.414);
  const b = geometriaRigo(DISEGNI_RIGO.proporzionale, 1124, 1124 / 1.414);
  for (const chiave of ['passoRiga', 'passoRigo', 'primaRiga']) {
    assert.ok(Math.abs(a[chiave] / (880 / 1.414) - b[chiave] / (1124 / 1.414)) < 1e-12, chiave);
  }
  assert.equal(a.righi, b.righi);
});

test('l\'aggancio funziona su tutti i righi, primo compreso, e anche sui tagli sopra e sotto', () => {
  const [larghezza, altezza] = [880, 622.3];
  const g = geometriaRigo(DISEGNI_RIGO.proporzionale, larghezza, altezza);
  for (let indice = 0; indice < g.righi; indice += 1) {
    const alto = g.primaRiga + indice * g.passoRigo;
    // due tagli addizionali pieni sopra e sotto ogni rigo; fra due righi lo
    // spazio e' di circa nove mezzi passi, e li' vince il rigo piu' vicino
    const primo = indice === 0 ? -5 : -4;
    const ultimo = indice === g.righi - 1 ? 13 : 12;
    for (let mezzi = primo; mezzi <= ultimo; mezzi += 1) {
      const giusta = alto + mezzi * g.passoRiga / 2;
      // tocco un po' fuori posto, meno di un quarto di passo
      const tocco = (giusta + g.passoRiga * 0.2) / altezza;
      const agganciata = agganciaAlRigoProporzionale(tocco, altezza, g) * altezza;
      assert.ok(Math.abs(agganciata - giusta) < 1e-6, `rigo ${indice + 1}, mezzo passo ${mezzi}`);
    }
  }
  // lontano dai righi, in mezzo allo spazio, il segno resta dove lo si mette
  assert.equal(agganciaAlRigoProporzionale(0.001, altezza, g), 0.001);
});

test('le pagine gia\' scritte tengono il disegno vecchio, le vuote e le nuove prendono il nuovo', () => {
  assert.equal(disegnoRigoNuovaPagina('pentagramma'), DISEGNI_RIGO.proporzionale);
  assert.equal(disegnoRigoNuovaPagina('righe'), undefined);
  assert.equal(disegnoRigoPagina('pentagramma', { elementi: [] }), DISEGNI_RIGO.proporzionale);
  assert.equal(disegnoRigoPagina('pentagramma', { elementi: [{ tipo: 'simbolo' }] }), DISEGNI_RIGO.fisso);
  // una volta scritto non cambia piu'
  assert.equal(disegnoRigoPagina('pentagramma', { elementi: [{ tipo: 'simbolo' }], disegnoRigo: 2 }), DISEGNI_RIGO.proporzionale);
  assert.equal(disegnoRigoPagina('pentagramma', { elementi: [], disegnoRigo: 1 }), DISEGNI_RIGO.fisso);
  assert.equal(disegnoRigoPagina('quadretti', { elementi: [] }), null);
  // il disegno vecchio resta identico, altrimenti i simboli gia' agganciati si staccano
  assert.deepEqual(RIGO, { passoRiga: 16, passoRigo: 150, primaRiga: 15 });
});

test('ogni pagina nuova di pentagramma nasce col disegno nuovo', async () => {
  const codice = await readFile(new URL('../quaderni.js', import.meta.url), 'utf8');
  const creazioni = codice.match(/idQuaderno: [^\n]*elementi: \[\][^\n]*/g) || [];
  assert.equal(creazioni.length, 3);
  for (const riga of creazioni) assert.match(riga, /\.\.\.campoDisegnoRigo\(/);
  assert.match(codice, /page\.disegnoRigo = disegno/);
});

test('lo sfondo del disegno nuovo mette cinque righe per rigo, alle quote giuste', () => {
  const g = geometriaRigo(DISEGNI_RIGO.proporzionale, 880, 622.3);
  const sfondo = sfondoRigo(g);
  assert.equal((sfondo.match(/#5b6472/g) || []).length, g.righi * 5 * 2);
  assert.match(sfondo, new RegExp(`transparent ${(g.primaRiga - 0.5).toFixed(2)}px`));
});
