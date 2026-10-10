import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('il worker comunica la propria versione installata senza interrogare la rete', async () => {
  const source = (await readFile(new URL('../sw.js', import.meta.url), 'utf8')).replace(/skooling-v\d+/, 'skooling-v42');
  const handlers = {};
  const self = { location: { hostname: 'example.test' }, addEventListener(name, fn) { handlers[name] = fn; } };
  vm.runInNewContext(source, { self });
  let risposta;
  handlers.message({ data: 'skooling:versione', ports: [{ postMessage(value) { risposta = value.versione; } }] });
  assert.equal(risposta, '42');
  assert.doesNotThrow(() => handlers.message({ data: 'skooling:versione', ports: [] }));
});
