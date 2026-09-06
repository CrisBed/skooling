// Disegni vettoriali dei personaggi di "Gabriel & Ovale" (stile fumetto, china nera, colori vivaci)
const INK = '#1a1a1a';
const SKIN = '#f6c9a0';
const SKIN_DARK = '#d9a273';
const HAIR = '#6e4423';
const HAIR_DARK = '#4a2c14';
const AZZ = '#63b6ec';   // maglia azzurra
const WHITE = '#ffffff';
const BLU = '#1e4fa3';   // fasce di Ovale e scarpe
const RED = '#d7262c';
const BLACK = '#232323';
const SOCK = '#2a2f4a';
const MUD = '#9b7a4e';

function limb(pts, color, w, opts = {}) {
  const d = 'M' + pts.map(p => p.join(',')).join(' L');
  return `<path d="${d}" stroke="${INK}" stroke-width="${w + 6}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
         `<path d="${d}" stroke="${color}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// Pattern delle maglie: da mettere una volta sola nel <defs> di ogni svg
function kitDefs(id = '') {
  return `
  <pattern id="kitG${id}" patternUnits="userSpaceOnUse" width="40" height="22">
    <rect width="40" height="22" fill="${AZZ}"/>
    <rect y="12" width="40" height="8" fill="${WHITE}"/>
  </pattern>
  <pattern id="kitO${id}" patternUnits="userSpaceOnUse" width="40" height="22">
    <rect width="40" height="22" fill="${BLACK}"/>
    <rect y="12" width="40" height="8" fill="${RED}"/>
  </pattern>`;
}

// Testa di Gabriel vista frontale, centrata in (0,0), raggio ~46
function gabrielHeadFront(opts = {}) {
  const s = opts.scale || 1;
  const mouth = opts.mouth || 'smile';
  const wink = opts.wink;
  let g = `<g transform="scale(${s})">`;
  // capelli dietro
  g += `<g fill="${HAIR}" stroke="${INK}" stroke-width="3">
    <circle cx="-44" cy="-22" r="16"/><circle cx="44" cy="-22" r="16"/>
    <circle cx="-30" cy="-42" r="17"/><circle cx="30" cy="-42" r="17"/>
    <circle cx="0" cy="-50" r="19"/><circle cx="-15" cy="-48" r="16"/><circle cx="15" cy="-48" r="16"/>
  </g>`;
  // orecchie
  g += `<circle cx="-46" cy="4" r="9" fill="${SKIN}" stroke="${INK}" stroke-width="3"/><circle cx="46" cy="4" r="9" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>`;
  // viso
  g += `<ellipse cx="0" cy="0" rx="44" ry="48" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>`;
  // ciuffi davanti
  g += `<g fill="${HAIR}" stroke="${INK}" stroke-width="3">
    <circle cx="-34" cy="-30" r="13"/><circle cx="-14" cy="-40" r="14"/><circle cx="8" cy="-42" r="14"/><circle cx="30" cy="-34" r="13"/>
    <path d="M-40,-22 q6,10 0,18" fill="none"/>
  </g>`;
  // lentiggini
  g += `<g fill="${SKIN_DARK}"><circle cx="-26" cy="14" r="1.8"/><circle cx="-32" cy="19" r="1.8"/><circle cx="-20" cy="20" r="1.8"/><circle cx="26" cy="14" r="1.8"/><circle cx="32" cy="19" r="1.8"/><circle cx="20" cy="20" r="1.8"/></g>`;
  // occhi
  g += `<ellipse cx="-16" cy="2" rx="9" ry="11" fill="${WHITE}" stroke="${INK}" stroke-width="2.5"/>`;
  g += `<circle cx="-14" cy="4" r="5" fill="${INK}"/><circle cx="-12" cy="2" r="1.8" fill="${WHITE}"/>`;
  if (wink) {
    g += `<path d="M6,4 q10,-8 20,0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  } else {
    g += `<ellipse cx="16" cy="2" rx="9" ry="11" fill="${WHITE}" stroke="${INK}" stroke-width="2.5"/>`;
    g += `<circle cx="18" cy="4" r="5" fill="${INK}"/><circle cx="20" cy="2" r="1.8" fill="${WHITE}"/>`;
  }
  // sopracciglia
  g += `<path d="M-26,-14 q10,-6 20,-2" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M26,-14 q-10,-6 -20,-2" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  // naso
  g += `<path d="M0,10 q4,8 -2,12" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  // bocca
  if (mouth === 'smile') {
    g += `<path d="M-18,24 q18,20 36,0 q-18,8 -36,0 z" fill="${WHITE}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
  } else {
    g += `<path d="M-14,26 q14,14 28,0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
  g += `</g>`;
  return g;
}

// Busto di Gabriel che saluta, frontale. Origine: centro del collo (0,0). Larghezza ~230, altezza ~250 (testa sopra, busto sotto)
function gabrielBustWave(id = '') {
  let g = '';
  // braccio sinistro (di chi guarda) giu'
  g += limb([[-62, 30], [-90, 90], [-98, 130]], AZZ, 24);
  g += `<circle cx="-100" cy="140" r="14" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>`;
  // busto
  g += `<path d="M-60,22 Q0,0 60,22 L78,150 L-78,150 Z" fill="url(#kitG${id})" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`;
  // colletto
  g += `<path d="M-26,18 L0,40 L26,18 Q0,8 -26,18 Z" fill="${WHITE}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  // sponsor
  g += `<rect x="-52" y="64" width="104" height="26" rx="6" fill="${WHITE}" stroke="${INK}" stroke-width="2.5"/>`;
  g += `<text x="0" y="83" text-anchor="middle" font-family="Bangers" font-size="19" fill="#143a7a" letter-spacing="1">LAFERT GROUP</text>`;
  // braccio destro alzato che saluta
  g += limb([[62, 30], [100, 0], [112, -60]], AZZ, 24);
  g += limb([[112, -60], [116, -72]], SKIN, 20);
  // mano aperta
  g += `<g transform="translate(116,-92)"><ellipse cx="0" cy="8" rx="16" ry="15" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>
    <g stroke="${INK}" stroke-width="3" fill="${SKIN}" stroke-linecap="round">
      <path d="M-12,-2 l-4,-16 a4,4 0 0 1 8,0 l2,16"/><path d="M-4,-6 l-2,-20 a4,4 0 0 1 8,0 l0,20"/><path d="M6,-6 l2,-18 a4,4 0 0 1 8,0 l-4,18"/><path d="M14,0 l6,-12 a4,4 0 0 1 6,4 l-8,12"/><path d="M-16,8 l-10,-4 a4,4 0 0 1 4,-7 l10,6"/>
    </g></g>`;
  // linee di movimento del saluto
  g += `<g stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M140,-100 q8,-6 14,-14"/><path d="M148,-84 q10,-2 18,-6"/><path d="M132,-112 q4,-8 4,-16"/></g>`;
  // collo
  g += `<rect x="-11" y="-14" width="22" height="30" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>`;
  // testa
  g += `<g transform="translate(0,-52)">${gabrielHeadFront({})}</g>`;
  return g;
}

// Ovale, il pallone parlante. Origine: centro del pallone. Altezza ~190.
function ovale(opts = {}) {
  const wink = opts.wink;
  const s = opts.scale || 1;
  const tilt = opts.tilt || -12;
  const cid = 'ov' + Math.floor(Math.random() * 1e9);
  let g = `<g transform="scale(${s})">`;
  // gambe e scarpe
  g += limb([[-20, 60], [-26, 86]], INK, 5);
  g += limb([[20, 60], [26, 86]], INK, 5);
  g += `<g fill="${BLU}" stroke="${INK}" stroke-width="3"><path d="M-44,92 q6,-14 22,-12 q10,2 14,12 q-16,8 -36,0 z"/><path d="M8,92 q4,-10 14,-12 q16,-2 22,12 q-20,8 -36,0 z"/></g>`;
  g += `<g fill="${WHITE}"><circle cx="-36" cy="93" r="1.6"/><circle cx="-26" cy="95" r="1.6"/><circle cx="-16" cy="95" r="1.6"/><circle cx="16" cy="95" r="1.6"/><circle cx="26" cy="95" r="1.6"/><circle cx="36" cy="93" r="1.6"/></g>`;
  // braccia
  g += limb([[-46, 10], [-64, 30], [-70, 52]], INK, 5);
  g += limb([[46, 10], [64, 30], [70, 52]], INK, 5);
  // pallone
  g += `<g transform="rotate(${tilt})">
    <clipPath id="${cid}"><ellipse cx="0" cy="0" rx="50" ry="72"/></clipPath>
    <ellipse cx="0" cy="0" rx="50" ry="72" fill="${WHITE}" stroke="${INK}" stroke-width="4"/>
    <g clip-path="url(#${cid})">
      <path d="M-60,-46 q60,-14 120,0 l0,16 q-60,-14 -120,0 z" fill="${BLU}"/>
      <path d="M-60,40 q60,-14 120,0 l0,16 q-60,-14 -120,0 z" fill="${BLU}"/>
    </g>
    <path d="M-60,-46 q60,-14 120,0 M-60,-30 q60,-14 120,0 M-60,40 q60,-14 120,0 M-60,56 q60,-14 120,0" stroke="${INK}" stroke-width="2" fill="none"/>
    <g stroke="${INK}" stroke-width="2.5" stroke-linecap="round"><path d="M34,-14 l0,30"/><path d="M28,-8 l12,0"/><path d="M28,0 l12,0"/><path d="M28,8 l12,0"/></g>
  </g>`;
  // guanti
  g += `<g fill="${WHITE}" stroke="${INK}" stroke-width="3"><circle cx="-72" cy="60" r="13"/><circle cx="-82" cy="52" r="5"/><circle cx="72" cy="60" r="13"/><circle cx="82" cy="52" r="5"/></g>`;
  // occhi
  g += `<ellipse cx="-18" cy="-12" rx="14" ry="17" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>`;
  g += `<circle cx="-15" cy="-9" r="7" fill="${INK}"/><circle cx="-12" cy="-12" r="2.5" fill="${WHITE}"/>`;
  if (wink) {
    g += `<path d="M6,-10 q12,-10 24,-2" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    g += `<path d="M4,-30 q12,-8 24,-4" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  } else {
    g += `<ellipse cx="18" cy="-12" rx="14" ry="17" fill="${WHITE}" stroke="${INK}" stroke-width="3"/>`;
    g += `<circle cx="21" cy="-9" r="7" fill="${INK}"/><circle cx="24" cy="-12" r="2.5" fill="${WHITE}"/>`;
    g += `<path d="M6,-32 q12,-8 24,-2" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  }
  g += `<path d="M-32,-32 q12,-8 24,-2" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  // bocca
  g += `<path d="M-20,22 q20,22 40,0 q-20,8 -40,0 z" fill="${WHITE}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  g += `<path d="M-14,26 q14,8 28,0" stroke="${INK}" stroke-width="2" fill="none"/>`;
  g += `</g>`;
  return g;
}

// Testa laterale (profilo) di un giocatore. facing: -1 guarda a sinistra, 1 a destra
function headSide(who, facing = -1, opts = {}) {
  const r = 21;
  let g = `<g transform="scale(${facing},1)">`; // disegno come se guardasse a sinistra
  if (who === 'gabriel') {
    g += `<g fill="${HAIR}" stroke="${INK}" stroke-width="3"><circle cx="10" cy="-14" r="12"/><circle cx="18" cy="-2" r="11"/><circle cx="-4" cy="-18" r="12"/><circle cx="-16" cy="-12" r="10"/></g>`;
  } else {
    g += `<path d="M-20,-8 q4,-22 26,-18 q14,4 14,20 l-8,10 q-4,-16 -18,-14 q-8,0 -14,2 z" fill="${HAIR_DARK}" stroke="${INK}" stroke-width="3"/>`;
  }
  g += `<circle cx="0" cy="0" r="${r}" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>`;
  g += `<circle cx="14" cy="2" r="6" fill="${SKIN}" stroke="${INK}" stroke-width="2.5"/>`;
  if (who === 'gabriel') {
    g += `<g fill="${HAIR}" stroke="${INK}" stroke-width="3"><circle cx="-12" cy="-16" r="9"/><circle cx="2" cy="-19" r="9"/></g>`;
    g += `<g fill="${SKIN_DARK}"><circle cx="-10" cy="8" r="1.5"/><circle cx="-14" cy="12" r="1.5"/><circle cx="-6" cy="12" r="1.5"/></g>`;
  }
  // occhio
  g += `<ellipse cx="-9" cy="-2" rx="5" ry="6" fill="${WHITE}" stroke="${INK}" stroke-width="2"/><circle cx="-11" cy="-1" r="2.6" fill="${INK}"/>`;
  g += `<path d="M-16,-11 q6,-4 12,-2" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  // naso e bocca
  g += `<path d="M-20,4 q-4,4 0,7" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  if (opts.mouth === 'oh') {
    g += `<ellipse cx="-12" cy="13" rx="3.5" ry="4.5" fill="${INK}"/>`;
  } else if (opts.mouth === 'grit') {
    g += `<path d="M-17,13 l10,0" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
  } else {
    g += `<path d="M-17,11 q6,6 12,1" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  }
  g += `</g>`;
  return g;
}

// Giocatore "a pupazzo" con giunti. pose: {head:[x,y], neck:[x,y], hip:[x,y], torsoW, legs:[[hip,knee,ankle],...], arms:[[sh,el,hand],...]}
// kit: 'gabriel' | 'opp'. Restituisce pezzi separati per controllare l'ordine di disegno
function player(kit, pose, id = '', opts = {}) {
  const jersey = kit === 'gabriel' ? `url(#kitG${id})` : `url(#kitO${id})`;
  const sleeve = kit === 'gabriel' ? AZZ : BLACK;
  const shorts = kit === 'gabriel' ? '#f3efe6' : BLACK;
  const boot = kit === 'gabriel' ? '#1d3f8f' : '#d7262c';
  const parts = {};
  const legs = pose.legs.map(L => {
    let s = limb([L[0], L[1]], shorts, 20);
    s += limb([L[1], L[2]], SKIN, 15);
    // calzettone e scarpa
    const [kx, ky] = L[1], [ax, ay] = L[2];
    const mx = kx + (ax - kx) * 0.55, my = ky + (ay - ky) * 0.55;
    s += limb([[mx, my], [ax, ay]], SOCK, 15);
    const fdir = pose.facing || -1;
    s += `<g transform="translate(${ax},${ay})"><path d="M${-8 * fdir},-6 l${16 * fdir},0 q${10 * fdir},2 ${12 * fdir},10 l${-30 * fdir},0 q${-2 * fdir},-8 ${2 * fdir},-10 z" fill="${boot}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></g>`;
    return s;
  });
  parts.legBack = legs[0];
  parts.legFront = legs[1];
  const arms = pose.arms.map(A => {
    let s = limb([A[0], A[1]], sleeve, 19);
    s += limb([A[1], A[2]], SKIN, 14);
    s += `<circle cx="${A[2][0]}" cy="${A[2][1]}" r="9" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>`;
    return s;
  });
  parts.armBack = arms[0];
  parts.armFront = arms[1];
  // busto
  const [nx, ny] = pose.neck, [hx, hy] = pose.hip;
  const w = pose.torsoW || 40;
  const dx = hx - nx, dy = hy - ny;
  const len = Math.hypot(dx, dy);
  const px = -dy / len, py = dx / len;
  const sw = w * 0.55, hw = w * 0.5;
  const p1 = [nx + px * sw, ny + py * sw], p2 = [nx - px * sw, ny - py * sw];
  const p3 = [hx - px * hw, hy - py * hw], p4 = [hx + px * hw, hy + py * hw];
  parts.torso = `<path d="M${p1} L${p2} L${p3} L${p4} Z" fill="${jersey}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`;
  if (kit === 'gabriel' && opts.sponsor !== false) {
    const cx = nx + dx * 0.38, cy = ny + dy * 0.38;
    const ang = Math.atan2(dy, dx) * 180 / Math.PI - 90;
    parts.torso += `<g transform="translate(${cx},${cy}) rotate(${ang})"><rect x="-19" y="-8" width="38" height="16" rx="3" fill="${WHITE}" stroke="${INK}" stroke-width="2"/><text x="0" y="4" text-anchor="middle" font-family="Bangers" font-size="9" fill="#143a7a">LAFERT</text></g>`;
  }
  if (kit === 'gabriel' && opts.mud) {
    parts.torso += `<g fill="${MUD}" opacity="0.8"><circle cx="${hx - 6}" cy="${hy - 4}" r="4"/><circle cx="${hx + 8}" cy="${hy - 9}" r="3"/></g>`;
  }
  // collo e testa
  const [cx, cy] = pose.head;
  parts.head = `<path d="M${nx},${ny} L${cx},${cy}" stroke="${INK}" stroke-width="16" stroke-linecap="round"/><path d="M${nx},${ny} L${cx},${cy}" stroke="${SKIN}" stroke-width="10" stroke-linecap="round"/>`;
  parts.head += `<g transform="translate(${cx},${cy}) rotate(${pose.headRot || 0})">${headSide(kit, pose.facing || -1, opts)}</g>`;
  return parts;
}

function ball(cx, cy, rot = 0, s = 1) {
  return `<g transform="translate(${cx},${cy}) rotate(${rot}) scale(${s})"><ellipse cx="0" cy="0" rx="20" ry="13" fill="${WHITE}" stroke="${INK}" stroke-width="3"/><path d="M-20,-4 q20,-6 40,0 M-20,4 q20,-6 40,0" stroke="${BLU}" stroke-width="3" fill="none"/><path d="M-6,-1 l12,0 M-3,-4 l0,6 M3,-4 l0,6" stroke="${INK}" stroke-width="1.5"/></g>`;
}

function badgeCheck(x, y, s = 1) {
  return `<g transform="translate(${x},${y}) scale(${s})"><circle r="15" fill="#2e9e4f" stroke="${INK}" stroke-width="3"/><path d="M-8,0 l6,6 l11,-12" stroke="${WHITE}" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}
function badgeCross(x, y, s = 1) {
  return `<g transform="translate(${x},${y}) scale(${s})"><circle r="15" fill="${RED}" stroke="${INK}" stroke-width="3"/><path d="M-7,-7 l14,14 M7,-7 l-14,14" stroke="${WHITE}" stroke-width="4.5" stroke-linecap="round"/></g>`;
}
function star(x, y, s = 1) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * 2 * i / 16;
    const r = i % 2 ? 12 : 26;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return `<g transform="translate(${x},${y}) scale(${s})"><polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="#f7c72e" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></g>`;
}
function grass(w, y, h = 22) {
  return `<rect x="0" y="${y}" width="${w}" height="${h}" fill="#5cbf5c"/><path d="M0,${y} L${w},${y}" stroke="${INK}" stroke-width="3"/>` +
    Array.from({ length: Math.floor(w / 26) }, (_, i) => `<path d="M${i * 26 + 10},${y + 2} l4,-9 M${i * 26 + 16},${y + 2} l3,-6" stroke="#2f8f3a" stroke-width="2.5" fill="none" stroke-linecap="round"/>`).join('');
}

module.exports = { INK, SKIN, HAIR, AZZ, WHITE, BLU, RED, BLACK, limb, kitDefs, gabrielHeadFront, gabrielBustWave, ovale, headSide, player, ball, badgeCheck, badgeCross, star, grass };
