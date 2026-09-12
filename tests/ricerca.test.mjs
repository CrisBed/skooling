import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizza, estraiFrase, cercaNelTesto, improntaLibro, componiMatrici, rettangoliDaEvidenziare } from '../ricerca.js';

test('la parola cercata si confronta senza accenti, maiuscole e spazi doppi', () => {
  assert.equal(normalizza('  Perché   l’ACQUA è  Così '), "perche l'acqua e cosi");
  assert.equal(normalizza(null), '');
  assert.equal(normalizza('Città'), 'citta');
});

test('la ricerca trova la parola in qualunque forma sia scritta nel libro', () => {
  const pagine = [
    { numero: 3, testo: 'La fotosintesi clorofilliana trasforma la luce in energia.' },
    { numero: 7, testo: 'Qui non si parla di piante.' },
    { numero: 12, testo: 'Durante la FOTOSÌNTESI la pianta libera ossigeno.' },
  ];
  assert.deepEqual(cercaNelTesto(pagine, 'fotosintesi').map((r) => r.numero), [3, 12]);
  assert.deepEqual(cercaNelTesto(pagine, 'Fotosìntesi').map((r) => r.numero), [3, 12]);
});

test('una richiesta di una lettera sola non cerca niente', () => {
  const pagine = [{ numero: 1, testo: 'a b c d e f' }];
  assert.deepEqual(cercaNelTesto(pagine, 'a'), []);
  assert.deepEqual(cercaNelTesto(pagine, ''), []);
});

test('un libro senza testo non dà risultati e non fa errori', () => {
  assert.deepEqual(cercaNelTesto([], 'qualsiasi'), []);
  assert.deepEqual(cercaNelTesto([{ numero: 1, testo: '' }], 'qualsiasi'), []);
});

test('i risultati si fermano al tetto richiesto', () => {
  const pagine = Array.from({ length: 40 }, (_, indice) => ({ numero: indice + 1, testo: 'la pianta cresce' }));
  assert.equal(cercaNelTesto(pagine, 'pianta', 10).length, 10);
});

test('la frase mostra il contesto attorno alla parola', () => {
  const testo = 'a'.repeat(100) + 'PIANTA' + 'b'.repeat(100);
  const frase = estraiFrase(testo, 100, 6, 10);
  assert.ok(frase.startsWith('…'), 'si capisce che prima c’è altro testo');
  assert.ok(frase.endsWith('…'), 'si capisce che dopo c’è altro testo');
  assert.ok(frase.includes('PIANTA'));
  // una frase corta non mette i puntini
  assert.equal(estraiFrase('la pianta', 3, 6, 10), 'la pianta');
});

test('l’impronta del libro cambia quando il file cambia', () => {
  const libro = { blob: { size: 1000 }, data: 10 };
  assert.equal(improntaLibro(libro), improntaLibro({ blob: { size: 1000 }, data: 10 }));
  assert.notEqual(improntaLibro(libro), improntaLibro({ blob: { size: 2000 }, data: 10 }), 'reimportato dopo l’OCR pesa diverso');
  assert.equal(improntaLibro({}), '0-0');
});

test('le due matrici si compongono come fa PDF.js', () => {
  // identità per identità resta identità
  assert.deepEqual(componiMatrici([1, 0, 0, 1, 0, 0], [1, 0, 0, 1, 0, 0]), [1, 0, 0, 1, 0, 0]);
  // una scala doppia più uno spostamento
  assert.deepEqual(componiMatrici([2, 0, 0, 2, 0, 0], [1, 0, 0, 1, 5, 7]), [2, 0, 0, 2, 10, 14]);
});

test('la parola trovata diventa un rettangolo sopra la pagina', () => {
  const contenuto = {
    items: [
      { str: 'la pianta cresce', width: 160, height: 12, transform: [12, 0, 0, 12, 100, 500] },
      { str: 'niente qui', width: 90, height: 12, transform: [12, 0, 0, 12, 100, 400] },
    ],
  };
  const viewport = { transform: [1, 0, 0, -1, 0, 800], scale: 1 };
  const rettangoli = rettangoliDaEvidenziare(contenuto, viewport, 'pianta');
  assert.equal(rettangoli.length, 1, 'solo il pezzo che contiene la parola');
  assert.ok(rettangoli[0].larghezza > 0 && rettangoli[0].altezza > 0);
  // sta dentro il pezzo di testo da cui viene
  assert.ok(rettangoli[0].x >= 100 && rettangoli[0].x <= 260);
  assert.deepEqual(rettangoliDaEvidenziare(contenuto, viewport, 'z'), [], 'una lettera sola non evidenzia niente');
});
