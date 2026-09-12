// Album delle attività: le foto dei laboratori e delle giornate di classe che
// non appartengono a un compito. Restano sul dispositivo come tutto il resto.
import { DB, createId } from './db.js';

// Le foto dei tablet sono grandi: si rimpiccioliscono prima di archiviarle, così
// l'album non si mangia lo spazio del dispositivo. Il lato lungo basta che stia
// dentro questa misura per vedersi bene anche a schermo intero.
const LATO_MASSIMO = 1600;

export async function ridimensionaFoto(file, latoMassimo = LATO_MASSIMO) {
  const immagine = await caricaImmagine(file);
  const lato = Math.max(immagine.width, immagine.height);
  const scala = lato > latoMassimo ? latoMassimo / lato : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(immagine.width * scala);
  canvas.height = Math.round(immagine.height * scala);
  canvas.getContext('2d').drawImage(immagine, 0, 0, canvas.width, canvas.height);
  immagine.close?.();
  const ridotta = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  // Se la foto era già piccola, comprimerla non conviene: si tiene l'originale.
  return ridotta && ridotta.size < file.size ? ridotta : file;
}

function caricaImmagine(file) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const immagine = new Image();
    immagine.onload = () => { URL.revokeObjectURL(url); resolve(immagine); };
    immagine.onerror = () => { URL.revokeObjectURL(url); reject(new Error('foto illeggibile')); };
    immagine.src = url;
  });
}

export function nomeDalFile(file) {
  const senzaEstensione = file.name.replace(/\.[a-z0-9]+$/i, '').trim();
  return senzaEstensione || 'Foto';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

export class AlbumManager {
  constructor(options = {}) {
    this.notify = options.notify || (() => {});
    this.showProgress = options.showProgress || (() => {});
    this.hideProgress = options.hideProgress || (() => {});
    this.mostraFoto = options.mostraFoto || (() => {});
    // Gli indirizzi temporanei delle immagini si liberano a ogni ridisegno,
    // altrimenti la memoria cresce a ogni visita all'album.
    this.urls = [];
    this.bind();
  }

  bind() {
    document.querySelector('#album-input').addEventListener('change', (event) => this.aggiungi(event.target.files));
  }

  async aggiungi(files) {
    const immagini = [...files].filter((file) => file.type.startsWith('image/'));
    document.querySelector('#album-input').value = '';
    if (!immagini.length) return this.notify('Scegli una foto.', true);
    let aggiunte = 0;
    for (let indice = 0; indice < immagini.length; indice += 1) {
      const file = immagini[indice];
      this.showProgress('Aggiungo le foto', `${indice + 1} di ${immagini.length}`, indice / immagini.length);
      try {
        await DB.put('foto', {
          id: createId('foto'),
          titolo: nomeDalFile(file),
          immagine: await ridimensionaFoto(file),
          data: Date.now(),
        });
        aggiunte += 1;
      } catch {
        this.notify(`“${file.name}” non si riesce a leggere. Le altre continuano.`, true);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    this.hideProgress();
    await this.renderList();
    if (aggiunte) this.notify(aggiunte === 1 ? 'Foto aggiunta all’album.' : `${aggiunte} foto aggiunte all’album.`);
  }

  async renderList() {
    const foto = (await DB.getAll('foto')).sort((a, b) => b.data - a.data);
    this.urls.forEach((url) => URL.revokeObjectURL(url));
    this.urls = [];
    document.querySelector('#album-empty').hidden = foto.length > 0;
    const griglia = document.querySelector('#album-grid');
    griglia.replaceChildren();
    for (const scatto of foto) griglia.append(this.creaScheda(scatto));
  }

  creaScheda(scatto) {
    const scheda = document.createElement('article');
    scheda.className = 'album-card';
    let immagine = '<div class="album-missing">Foto non disponibile</div>';
    if (scatto.immagine instanceof Blob) {
      const url = URL.createObjectURL(scatto.immagine);
      this.urls.push(url);
      immagine = `<img src="${url}" alt="${escapeHtml(scatto.titolo)}" loading="lazy">`;
    }
    const giorno = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(scatto.data));
    scheda.innerHTML = `<button type="button" class="album-open">${immagine}</button>`
      + `<div class="album-info"><strong>${escapeHtml(scatto.titolo)}</strong><span>${giorno}</span></div>`
      + '<button type="button" class="card-menu" aria-label="Azioni foto">⋯</button>'
      + '<div class="card-actions" hidden><button type="button" data-rename>Cambia nome</button><button type="button" data-delete class="danger-text">Elimina foto</button></div>';
    scheda.querySelector('.album-open').addEventListener('click', () => this.mostraFoto(scatto));
    scheda.querySelector('.card-menu').addEventListener('click', () => {
      const menu = scheda.querySelector('.card-actions');
      menu.hidden = !menu.hidden;
    });
    scheda.querySelector('[data-rename]').addEventListener('click', async () => {
      const titolo = prompt('Come si chiama questa foto?', scatto.titolo);
      if (titolo === null) return;
      await DB.put('foto', { ...scatto, titolo: titolo.trim() || scatto.titolo });
      await this.renderList();
    });
    scheda.querySelector('[data-delete]').addEventListener('click', async () => {
      if (!confirm(`Eliminare la foto “${scatto.titolo}”?`)) return;
      await DB.delete('foto', scatto.id);
      await this.renderList();
      this.notify('Foto eliminata.');
    });
    return scheda;
  }
}
