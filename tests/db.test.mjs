import test from 'node:test';
import assert from 'node:assert/strict';
import { blobToDataURL, dataURLToBlob, validateBackup, STORE_NAMES } from '../db.js';

test('la conversione Blob conserva tipo e contenuto', async () => {
  const original = new Blob(['libro offline'], { type: 'application/pdf' });
  const encoded = await blobToDataURL(original);
  const restored = dataURLToBlob(encoded);
  assert.equal(restored.type, 'application/pdf');
  assert.equal(await restored.text(), 'libro offline');
});

test('il backup valido contiene tutti gli store previsti', () => {
  const stores = Object.fromEntries(STORE_NAMES.map((name) => [name, []]));
  const result = validateBackup({ formato: 'skooling', versione: 1, data: '2026-08-13', stores });
  assert.equal(result.formato, 'skooling');
  assert.deepEqual(Object.keys(result.stores), STORE_NAMES);
});

test('un file estraneo viene rifiutato senza alterare i dati', () => {
  assert.throws(
    () => validateBackup({ formato: 'altro', versione: 1, stores: {} }),
    /backup di Skooling valido/i,
  );
});
