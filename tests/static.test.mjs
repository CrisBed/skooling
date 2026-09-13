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
  const names = ['app.js', 'db.js', 'pdf-viewer.js', 'quaderni.js', 'strumenti.js', 'album.js', 'ricerca.js', 'musica.js', 'diario.js', 'diario-contenuti.js', 'pagine.js'];
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
  const required = ['index.html', 'style.css', 'app.js', 'db.js', 'pdf-viewer.js', 'quaderni.js', 'strumenti.js', 'album.js', 'ricerca.js', 'musica.js', 'diario.js', 'diario-contenuti.js', 'pagine.js', 'manifest.webmanifest', 'vendor/SkoolingMusica.woff2', 'vendor/pdf.mjs', 'vendor/pdf.worker.mjs'];
  for (const file of required) assert.match(sw, new RegExp(file.replaceAll('.', '\\.')));
});

test('nessun file di consegna contiene segnaposto di sviluppo', async () => {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  // Solo i file che vengono davvero consegnati: fuori i test e tutte le cartelle
  // di servizio che iniziano con un punto (.git in testa), che non si pubblicano.
  const diServizio = (percorso) => percorso.includes('/tests') || /(^|\/)\.[^/]+\//.test(percorso);
  const files = entries
    .filter((entry) => entry.isFile() && !diServizio(`${entry.parentPath}/`))
    .map((entry) => join(entry.parentPath, entry.name));
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

test('la vista a schermo intero ha i suoi comandi in entrambi gli spazi di lavoro', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['reader-fullscreen', 'reader-exit-fullscreen', 'notebook-fullscreen', 'notebook-exit-fullscreen']) {
    assert.match(html, new RegExp(`id="${id}"`), `manca il pulsante ${id}`);
  }
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /\.workspace\.schermo-pieno[^{]*\.workspace-header/);
  assert.match(css, /\.workspace\.schermo-pieno[^{]*\.page-controls/);
  assert.match(css, /\.workspace\.schermo-pieno \.fullscreen-exit/);
});

test('sul foglio i gesti non li prende il browser', async () => {
  // Se il canvas concedesse `pan` o `pinch-zoom`, il browser si prenderebbe il
  // trascinamento: la penna sposterebbe la pagina invece di scrivere, e il
  // pizzico ingrandirebbe tutta l'app invece della sola pagina.
  const css = (await readFile(new URL('../style.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const regole = css.split('}').filter((regola) => /\.drawing-canvas/.test(regola) && /touch-action/.test(regola));
  assert.ok(regole.length, 'manca la regola touch-action del foglio');
  for (const regola of regole) {
    assert.match(regola, /touch-action:\s*none/, `il foglio concede gesti al browser: ${regola.trim()}`);
  }
});

test('l\'album ha la sua sezione, il suo pulsante e il visore delle foto', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="album"/);
  assert.match(html, /data-go="album"/);
  assert.match(html, /id="album-input"[^>]*accept="image\/\*"[^>]*capture/);
  assert.match(html, /id="task-photo"[^>]*accept="image\/\*"[^>]*capture/, 'il compito deve poter scattare una foto');
  assert.match(html, /id="photo-dialog"/);
});

test('i quaderni offrono tutti e cinque i tipi di foglio', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  const { TIPI_FOGLIO } = await import('../quaderni.js');
  assert.deepEqual(Object.keys(TIPI_FOGLIO), ['righe', 'quadretti', 'bianco', 'pentagramma', 'millimetrato']);
  for (const [tipo, classe] of Object.entries(TIPI_FOGLIO)) {
    assert.match(html, new RegExp(`value="${tipo}"`), `manca la scelta ${tipo} nel dialogo`);
    assert.match(css, new RegExp(`\\.notebook-paper\\.${classe}`), `manca il disegno del foglio ${tipo}`);
    assert.match(css, new RegExp(`\\.paper-sample\\.${classe}`), `manca l'anteprima del foglio ${tipo}`);
  }
});

test('lo strumento per spostare c\'è in tutti e due gli astucci', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/data-tool="sposta"/g) || []).length, 2);
});

test('la barra in basso si adatta al numero di sezioni', async () => {
  // Aggiungendo una sezione, una barra a colonne fisse manderebbe l'ultima
  // voce a capo su schermo stretto.
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  const sezioni = (html.match(/data-go="/g) || []).length;
  assert.ok(sezioni >= 5, 'le sezioni di navigazione sono almeno cinque');
  const barra = css.split('}').find((regola) => /\.main-nav \{/.test(regola) && /inset: auto 0 0 0/.test(regola));
  assert.ok(barra, 'manca la regola della barra in basso');
  assert.doesNotMatch(barra, /grid-template-columns:\s*repeat\(\d+/, 'la barra in basso ha un numero fisso di colonne');
});

test('il lettore libera davvero il documento quando si chiude', async () => {
  // In PDF.js il documento NON ha un metodo destroy: liberare la memoria si può
  // solo dal compito di caricamento. Chiamarlo sul documento non dà errore, non
  // fa niente in silenzio, e ogni libro aperto lascia dietro un worker e una
  // copia intera del PDF finché l'app non viene riavviata.
  const lettore = await readFile(new URL('../pdf-viewer.js', import.meta.url), 'utf8');
  assert.doesNotMatch(lettore, /this\.pdf\??\.destroy/, 'il documento non si chiude da solo: serve il compito di caricamento');
  assert.match(lettore, /this\.caricamento\s*=\s*task/, 'il compito di caricamento va tenuto');
  assert.match(lettore, /task\.destroy\(\)/, 'e va chiuso');
  const vendor = await readFile(new URL('../vendor/pdf.mjs', import.meta.url), 'utf8');
  const documento = vendor.slice(vendor.indexOf('class PDFDocumentProxy'), vendor.indexOf('class PDFDocumentProxy') + 2600);
  assert.doesNotMatch(documento, /\n  (async )?destroy\(/, 'se una versione nuova di PDF.js aggiunge destroy al documento, questa regola va rivista');
});

test('i simboli musicali usano il font che l’app si porta dietro', async () => {
  // I caratteri musicali dei font di sistema non esistono: provati sul
  // dispositivo, disegnano tutti lo stesso rettangolo vuoto. Il font di
  // notazione quindi viaggia con l’app, e deve funzionare anche offline.
  const musica = await readFile(new URL('../musica.js', import.meta.url), 'utf8');
  assert.match(musica, /SkoolingMusica/, 'i segni si scrivono col font dell’app');
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /@font-face[\s\S]{0,200}SkoolingMusica\.woff2/, 'il font e’ dichiarato nel CSS');
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /SkoolingMusica\.woff2/, 'e viene tenuto in cache per l’uso offline');
  const licenza = await readFile(new URL('../vendor/BRAVURA-LICENSE.txt', import.meta.url), 'utf8');
  assert.match(licenza, /SIL OPEN FONT LICENSE/, 'la licenza del font viaggia con lui');
  const licenze = await readFile(new URL('../LICENZE.md', import.meta.url), 'utf8');
  assert.match(licenze, /Bravura/, 'ed e’ citata fra le licenze');
});

test('chiudere un libro spegne lo stato prima di mettersi ad aspettare', async () => {
  // Chiudere un libro da centinaia di megabyte richiede tempo. Se in quel tempo
  // si aspetta PRIMA di spegnere lo stato, chi ha già riaperto un altro libro se
  // lo vede azzerare sotto le mani: è il difetto dell'uscire e rientrare subito.
  const lettore = await readFile(new URL('../pdf-viewer.js', import.meta.url), 'utf8');
  const chiusura = lettore.slice(lettore.indexOf('  async close() {'));
  const corpo = chiusura.slice(0, chiusura.indexOf('\n  }\n'));
  const posizioneAzzera = corpo.indexOf('this.book = null');
  const posizioneAttesa = corpo.indexOf('await ');
  assert.ok(posizioneAzzera >= 0 && posizioneAttesa >= 0, 'la chiusura azzera lo stato e aspetta');
  assert.ok(posizioneAzzera < posizioneAttesa, 'ma azzera PRIMA di aspettare');
  assert.match(lettore, /this\.sessione \+= 1|\+\+this\.sessione/, 'ogni apertura e chiusura ha il suo numero di sessione');
});

test('l’ingrandimento a due dita tiene due punti distinti, non uno solo', async () => {
  // Il punto del foglio che si vuole tenere e il posto dove le dita sono
  // arrivate coincidono solo se le dita non si spostano mentre si allargano.
  // Con un punto solo il foglio scappava di centinaia di pixel.
  const lettore = await readFile(new URL('../pdf-viewer.js', import.meta.url), 'utf8');
  assert.match(lettore, /contenuto: partenza, schermo: centro/, 'il pizzico passa il punto del foglio e quello dello schermo');
  assert.match(lettore, /ancora\?\.contenuto/, 'e setZoom li distingue');
});

test('il segnaposto di lettura non riscrive il libro intero', async () => {
  // Salvare la pagina dentro il record del libro vuol dire riscrivere il PDF:
  // con un libro da 400 MB sono mezzo secondo e 400 MB a ogni voltata di pagina.
  const lettore = await readFile(new URL('../pdf-viewer.js', import.meta.url), 'utf8');
  assert.doesNotMatch(lettore, /DB\.put\('libri'/, 'il lettore non riscrive mai il record del libro');
  assert.match(lettore, /DB\.put\('letture'/, 'salva solo il segnaposto');
});

test('l’album ha due livelli: gli album e le foto dentro, con il ritorno indietro', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="album-back"/, 'dentro un album serve il modo di tornare all’elenco');
  assert.match(html, /id="album-dialog"/, 'va chiesto in quale album mettere le foto');
  assert.match(html, /id="album-target"/, 'si sceglie fra un album nuovo e quelli che ci sono');
  assert.match(html, /id="album-name"/, 'il nome del nuovo album si puo’ cambiare subito');
});

test('gli album entrano nel backup, e un backup vecchio senza album si importa lo stesso', async () => {
  const { STORE_NAMES, STORE_NAMES_STORICI } = await import('../db.js');
  assert.ok(STORE_NAMES.includes('album'), 'un backup deve portarsi via anche gli album');
  assert.ok(!STORE_NAMES_STORICI.includes('album'), 'un backup fatto prima degli album non va rifiutato');
});

test('lo strumento testo ha i comandi di dimensione, grassetto e corsivo', async () => {
  const strumenti = await readFile(new URL('../strumenti.js', import.meta.url), 'utf8');
  for (const comando of ['data-text-size', 'data-text-bold', 'data-text-italic']) {
    assert.match(strumenti, new RegExp(comando), `manca il comando ${comando}`);
  }
  assert.match(strumenti, /applicaStileTesto/, 'i comandi devono poter cambiare la casella scelta');
});

test('la gomma sa tagliare anche cerchi, quadrati, righe e frecce', async () => {
  const { FORME_TAGLIABILI } = await import('../strumenti.js');
  assert.deepEqual([...FORME_TAGLIABILI].sort(), ['cerchio', 'freccia', 'linea', 'rettangolo']);
});
