import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIE,
  CAMPANELLE,
  PAUSA,
  ORE_AL_GIORNO,
  FINE_LEZIONI,
  GIORNI,
  GIORNI_DI_SCUOLA,
  orarioIniziale,
  normalizzaOrario,
  normalizzaAssociazioni,
  nomeMateria,
  nomeDellOra,
  giornoHaLezione,
  oreDelGiorno,
  materieDelGiorno,
  prossimoGiornoDiScuola,
  libriDiMateria,
  giornataDiScuola,
  libriDelGiorno,
} from '../orario.js';

const LIBRI = [
  { id: 'l-antologia', titolo: 'Antologia' },
  { id: 'l-grammatica', titolo: 'Grammatica' },
  { id: 'l-storia', titolo: 'Storia' },
  { id: 'l-geografia', titolo: 'Geografia' },
  { id: 'l-arte', titolo: 'Arte e immagine' },
];

test('le materie sono dieci, con id diversi e nomi diversi', () => {
  assert.equal(MATERIE.length, 10);
  assert.equal(new Set(MATERIE.map((m) => m.id)).size, 10);
  assert.equal(new Set(MATERIE.map((m) => m.nome)).size, 10);
  // Le varianti di italiano NON sono materie: i compiti si scrivono su Italiano.
  for (const finta of ['antologia', 'grammatica', 'letture', 'booktalk']) {
    assert.equal(nomeMateria(finta), '', `${finta} non deve essere una materia`);
  }
});

test('le campanelle sono cinque ore da 55 minuti con la pausa dopo la seconda', () => {
  assert.equal(ORE_AL_GIORNO, 5);
  assert.deepEqual(CAMPANELLE[0], { inizio: '8:30', fine: '9:25' });
  assert.deepEqual(CAMPANELLE.at(-1), { inizio: '12:30', fine: '13:25' });
  assert.equal(FINE_LEZIONI, '13:25');
  assert.equal(PAUSA.dopoOra, 2);
  assert.equal(PAUSA.inizio, '10:20');
  assert.equal(PAUSA.fine, '10:40');
  const minuti = (ora) => Number(ora.split(':')[0]) * 60 + Number(ora.split(':')[1]);
  for (const campanella of CAMPANELLE) {
    assert.equal(minuti(campanella.fine) - minuti(campanella.inizio), 55, `${campanella.inizio} non dura 55 minuti`);
  }
});

test('l’orario arrivato dalla scuola è quello che la scuola ha dato', () => {
  const orario = orarioIniziale();
  const letto = (indice) => oreDelGiorno(orario, indice).map((ora) => ora.nome);
  assert.deepEqual(letto(1), ['Italiano (Antologia)', 'Italiano (Grammatica)', 'Storia / Geografia', 'Arte', 'Arte']);
  assert.deepEqual(letto(2), ['Matematica', 'Geometria', 'Italiano (Letture)', 'Storia / Geografia', 'Inglese']);
  assert.deepEqual(letto(3), ['Italiano (Antologia)', 'Italiano (Grammatica)', 'Inglese', 'Scienze', 'Scienze']);
  assert.deepEqual(letto(4), ['Musica', 'Musica', 'Matematica', 'Storia / Geografia', 'Italiano (Book talk)']);
  assert.deepEqual(letto(5), ['Inglese', 'Inglese', 'Geometria', 'Tecnologia', 'Tecnologia']);
});

test('sabato e domenica non c’è lezione', () => {
  const orario = orarioIniziale();
  assert.equal(giornoHaLezione(orario, 0), false, 'domenica');
  assert.equal(giornoHaLezione(orario, 6), false, 'sabato');
  assert.deepEqual(materieDelGiorno(orario, 0), []);
  assert.deepEqual(materieDelGiorno(orario, 6), []);
  for (const indice of GIORNI_DI_SCUOLA) assert.equal(giornoHaLezione(orario, indice), true, GIORNI[indice].nome);
});

test('le ore portano con sé la campanella, in ordine', () => {
  const ore = oreDelGiorno(orarioIniziale(), 2);
  assert.equal(ore.length, 5);
  assert.deepEqual(ore.map((ora) => ora.numero), [1, 2, 3, 4, 5]);
  assert.equal(ore[0].inizio, '8:30');
  assert.equal(ore[2].inizio, '10:40', 'la terza ora comincia dopo la pausa');
  assert.equal(ore.at(-1).fine, '13:25');
});

test('le materie del giorno non si ripetono, anche quando l’ora è doppia', () => {
  const orario = orarioIniziale();
  // Lunedì ha due ore di arte e due di italiano: restano una voce ciascuna.
  assert.deepEqual(materieDelGiorno(orario, 1), ['italiano', 'storia', 'geografia', 'arte']);
  // Martedì: le cinque materie che Gabriel deve vedere aprendo il giorno.
  assert.deepEqual(materieDelGiorno(orario, 2), ['matematica', 'geometria', 'italiano', 'storia', 'geografia', 'inglese']);
  assert.deepEqual(materieDelGiorno(orario, 5), ['inglese', 'geometria', 'tecnologia']);
});

test('l’ora di storia/geografia punta a due materie, non a una materia finta', () => {
  const orario = orarioIniziale();
  const doppia = oreDelGiorno(orario, 1)[2];
  assert.deepEqual(doppia.materie, ['storia', 'geografia'], 'da qui si sceglie se il compito è di storia o di geografia');
  assert.equal(nomeMateria('storia'), 'Storia');
  assert.equal(nomeMateria('geografia'), 'Geografia');
});

test('un orario storto non fa saltare la schermata: diventa ore libere', () => {
  const storto = [[], [{ materie: ['inventata'] }, null, { materie: ['arte', 'arte'] }], 'non un elenco', [], [], [], []];
  const pulito = normalizzaOrario(storto);
  assert.equal(pulito.length, 7);
  assert.equal(pulito[1].length, ORE_AL_GIORNO, 'il giorno si completa fino alla quinta ora');
  assert.deepEqual(pulito[1][0].materie, [], 'una materia che non esiste lascia l’ora libera');
  assert.deepEqual(pulito[1][2].materie, ['arte'], 'la stessa materia due volte nella stessa ora conta una volta');
  assert.deepEqual(pulito[2], [], 'un giorno illeggibile resta senza lezione');
  assert.equal(nomeDellOra(pulito[1][0]), 'Ora libera');
});

test('un orario cambiato vale al posto di quello della scuola', () => {
  // La prova che conta per il vincolo: un cambio della scuola non deve
  // richiedere una riga di codice.
  const orario = orarioIniziale();
  orario[1][3] = { materie: ['musica'], etichetta: '' };
  assert.deepEqual(materieDelGiorno(orario, 1), ['italiano', 'storia', 'geografia', 'musica', 'arte']);
});

test('dopo venerdì si prepara lunedì, e sabato e domenica pure', () => {
  const orario = orarioIniziale();
  const prossimo = (anno, mese, giorno) => prossimoGiornoDiScuola(orario, new Date(anno, mese, giorno));
  // Settembre 2026: il 15 è un martedì.
  assert.equal(new Date(2026, 8, 15).getDay(), 2, 'punto fermo della prova');
  assert.equal(prossimo(2026, 8, 15).getDate(), 16, 'da martedì si prepara mercoledì');
  assert.equal(prossimo(2026, 8, 18).getDate(), 21, 'da venerdì si salta a lunedì');
  assert.equal(prossimo(2026, 8, 19).getDate(), 21, 'sabato si prepara lunedì');
  assert.equal(prossimo(2026, 8, 20).getDate(), 21, 'domenica si prepara lunedì');
  assert.equal(prossimo(2026, 8, 18).getDay(), 1);
});

test('senza nessun giorno di lezione non si promette un domani che non c’è', () => {
  assert.equal(prossimoGiornoDiScuola([[], [], [], [], [], [], []], new Date(2026, 8, 15)), null);
});

test('i libri stanno sulle materie, e l’app ricava da sola quelli del giorno', () => {
  const associazioni = {
    italiano: ['l-antologia', 'l-grammatica'],
    storia: ['l-storia'],
    geografia: ['l-geografia'],
    arte: ['l-arte'],
  };
  const orario = orarioIniziale();
  const zaino = libriDelGiorno(orario, associazioni, LIBRI, 1).map((voce) => voce.libro.titolo);
  assert.deepEqual(zaino, ['Antologia', 'Grammatica', 'Storia', 'Geografia', 'Arte e immagine']);
  // Martedì la stessa associazione dà un altro zaino, senza toccare nulla.
  const martedi = libriDelGiorno(orario, associazioni, LIBRI, 2).map((voce) => voce.libro.titolo);
  assert.deepEqual(martedi, ['Antologia', 'Grammatica', 'Storia', 'Geografia']);
  assert.deepEqual(libriDelGiorno(orario, associazioni, LIBRI, 0), [], 'domenica lo zaino resta chiuso');
});

test('due ore della stessa materia non mettono lo stesso libro due volte nello zaino', () => {
  const zaino = libriDelGiorno(orarioIniziale(), { arte: ['l-arte'] }, LIBRI, 1);
  assert.equal(zaino.length, 1);
  assert.equal(zaino[0].materia, 'Arte');
});

test('una materia senza libri resta nella giornata, così si vede che manca', () => {
  const giornata = giornataDiScuola(orarioIniziale(), { italiano: ['l-antologia'] }, LIBRI, 1);
  assert.deepEqual(giornata.map((materia) => materia.nome), ['Italiano', 'Storia', 'Geografia', 'Arte']);
  assert.deepEqual(giornata[0].libri.map((libro) => libro.titolo), ['Antologia']);
  assert.deepEqual(giornata[1].libri, [], 'storia non ha ancora un libro, e si deve vedere');
});

test('un libro eliminato dalla libreria sparisce dall’associazione', () => {
  const associazioni = normalizzaAssociazioni({ storia: ['l-storia', 'l-cancellato'], finta: ['l-arte'] }, LIBRI);
  assert.deepEqual(associazioni.storia, ['l-storia']);
  assert.equal('finta' in associazioni, false, 'una materia che non esiste non entra');
  assert.deepEqual(associazioni.italiano, [], 'ogni materia ha almeno il suo elenco vuoto');
  assert.deepEqual(libriDiMateria(associazioni, 'storia', LIBRI).map((libro) => libro.titolo), ['Storia']);
});

test('nessun libro è scritto dentro il codice dell’orario', async () => {
  // Il vincolo di Cristian: nessuna associazione cablata. Se qualcuno scrivesse
  // qui il titolo di un libro di Gabriel, un cambio di libro tornerebbe a
  // essere un lavoro da programmatore.
  const { readFile } = await import('node:fs/promises');
  const sorgente = await readFile(new URL('../orario.js', import.meta.url), 'utf8');
  for (const titolo of ['antologia.pdf', 'Storia-completa', 'libro-']) {
    assert.doesNotMatch(sorgente, new RegExp(titolo, 'i'), `orario.js non deve nominare ${titolo}`);
  }
});
