import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);

test('la shell contiene navigazione, import PDF e viste principali', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /accept="application\/pdf"[^>]*multiple/);
  for (const id of ['libreria', 'quaderni', 'compiti', 'impostazioni', 'lettore-pdf', 'editor-quaderno']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('i moduli applicativi usano soltanto import locali', async () => {
  const names = ['app.js', 'db.js', 'pdf-viewer.js', 'quaderni.js', 'strumenti.js'];
  for (const name of names) {
    const source = await readFile(new URL(`../${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /https?:\/\/|(?:src|href)\s*=\s*['"]\/\//i, `${name} contiene un URL remoto`);
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      assert.ok(match[1].startsWith('.'), `${name} importa una risorsa non locale`);
    }
  }
});

test('il service worker include ogni risorsa statica essenziale', async () => {
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const required = ['index.html', 'style.css', 'app.js', 'db.js', 'pdf-viewer.js', 'quaderni.js', 'strumenti.js', 'manifest.webmanifest', 'vendor/pdf.mjs', 'vendor/pdf.worker.mjs'];
  for (const file of required) assert.match(sw, new RegExp(file.replaceAll('.', '\\.')));
});

test('nessun file di consegna contiene segnaposto di sviluppo', async () => {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && !entry.parentPath.includes('/tests')).map((entry) => join(entry.parentPath, entry.name));
  for (const file of files) {
    if (/\.(png|mjs)$/.test(file) && file.includes('/vendor/')) continue;
    const source = await readFile(file, 'utf8').catch(() => '');
    assert.doesNotMatch(source, /\b(?:TBD|FIXME)\b|(?:\/\/|<!--)\s*TODO\b/i, file);
  }
});

test('manifest, icone e PDF.js locale sono completi', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'Skooling');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './index.html');
  for (const size of [180, 192, 512]) {
    const png = await readFile(new URL(`../icons/icon-${size}.png`, import.meta.url));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  assert.ok((await stat(new URL('../vendor/pdf.mjs', import.meta.url))).size > 500_000);
  assert.ok((await stat(new URL('../vendor/pdf.worker.mjs', import.meta.url))).size > 1_000_000);
  assert.match(await readFile(new URL('../vendor/PDFJS-LICENSE.txt', import.meta.url), 'utf8'), /Apache License\s+Version 2\.0/);
});
