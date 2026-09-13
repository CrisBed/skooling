// Simboli musicali per il foglio a pentagramma.
//
// I segni NON sono disegnati a mano: sono i glifi veri di Bravura, il font di
// notazione di riferimento (standard SMuFL, licenza SIL Open Font, copia in
// vendor/BRAVURA-LICENSE.txt). Di quel font l'app porta con sé soltanto i
// sedici glifi che servono, 6 KB in tutto, in vendor/SkoolingMusica.woff2.
//
// Perché un font e non dei tracciati: le prime due versioni erano disegnate a
// occhio e si vedeva. I caratteri musicali dei font di sistema invece non
// esistono (provati: disegnano tutti lo stesso rettangolo vuoto), quindi la
// strada giusta è portarsi dietro il font giusto.
//
// In SMuFL un em vale l'altezza del rigo, cioè quattro spazi fra le righe.
// Quindi per disegnare con un rigo di passo `unita` si scrive a `unita * 4`, e
// la linea di base del carattere cade esattamente sulla riga del rigo a cui il
// segno appartiene: la chiave di violino sulla riga del sol, la pausa di
// semibreve appesa alla sua riga, e così via. È il font a saperlo, non noi.

export const FONT_MUSICA = 'SkoolingMusica';
const SPAZI_PER_EM = 4;

// Ingombro di ogni glifo, misurato dal font vero con fontTools e scritto qui in
// spazi di rigo. `x` cresce verso destra, `y` verso l'alto come nel font.
// `ancora` dice cosa deve cadere sotto il dito: 'testa' per le note, dove conta
// la testa e non il gambo, 'centro' per tutto il resto.
const GLIFI = {
  'chiave-violino': { carattere: '\uE050', x: [0, 2.68], y: [-2.63, 4.39], ancora: 'centro' },
  'chiave-basso': { carattere: '\uE062', x: [-0.02, 2.74], y: [-2.54, 1.05], ancora: 'centro' },
  semibreve: { carattere: '\uE1D2', x: [0, 1.84], y: [-0.55, 0.54], ancora: 'centro' },
  minima: { carattere: '\uE1D3', x: [0, 1.36], y: [-0.58, 3.50], ancora: 'testa' },
  semiminima: { carattere: '\uE1D5', x: [0, 1.33], y: [-0.56, 3.50], ancora: 'testa' },
  croma: { carattere: '\uE1D7', x: [0, 2.26], y: [-0.55, 3.49], ancora: 'testa' },
  'pausa-semibreve': { carattere: '\uE4E3', x: [0, 1.13], y: [-0.54, 0.04], ancora: 'centro' },
  'pausa-minima': { carattere: '\uE4E4', x: [0, 1.13], y: [-0.01, 0.57], ancora: 'centro' },
  'pausa-semiminima': { carattere: '\uE4E5', x: [0, 1.08], y: [-1.50, 1.49], ancora: 'centro' },
  'pausa-croma': { carattere: '\uE4E6', x: [0, 0.99], y: [-1.00, 0.70], ancora: 'centro' },
  diesis: { carattere: '\uE262', x: [0, 1.00], y: [-1.39, 1.40], ancora: 'centro' },
  bemolle: { carattere: '\uE260', x: [0, 0.90], y: [-0.70, 1.76], ancora: 'centro' },
  bequadro: { carattere: '\uE261', x: [0, 0.67], y: [-1.34, 1.36], ancora: 'centro' },
  punto: { carattere: '\uE1E7', x: [0, 0.40], y: [-0.20, 0.20], ancora: 'centro' },
  terzina: { carattere: '\uE883', x: [0.04, 1.22], y: [-0.03, 1.50], ancora: 'centro' },
  // La stanghetta nel font parte dalla riga di sotto e sale per tutto il rigo:
  // la si abbassa di due spazi perché stia centrata sul punto toccato.
  stanghetta: { carattere: '\uE030', x: [0, 0.16], y: [0, 4.00], ancora: 'centro', abbassa: 2 },
};

// La larghezza della testa di nota in Bravura: serve a mettere sotto il dito la
// testa e non l'insieme testa più gambo, che pende tutto da una parte.
const LARGHEZZA_TESTA = 1.18;

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
  { chiave: 'punto', nome: 'Punto di valore', gruppo: 'segni' },
  { chiave: 'terzina', nome: 'Terzina', gruppo: 'segni' },
  { chiave: 'legatura', nome: 'Legatura', gruppo: 'segni' },
  { chiave: 'stanghetta', nome: 'Stanghetta', gruppo: 'segni' },
];

const CHIAVI_VALIDE = new Set(SEGNI_MUSICALI.map((segno) => segno.chiave));
export function segnoValido(chiave) { return CHIAVI_VALIDE.has(chiave); }

// La legatura non è un carattere: nella notazione vera è un archetto che si
// disegna lungo quanto serve, e nei font di notazione infatti non c'è.
const LEGATURA = { sinistra: 1.6, destra: 1.6, sopra: 1.0, sotto: 0.2 };

// Di quanto si sposta il glifo perché il punto giusto cada sotto il dito.
function scostamento(segno) {
  if (segno.ancora === 'testa') return -LARGHEZZA_TESTA / 2;
  return -(segno.x[0] + (segno.x[1] - segno.x[0]) / 2);
}

// Quanto spazio occupa un segno attorno al suo punto di appoggio, in spazi di
// rigo. Serve per sapere dove si può toccare per riprenderlo e per disegnarne
// il riquadro quando è scelto.
export function ingombroSegno(chiave) {
  if (chiave === 'legatura') return { ...LEGATURA };
  const segno = GLIFI[chiave];
  if (!segno) return { sinistra: 1, destra: 1, sopra: 1, sotto: 1 };
  const dx = scostamento(segno);
  const dy = segno.abbassa || 0;
  return {
    sinistra: Math.max(0.2, -(dx + segno.x[0])),
    destra: Math.max(0.2, dx + segno.x[1]),
    sopra: Math.max(0.2, segno.y[1] - dy),
    sotto: Math.max(0.2, -segno.y[0] + dy),
  };
}

// ---------------------------------------------------------------------------
// Il font va caricato prima di poterci scrivere sopra una tela: finché non è
// pronto, `fillText` non disegna niente. Chi disegna chiede `fontePronta()` e
// ridisegna quando la promessa si scioglie.
// ---------------------------------------------------------------------------
let attesaFont = null;
export function fontePronta() {
  if (attesaFont) return attesaFont;
  if (typeof document === 'undefined' || !document.fonts) {
    attesaFont = Promise.resolve(false);
    return attesaFont;
  }
  attesaFont = document.fonts.load(`40px "${FONT_MUSICA}"`)
    .then((caricati) => caricati.length > 0)
    .catch(() => false);
  return attesaFont;
}

function disegnaLegatura(context, x, y, unita, colore) {
  context.strokeStyle = colore;
  context.lineWidth = Math.max(1, unita * 0.14);
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(x - LEGATURA.sinistra * unita, y);
  context.bezierCurveTo(
    x - unita * 0.9, y - unita * 1.25,
    x + unita * 0.9, y - unita * 1.25,
    x + LEGATURA.destra * unita, y,
  );
  context.stroke();
}

// Disegna un segno musicale col suo punto di appoggio in (x, y). `unita` è il
// passo fra due righe del rigo.
export function disegnaSegnoMusicale(context, chiave, x, y, unita, colore = '#1f2937') {
  context.save();
  context.fillStyle = colore;
  if (chiave === 'legatura') {
    disegnaLegatura(context, x, y, unita, colore);
    context.restore();
    return;
  }
  const segno = GLIFI[chiave];
  if (!segno) { context.restore(); return; }
  context.font = `${unita * SPAZI_PER_EM}px "${FONT_MUSICA}"`;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillText(segno.carattere, x + scostamento(segno) * unita, y + (segno.abbassa || 0) * unita);
  context.restore();
}
