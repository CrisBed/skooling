import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { paginaSinistraLibro, paginaDestraLibro, coppiaPrecedenteLibro, coppiaSuccessivaLibro, coppieLibro } from '../pagine.js';

test('nel libro la copertina sta da sola e poi le coppie sono pari-dispari', () => {
  assert.deepEqual(coppieLibro(12), [[1, null], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, null]]);
});

test('con un numero pari di pagine anche l’ultima resta sola', () => {
  const coppie = coppieLibro(434); // Storia-completa.pdf, uno dei libri veri di Gabriel
  assert.deepEqual(coppie[0], [1, null]);
  assert.deepEqual(coppie[1], [2, 3]);
  assert.deepEqual(coppie.at(-2), [432, 433]);
  assert.deepEqual(coppie.at(-1), [434, null]);
});

test('con un numero dispari di pagine l’ultima chiude la sua coppia', () => {
  const coppie = coppieLibro(433);
  assert.deepEqual(coppie[0], [1, null]);
  assert.deepEqual(coppie.at(-1), [432, 433]);
  assert.equal(coppie.filter(([, destra]) => destra === null).length, 1, 'sola la copertina');
});

test('la sequenza copre tutte le pagine una volta sola, dall’inizio alla fine', () => {
  for (const totale of [1, 2, 3, 4, 5, 22, 40, 41, 42, 70, 252, 340, 433, 434]) {
    const viste = coppieLibro(totale).flat().filter((pagina) => pagina !== null);
    assert.deepEqual(viste, Array.from({ length: totale }, (_, i) => i + 1), `totale ${totale}`);
  }
});

test('un libro di una pagina sola mostra solo la copertina', () => {
  assert.deepEqual(coppieLibro(1), [[1, null]]);
  assert.deepEqual(coppieLibro(0), []);
});

test('da qualunque pagina si ricava la coppia che la contiene', () => {
  assert.equal(paginaSinistraLibro(1), 1);
  assert.equal(paginaSinistraLibro(2), 2);
  assert.equal(paginaSinistraLibro(3), 2);
  assert.equal(paginaSinistraLibro(4), 4);
  assert.equal(paginaSinistraLibro(433), 432);
  assert.equal(paginaSinistraLibro(0), 1);
  assert.equal(paginaSinistraLibro(undefined), 1);
  assert.equal(paginaDestraLibro(3, 434), 3, 'chiedendo la 3 la coppia e’ 2-3');
  assert.equal(paginaDestraLibro(1, 434), null, 'la copertina non ha compagna');
  assert.equal(paginaDestraLibro(434, 434), null, 'ne’ l’ultima di un libro pari');
});

test('si sfoglia avanti e indietro senza salti e senza uscire dal libro', () => {
  const totale = 10;
  let pagina = 1;
  const andata = [pagina];
  for (let passi = 0; passi < 20; passi += 1) {
    const prossima = coppiaSuccessivaLibro(pagina, totale);
    if (prossima === pagina) break;
    pagina = prossima;
    andata.push(pagina);
  }
  assert.deepEqual(andata, [1, 2, 4, 6, 8, 10], 'avanti fino alla fine, poi si ferma');
  const ritorno = [pagina];
  for (let passi = 0; passi < 20; passi += 1) {
    const prima = coppiaPrecedenteLibro(pagina);
    if (prima === pagina) break;
    pagina = prima;
    ritorno.push(pagina);
  }
  assert.deepEqual(ritorno, [10, 8, 6, 4, 2, 1], 'e indietro fino alla copertina');
});

test('i quaderni tengono la loro regola e non passano da pagine.js', async () => {
  // Un quaderno non ha copertina: le coppie restano 1-2, 3-4, 5-6. Libri e
  // quaderni riusano la stessa SurfaceGroup, quindi questa prova esiste per
  // impedire che la regola dei libri scivoli nei quaderni.
  const quaderni = await readFile(new URL('../quaderni.js', import.meta.url), 'utf8');
  assert.doesNotMatch(quaderni, /pagine\.js|paginaSinistraLibro|paginaDestraLibro|coppiaSuccessivaLibro|coppiaPrecedenteLibro/, 'i quaderni non usano l’accoppiamento dei libri');
  assert.match(quaderni, /this\.pageIndex -= this\.pageIndex % 2/, 'i quaderni accoppiano ancora a partire dal primo foglio');
});
