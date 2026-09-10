// Coordinamento dell'applicazione e interfaccia principale.
import { DB, createId } from './db.js';
import { PDFViewer, extractPdfCover } from './pdf-viewer.js';
import { NotebookManager } from './quaderni.js';
import { downloadBlob } from './strumenti.js';

const state = { books: [], tasks: [], taskFilter: 'todo', coverUrls: [] };
let notebooks;
let toastTimer;

export function notify(text, error = false) {
  const toast = document.querySelector('#toast');
  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.toggle('error', error);
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, error ? 5200 : 3000);
}

export function showProgress(title, detail = '', value = 0) {
  document.querySelector('#progress-title').textContent = title;
  document.querySelector('#progress-detail').textContent = detail;
  document.querySelector('#progress-bar').value = value;
  document.querySelector('#progress-overlay').hidden = false;
}

export function hideProgress() {
  document.querySelector('#progress-overlay').hidden = true;
}

export function navigate(view) {
  document.querySelectorAll('.view').forEach((section) => section.classList.toggle('active', section.id === view));
  document.querySelectorAll('[data-go]').forEach((button) => button.classList.toggle('active', button.dataset.go === view));
  if (view === 'libreria') renderLibrary();
  if (view === 'quaderni') notebooks.renderList();
  if (view === 'compiti') renderTasks();
  if (view === 'impostazioni') updateStorage();
  document.querySelector('#main-content').scrollTo?.(0, 0);
  verificaAggiornamentoInSospeso();
}

export const App = { navigate, notify, showProgress, hideProgress };

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return '0 MB';
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.round(value / 1024 ** 2)} MB`;
}

function bindNavigation() {
  document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.go)));
  document.querySelectorAll('[data-dialog-close]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
  document.addEventListener('skooling:message', (event) => notify(event.detail.text, event.detail.error));
  document.addEventListener('skooling:reader-closed', () => { renderLibrary(); verificaAggiornamentoInSospeso(); });
  document.addEventListener('skooling:quaderno-chiuso', () => verificaAggiornamentoInSospeso());
  const onlineStatus = () => {
    const pill = document.querySelector('#offline-state');
    pill.textContent = navigator.onLine ? 'Pronto offline' : 'Modalità aereo';
    pill.classList.toggle('offline', !navigator.onLine);
  };
  window.addEventListener('online', onlineStatus);
  window.addEventListener('offline', onlineStatus);
  onlineStatus();
}

async function importPdfs(files) {
  const pdfs = [...files].filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
  if (!pdfs.length) return notify('Scegli un file PDF.', true);
  let imported = 0;
  for (let index = 0; index < pdfs.length; index += 1) {
    const file = pdfs[index];
    showProgress('Aggiungo i libri', `${file.name} · ${index + 1} di ${pdfs.length}`, index / pdfs.length);
    try {
      const cover = await extractPdfCover(file);
      await DB.put('libri', {
        id: createId('libro'),
        titolo: file.name.replace(/\.pdf$/i, ''),
        materia: 'Da scegliere',
        copertina: cover,
        blob: file,
        data: Date.now(),
        ultimaPagina: 1,
      });
      imported += 1;
    } catch {
      notify(`“${file.name}” non sembra un PDF leggibile. Gli altri file continuano.`, true);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  hideProgress();
  document.querySelector('#pdf-input').value = '';
  await renderLibrary();
  if (imported) notify(imported === 1 ? 'Libro aggiunto alla libreria.' : `${imported} libri aggiunti alla libreria.`);
}

async function renderLibrary() {
  state.books = (await DB.getAll('libri')).sort((a, b) => b.data - a.data);
  state.coverUrls.forEach((url) => URL.revokeObjectURL(url));
  state.coverUrls = [];
  const query = document.querySelector('#book-search').value.trim().toLocaleLowerCase('it');
  const subject = document.querySelector('#book-subject-filter').value;
  const subjects = [...new Set(state.books.map((book) => book.materia).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));
  const filter = document.querySelector('#book-subject-filter');
  const selected = filter.value;
  filter.innerHTML = '<option value="">Tutte le materie</option>' + subjects.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
  filter.value = subjects.includes(selected) ? selected : '';
  const filtered = state.books.filter((book) => (!query || `${book.titolo} ${book.materia}`.toLocaleLowerCase('it').includes(query)) && (!subject || book.materia === subject));
  document.querySelector('#library-empty').hidden = state.books.length > 0;
  const grid = document.querySelector('#book-grid');
  grid.replaceChildren();
  if (!filtered.length && state.books.length) {
    const message = document.createElement('div');
    message.className = 'empty-state compact';
    message.innerHTML = '<h2>Nessun libro trovato</h2><p>Prova un’altra parola o cambia materia.</p>';
    grid.append(message);
  }
  for (const book of filtered) grid.append(makeBookCard(book));
}

function makeBookCard(book) {
  const article = document.createElement('article');
  article.className = 'book-card';
  let cover = `<div class="book-cover-placeholder">${escapeHtml(book.titolo)}</div>`;
  if (book.copertina instanceof Blob) {
    const url = URL.createObjectURL(book.copertina);
    state.coverUrls.push(url);
    cover = `<img src="${url}" alt="Copertina di ${escapeHtml(book.titolo)}">`;
  }
  article.innerHTML = `<button type="button" class="book-open"><div class="book-cover">${cover}</div><div class="book-info"><strong>${escapeHtml(book.titolo)}</strong><span>${escapeHtml(book.materia)} · Riprendi da pagina ${book.ultimaPagina || 1}</span></div></button><button type="button" class="card-menu" aria-label="Azioni per ${escapeHtml(book.titolo)}">⋯</button><div class="card-actions" hidden><button type="button" data-edit>Rinomina e materia</button><button type="button" data-delete class="danger-text">Elimina libro</button></div>`;
  article.querySelector('.book-open').addEventListener('click', () => openBook(book.id, book.ultimaPagina));
  article.querySelector('.card-menu').addEventListener('click', () => { const menu = article.querySelector('.card-actions'); menu.hidden = !menu.hidden; });
  article.querySelector('[data-edit]').addEventListener('click', () => openBookDialog(book));
  article.querySelector('[data-delete]').addEventListener('click', () => deleteBook(book));
  return article;
}

async function openBook(id, page = 1) {
  showProgress('Apro il libro', 'Preparo la pagina…', 0.25);
  try {
    PDFViewer.setDrawWithFinger(document.querySelector('#global-finger-draw').checked);
    await PDFViewer.open(id, page);
  } catch (error) {
    notify(error.message, true);
  } finally {
    hideProgress();
  }
}

function openBookDialog(book) {
  document.querySelector('#edit-book-id').value = book.id;
  document.querySelector('#edit-book-title').value = book.titolo;
  document.querySelector('#edit-book-subject').value = book.materia;
  document.querySelector('#book-dialog').showModal();
}

async function deleteBook(book) {
  if (!confirm(`Eliminare “${book.titolo}” e tutte le sue annotazioni?`)) return;
  await DB.delete('libri', book.id);
  await DB.deleteWhere('annotazioni', (item) => item.idLibro === book.id);
  await DB.deleteWhere('segnalibri', (item) => item.idLibro === book.id);
  await renderLibrary();
  notify('Libro eliminato.');
}

function bindLibrary() {
  document.querySelector('#pdf-input').addEventListener('change', (event) => importPdfs(event.target.files));
  document.querySelector('#book-search').addEventListener('input', renderLibrary);
  document.querySelector('#book-subject-filter').addEventListener('change', renderLibrary);
  document.querySelector('#book-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.querySelector('#edit-book-id').value;
    const book = await DB.get('libri', id);
    if (!book) return;
    book.titolo = document.querySelector('#edit-book-title').value.trim();
    book.materia = document.querySelector('#edit-book-subject').value.trim();
    await DB.put('libri', book);
    document.querySelector('#book-dialog').close();
    await renderLibrary();
    notify('Dettagli del libro aggiornati.');
  });
}

function tomorrowDate() {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}

async function populateTaskLinks(selected = '') {
  const select = document.querySelector('#task-link');
  const books = await DB.getAll('libri');
  const notebookItems = await DB.getAll('quaderni');
  select.innerHTML = '<option value="">Nessun collegamento</option>'
    + books.map((book) => `<option value="libro|${book.id}">Libro: ${escapeHtml(book.titolo)}</option>`).join('')
    + notebookItems.map((notebook) => `<option value="quaderno|${notebook.id}">Quaderno: ${escapeHtml(notebook.titolo)}</option>`).join('');
  select.value = selected;
  document.querySelector('#task-link-page-row').hidden = !select.value;
}

function bindTasks() {
  document.querySelector('#new-task').addEventListener('click', async () => {
    document.querySelector('#task-form').reset();
    document.querySelector('#edit-task-id').value = '';
    document.querySelector('#task-dialog-title').textContent = 'Nuovo compito';
    document.querySelector('#task-due').value = tomorrowDate();
    await populateTaskLinks();
    document.querySelector('#task-dialog').showModal();
  });
  document.querySelector('#task-link').addEventListener('change', (event) => { document.querySelector('#task-link-page-row').hidden = !event.target.value; });
  document.querySelectorAll('[data-task-filter]').forEach((button) => button.addEventListener('click', () => {
    state.taskFilter = button.dataset.taskFilter;
    document.querySelectorAll('[data-task-filter]').forEach((item) => item.classList.toggle('active', item === button));
    renderTasks();
  }));
  document.querySelector('#task-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.querySelector('#edit-task-id').value || createId('compito');
    const previous = await DB.get('compiti', id);
    const [tipo = '', linkId = ''] = document.querySelector('#task-link').value.split('|');
    await DB.put('compiti', {
      id,
      materia: document.querySelector('#task-subject').value.trim(),
      descrizione: document.querySelector('#task-description').value.trim(),
      consegna: document.querySelector('#task-due').value,
      stato: previous?.stato || 'todo',
      collegamento: tipo ? { tipo, id: linkId, pagina: Number(document.querySelector('#task-link-page').value) || 1 } : null,
      data: previous?.data || Date.now(),
    });
    document.querySelector('#task-dialog').close();
    await renderTasks();
    notify('Compito salvato.');
  });
}

async function renderTasks() {
  state.tasks = (await DB.getAll('compiti')).sort((a, b) => a.consegna.localeCompare(b.consegna));
  const filtered = state.tasks.filter((task) => state.taskFilter === 'all' || task.stato === state.taskFilter);
  document.querySelector('#task-empty').hidden = filtered.length > 0;
  const list = document.querySelector('#task-list');
  list.replaceChildren();
  for (const task of filtered) list.append(makeTaskCard(task));
}

function makeTaskCard(task) {
  const article = document.createElement('article');
  article.className = `task-card${task.stato === 'done' ? ' done' : ''}`;
  const due = new Date(`${task.consegna}T12:00:00`);
  const overdue = task.stato !== 'done' && due < new Date(new Date().toDateString());
  const dateLabel = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).format(due);
  article.innerHTML = `<button type="button" class="task-check" aria-label="${task.stato === 'done' ? 'Segna da fare' : 'Segna fatto'}">✓</button><div class="task-copy"><strong>${escapeHtml(task.descrizione)}</strong><span>${escapeHtml(task.materia)}${task.collegamento ? ' · Ha un collegamento' : ''}</span></div><div class="task-date${overdue ? ' overdue' : ''}">${overdue ? 'Scaduto · ' : ''}${dateLabel}</div><div class="task-actions">${task.collegamento ? '<button type="button" data-open-link aria-label="Apri collegamento">↗</button>' : ''}<button type="button" data-edit aria-label="Modifica compito">✎</button><button type="button" data-delete class="danger-text" aria-label="Elimina compito">×</button></div>`;
  article.querySelector('.task-check').addEventListener('click', async () => { task.stato = task.stato === 'done' ? 'todo' : 'done'; await DB.put('compiti', task); renderTasks(); });
  article.querySelector('[data-open-link]')?.addEventListener('click', () => openTaskLink(task));
  article.querySelector('[data-edit]').addEventListener('click', () => editTask(task));
  article.querySelector('[data-delete]').addEventListener('click', async () => {
    if (!confirm('Eliminare questo compito?')) return;
    await DB.delete('compiti', task.id);
    renderTasks();
  });
  return article;
}

async function editTask(task) {
  document.querySelector('#edit-task-id').value = task.id;
  document.querySelector('#task-dialog-title').textContent = 'Modifica compito';
  document.querySelector('#task-subject').value = task.materia;
  document.querySelector('#task-description').value = task.descrizione;
  document.querySelector('#task-due').value = task.consegna;
  const linkValue = task.collegamento ? `${task.collegamento.tipo}|${task.collegamento.id}` : '';
  await populateTaskLinks(linkValue);
  document.querySelector('#task-link-page').value = task.collegamento?.pagina || 1;
  document.querySelector('#task-dialog').showModal();
}

async function openTaskLink(task) {
  const link = task.collegamento;
  if (!link) return;
  if (link.tipo === 'libro') await openBook(link.id, link.pagina);
  else await notebooks.open(link.id, link.pagina);
}

function bindSettings() {
  const finger = document.querySelector('#global-finger-draw');
  finger.addEventListener('change', async () => {
    await DB.put('impostazioni', { id: 'disegna-dito', valore: finger.checked });
    PDFViewer.setDrawWithFinger(finger.checked);
  });
  document.querySelector('#export-backup').addEventListener('click', async () => {
    showProgress('Creo il backup', 'Raccolgo tutti i dati…', 0);
    try {
      const backup = await DB.exportBackup((value) => showProgress('Creo il backup', 'Raccolgo tutti i dati…', value));
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(backup, `Skooling-backup-${date}.skooling`);
      notify('Backup pronto. Conservalo in un posto sicuro.');
    } catch {
      notify('Il backup non è riuscito. Controlla lo spazio e riprova.', true);
    } finally { hideProgress(); }
  });
  document.querySelector('#import-backup').addEventListener('change', async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    if (!confirm('Importando il backup sostituirai i dati presenti su questo dispositivo. Continuare?')) { event.target.value = ''; return; }
    showProgress('Importo il backup', 'Controllo il file…', 0.1);
    try {
      await DB.importBackup(file, (value) => showProgress('Importo il backup', 'Ricostruisco il tuo archivio…', value));
      notify('Backup importato. Skooling si riavvia.');
      setTimeout(() => location.reload(), 900);
    } catch (error) {
      notify(error.message, true);
    } finally {
      event.target.value = '';
      hideProgress();
    }
  });
}

async function updateStorage() {
  try {
    const status = await DB.storageStatus();
    const percent = status.quota ? Math.min(100, status.usage / status.quota * 100) : 0;
    document.querySelector('#storage-bar').style.width = `${percent}%`;
    document.querySelector('#storage-copy').textContent = status.quota
      ? `${formatBytes(status.usage)} usati, ${formatBytes(status.remaining)} ancora disponibili.`
      : 'Lo spazio è gestito automaticamente dall’iPad.';
    document.querySelector('#persistence-copy').textContent = status.persisted
      ? 'Protezione dei dati offline attiva.'
      : 'Safari gestisce automaticamente la conservazione dei dati.';
    if (status.low) notify('Lo spazio sta finendo. Esporta un backup e libera spazio sull’iPad.', true);
  } catch {
    document.querySelector('#storage-copy').textContent = 'Lo spazio è gestito automaticamente dall’iPad.';
  }
}

// ---------------------------------------------------------------------------
// Aggiornamento a distanza. Skooling non ha un server: la versione nuova arriva
// dal service worker. All'avvio e a ogni ritorno online l'app chiede se c'è una
// versione nuova; quando c'è, il service worker nuovo prende il posto del
// vecchio e l'app si ricarica da sola. Chi la usa non deve fare nulla, e non
// resta bloccato su una copia vecchia.
// ---------------------------------------------------------------------------
let aggiornamentoInSospeso = false;

function applicaAggiornamento() {
  // Se c'è un libro o un quaderno aperto si aspetta: il lavoro è già salvato,
  // ma ricaricare sotto le mani mentre si scrive sarebbe sgradevole.
  if (document.body.classList.contains('workspace-open')) {
    aggiornamentoInSospeso = true;
    notify('Skooling si è aggiornato. La versione nuova parte appena chiudi il libro o il quaderno.');
    return;
  }
  notify('Skooling si è aggiornato.');
  setTimeout(() => location.reload(), 800);
}

export function verificaAggiornamentoInSospeso() {
  if (!aggiornamentoInSospeso || document.body.classList.contains('workspace-open')) return;
  aggiornamentoInSospeso = false;
  location.reload();
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    // updateViaCache 'none': il file sw.js si scarica sempre dalla rete, mai
    // dalla cache del browser. È questo che fa arrivare l'aggiornamento subito.
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    const giaControllato = Boolean(navigator.serviceWorker.controller);
    let ricaricato = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!giaControllato || ricaricato) return;
      ricaricato = true;
      applicaAggiornamento();
    });
    const controlla = () => { if (navigator.onLine) registration.update().catch(() => {}); };
    controlla();
    window.addEventListener('online', controlla);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') controlla(); });
  } catch {
    notify('Per usare Skooling offline, aprilo da un indirizzo sicuro e ricarica.', true);
  }
}

async function start() {
  try {
    await DB.init();
    notebooks = new NotebookManager({ notify, showProgress, hideProgress });
    bindNavigation();
    bindLibrary();
    bindTasks();
    bindSettings();
    const fingerSetting = await DB.get('impostazioni', 'disegna-dito');
    document.querySelector('#global-finger-draw').checked = Boolean(fingerSetting?.valore);
    PDFViewer.setDrawWithFinger(Boolean(fingerSetting?.valore));
    await Promise.all([renderLibrary(), notebooks.renderList(), renderTasks(), updateStorage()]);
    await registerServiceWorker();
  } catch (error) {
    notify(error.message || 'Skooling non riesce ad avviarsi. Ricarica la pagina.', true);
  }
}

start();
