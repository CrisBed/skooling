import test from 'node:test';
import assert from 'node:assert/strict';
import { nomeDataAlbum, numeroMassimo, nomeFoto } from '../album.js';

test('un album nuovo si chiama come la data del giorno', () => {
  assert.equal(nomeDataAlbum(new Date(2026, 8, 2)), '02-09-2026');
  assert.equal(nomeDataAlbum(new Date(2026, 11, 25)), '25-12-2026');
});

test('la foto nuova prende il numero dopo l’ultimo usato, anche dopo un’eliminazione', () => {
  const foto = [
    { idAlbum: 'a', numero: 1 }, { idAlbum: 'a', numero: 3 },
    { idAlbum: 'b', numero: 9 },
  ];
  assert.equal(numeroMassimo(foto, 'a'), 3);
  assert.equal(numeroMassimo(foto, 'b'), 9);
  assert.equal(numeroMassimo(foto, 'mai-vista'), 0);
});

test('una foto si chiama col suo numero finché non le si dà un nome', () => {
  assert.equal(nomeFoto({ numero: 4, titolo: '4' }), '4');
  assert.equal(nomeFoto({ numero: 4, titolo: '  ' }), '4');
  assert.equal(nomeFoto({ numero: 4, titolo: 'Il cartellone' }), 'Il cartellone');
});
