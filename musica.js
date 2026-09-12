// Simboli musicali per il foglio a pentagramma.
//
// I caratteri musicali di Unicode (𝄞, 𝅘, 𝄽...) non ci sono nei font di sistema:
// provati sul dispositivo, disegnano tutti lo stesso rettangolo vuoto. Qui
// quindi i segni si disegnano con la punta, non con un carattere: cosi' si
// vedono uguali dappertutto e restano nitidi a qualunque ingrandimento.
//
// Tutte le misure partono da `unita`, che vale la distanza fra due righe del
// rigo: un segno disegnato su un pentagramma piu' grande cresce con lui.

export const SEGNI_MUSICALI = [
  { chiave: 'chiave-violino', nome: 'Chiave di violino', gruppo: 'chiavi' },
  { chiave: 'chiave-basso', nome: 'Chiave di basso', gruppo: 'chiavi' },
  { chiave: 'semibreve', nome: 'Semibreve', gruppo: 'note' },
  { chiave: 'minima', nome: 'Minima', gruppo: 'note' },
  { chiave: 'semiminima', nome: 'Semiminima', gruppo: 'note' },
  { chiave: 'croma', nome: 'Croma', gruppo: 'note' },
  { chiave: 'pausa-semibreve', nome: 'Pausa di semibreve', gruppo: 'pause' },
  { chiave: 'pausa-minima', nome: 'Pausa di minima', gruppo: 'pause' },
  { chiave: 'pausa-semiminima', nome: 'Pausa di semiminima', gruppo: 'pause' },
  { chiave: 'pausa-croma', nome: 'Pausa di croma', gruppo: 'pause' },
  { chiave: 'diesis', nome: 'Diesis', gruppo: 'segni' },
  { chiave: 'bemolle', nome: 'Bemolle', gruppo: 'segni' },
  { chiave: 'bequadro', nome: 'Bequadro', gruppo: 'segni' },
  { chiave: 'stanghetta', nome: 'Stanghetta', gruppo: 'segni' },
];

const CHIAVI_VALIDE = new Set(SEGNI_MUSICALI.map((segno) => segno.chiave));
export function segnoValido(chiave) { return CHIAVI_VALIDE.has(chiave); }

// Quanto spazio occupa un segno attorno al suo punto di appoggio, in unita'.
// Serve per sapere dove si puo' toccare per riprenderlo e per disegnarne il
// riquadro quando e' scelto.
const INGOMBRI = {
  'chiave-violino': { sinistra: 1.2, destra: 1.2, sopra: 3.4, sotto: 3.0 },
  'chiave-basso': { sinistra: 1.2, destra: 1.4, sopra: 2.2, sotto: 1.4 },
  semibreve: { sinistra: 0.9, destra: 0.9, sopra: 0.7, sotto: 0.7 },
  minima: { sinistra: 0.9, destra: 1.0, sopra: 3.6, sotto: 0.7 },
  semiminima: { sinistra: 0.9, destra: 1.0, sopra: 3.6, sotto: 0.7 },
  croma: { sinistra: 0.9, destra: 1.8, sopra: 3.6, sotto: 0.7 },
  'pausa-semibreve': { sinistra: 0.8, destra: 0.8, sopra: 0.2, sotto: 0.6 },
  'pausa-minima': { sinistra: 0.8, destra: 0.8, sopra: 0.6, sotto: 0.2 },
  'pausa-semiminima': { sinistra: 0.7, destra: 0.7, sopra: 1.6, sotto: 1.6 },
  'pausa-croma': { sinistra: 0.7, destra: 0.7, sopra: 1.2, sotto: 1.2 },
  diesis: { sinistra: 0.6, destra: 0.6, sopra: 1.3, sotto: 1.3 },
  bemolle: { sinistra: 0.5, destra: 0.6, sopra: 2.0, sotto: 0.8 },
  bequadro: { sinistra: 0.5, destra: 0.5, sopra: 1.4, sotto: 1.4 },
  stanghetta: { sinistra: 0.2, destra: 0.2, sopra: 2.2, sotto: 2.2 },
};

export function ingombroSegno(chiave) {
  return INGOMBRI[chiave] || { sinistra: 1, destra: 1, sopra: 1, sotto: 1 };
}

// La testa della nota: un ovale inclinato, come quello scritto a mano.
function testaNota(context, x, y, unita, piena) {
  context.save();
  context.translate(x, y);
  context.rotate(-0.34);
  context.beginPath();
  context.ellipse(0, 0, unita * 0.72, unita * 0.52, 0, 0, Math.PI * 2);
  if (piena) context.fill();
  else { context.lineWidth = Math.max(1, unita * 0.16); context.stroke(); }
  context.restore();
}

function gambo(context, x, y, unita, versoSu = true) {
  const altezza = unita * 3.3;
  const dx = versoSu ? unita * 0.66 : -unita * 0.66;
  const da = versoSu ? y - unita * 0.1 : y + unita * 0.1;
  const a = versoSu ? y - altezza : y + altezza;
  context.lineWidth = Math.max(1, unita * 0.15);
  context.beginPath();
  context.moveTo(x + dx, da);
  context.lineTo(x + dx, a);
  context.stroke();
  return { x: x + dx, y: a };
}

function bandierina(context, cima, unita) {
  context.beginPath();
  context.moveTo(cima.x, cima.y);
  context.bezierCurveTo(
    cima.x + unita * 1.3, cima.y + unita * 0.5,
    cima.x + unita * 1.0, cima.y + unita * 1.6,
    cima.x + unita * 0.15, cima.y + unita * 2.1,
  );
  context.bezierCurveTo(
    cima.x + unita * 0.9, cima.y + unita * 1.4,
    cima.x + unita * 1.0, cima.y + unita * 0.8,
    cima.x, cima.y + unita * 0.9,
  );
  context.fill();
}

function chiaveDiViolino(context, x, y, unita) {
  // Il ricciolo si costruisce a spirale attorno alla riga del sol, che e' il
  // punto di appoggio: cosi' la chiave cade sempre dove deve stare.
  context.lineWidth = Math.max(1.2, unita * 0.22);
  context.beginPath();
  context.moveTo(x + unita * 0.15, y + unita * 2.6);
  context.bezierCurveTo(x + unita * 1.5, y + unita * 2.2, x + unita * 1.4, y + unita * 0.6, x + unita * 0.2, y + unita * 0.4);
  context.bezierCurveTo(x - unita * 1.1, y + unita * 0.2, x - unita * 1.2, y - unita * 1.2, x + unita * 0.1, y - unita * 1.6);
  context.bezierCurveTo(x + unita * 1.1, y - unita * 1.9, x + unita * 1.0, y - unita * 3.2, x + unita * 0.1, y - unita * 3.3);
  context.bezierCurveTo(x - unita * 0.7, y - unita * 3.4, x - unita * 0.55, y - unita * 2.2, x - unita * 0.35, y - unita * 1.0);
  context.bezierCurveTo(x - unita * 0.05, y + unita * 0.9, x + unita * 0.45, y + unita * 2.0, x + unita * 0.3, y + unita * 3.0);
  context.stroke();
  // la codina in basso
  context.beginPath();
  context.arc(x + unita * 0.05, y + unita * 2.95, unita * 0.28, 0, Math.PI * 2);
  context.fill();
}

function chiaveDiBasso(context, x, y, unita) {
  context.lineWidth = Math.max(1.2, unita * 0.24);
  context.beginPath();
  context.arc(x - unita * 0.1, y - unita * 0.05, unita * 0.3, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.moveTo(x, y - unita * 0.35);
  context.bezierCurveTo(x + unita * 1.5, y - unita * 0.6, x + unita * 1.3, y + unita * 1.5, x - unita * 0.6, y + unita * 1.3);
  context.stroke();
  for (const dy of [-unita * 0.45, unita * 0.45]) {
    context.beginPath();
    context.arc(x + unita * 1.15, y + dy, unita * 0.16, 0, Math.PI * 2);
    context.fill();
  }
}

function pausaSemiminima(context, x, y, unita) {
  context.lineWidth = Math.max(1.2, unita * 0.24);
  context.beginPath();
  context.moveTo(x - unita * 0.45, y - unita * 1.45);
  context.lineTo(x + unita * 0.35, y - unita * 0.45);
  context.lineTo(x - unita * 0.35, y + unita * 0.1);
  context.lineTo(x + unita * 0.45, y + unita * 1.0);
  context.stroke();
  context.beginPath();
  context.moveTo(x + unita * 0.2, y + unita * 1.45);
  context.bezierCurveTo(x - unita * 0.6, y + unita * 0.9, x + unita * 0.1, y + unita * 0.5, x + unita * 0.45, y + unita * 1.0);
  context.fill();
}

function pausaCroma(context, x, y, unita) {
  context.lineWidth = Math.max(1.2, unita * 0.2);
  context.beginPath();
  context.moveTo(x + unita * 0.45, y - unita * 1.0);
  context.lineTo(x - unita * 0.2, y + unita * 1.15);
  context.stroke();
  context.beginPath();
  context.arc(x + unita * 0.2, y - unita * 0.85, unita * 0.24, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.moveTo(x + unita * 0.36, y - unita * 0.9);
  context.bezierCurveTo(x + unita * 0.9, y - unita * 0.5, x + unita * 0.6, y - unita * 0.2, x + unita * 0.2, y - unita * 0.4);
  context.fill();
}

function alterazioneDiesis(context, x, y, unita) {
  context.lineWidth = Math.max(1, unita * 0.15);
  for (const dx of [-unita * 0.22, unita * 0.22]) {
    context.beginPath();
    context.moveTo(x + dx, y - unita * 1.1);
    context.lineTo(x + dx, y + unita * 1.1);
    context.stroke();
  }
  context.lineWidth = Math.max(1.4, unita * 0.26);
  for (const dy of [-unita * 0.38, unita * 0.38]) {
    context.beginPath();
    context.moveTo(x - unita * 0.5, y + dy + unita * 0.16);
    context.lineTo(x + unita * 0.5, y + dy - unita * 0.16);
    context.stroke();
  }
}

function alterazioneBemolle(context, x, y, unita) {
  context.lineWidth = Math.max(1, unita * 0.16);
  context.beginPath();
  context.moveTo(x - unita * 0.3, y - unita * 1.8);
  context.lineTo(x - unita * 0.3, y + unita * 0.7);
  context.stroke();
  context.beginPath();
  context.moveTo(x - unita * 0.3, y + unita * 0.55);
  context.bezierCurveTo(x + unita * 0.9, y - unita * 0.35, x + unita * 0.5, y - unita * 0.95, x - unita * 0.3, y - unita * 0.25);
  context.stroke();
}

function alterazioneBequadro(context, x, y, unita) {
  context.lineWidth = Math.max(1, unita * 0.16);
  context.beginPath();
  context.moveTo(x - unita * 0.28, y - unita * 1.2);
  context.lineTo(x - unita * 0.28, y + unita * 0.6);
  context.moveTo(x + unita * 0.28, y - unita * 0.6);
  context.lineTo(x + unita * 0.28, y + unita * 1.2);
  context.stroke();
  context.lineWidth = Math.max(1.3, unita * 0.24);
  context.beginPath();
  context.moveTo(x - unita * 0.28, y - unita * 0.42);
  context.lineTo(x + unita * 0.28, y - unita * 0.6);
  context.moveTo(x - unita * 0.28, y + unita * 0.42);
  context.lineTo(x + unita * 0.28, y + unita * 0.24);
  context.stroke();
}

// Disegna un segno musicale col suo punto di appoggio in (x, y).
export function disegnaSegnoMusicale(context, chiave, x, y, unita, colore = '#1f2937') {
  context.save();
  context.strokeStyle = colore;
  context.fillStyle = colore;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  switch (chiave) {
    case 'chiave-violino': chiaveDiViolino(context, x, y, unita); break;
    case 'chiave-basso': chiaveDiBasso(context, x, y, unita); break;
    case 'semibreve': testaNota(context, x, y, unita, false); break;
    case 'minima': testaNota(context, x, y, unita, false); gambo(context, x, y, unita); break;
    case 'semiminima': testaNota(context, x, y, unita, true); gambo(context, x, y, unita); break;
    case 'croma': {
      testaNota(context, x, y, unita, true);
      bandierina(context, gambo(context, x, y, unita), unita);
      break;
    }
    case 'pausa-semibreve':
      context.fillRect(x - unita * 0.7, y, unita * 1.4, unita * 0.45);
      break;
    case 'pausa-minima':
      context.fillRect(x - unita * 0.7, y - unita * 0.45, unita * 1.4, unita * 0.45);
      break;
    case 'pausa-semiminima': pausaSemiminima(context, x, y, unita); break;
    case 'pausa-croma': pausaCroma(context, x, y, unita); break;
    case 'diesis': alterazioneDiesis(context, x, y, unita); break;
    case 'bemolle': alterazioneBemolle(context, x, y, unita); break;
    case 'bequadro': alterazioneBequadro(context, x, y, unita); break;
    case 'stanghetta':
      context.lineWidth = Math.max(1.2, unita * 0.2);
      context.beginPath();
      context.moveTo(x, y - unita * 2);
      context.lineTo(x, y + unita * 2);
      context.stroke();
      break;
    default: break;
  }
  context.restore();
}
