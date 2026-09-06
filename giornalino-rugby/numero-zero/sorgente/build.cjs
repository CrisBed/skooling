const fs = require('fs');
const path = require('path');
const C = require('./chars.cjs');
const F = path.join(__dirname, 'fonts');
const b64 = f => fs.readFileSync(path.join(F, f)).toString('base64');
const fonts = `
@font-face{font-family:'Luckiest Guy';src:url(data:font/woff2;base64,${b64('_gP_1RrxsjcxVyin9l9n_j2hTd52.woff2')}) format('woff2');}
@font-face{font-family:'Bangers';src:url(data:font/woff2;base64,${b64('FeVQS0BTqb0h60ACH55Q2A.woff2')}) format('woff2');}
@font-face{font-family:'Patrick Hand';src:url(data:font/woff2;base64,${b64('LDI1apSQOAYtSuYWp8ZhfYe8XsLL.woff2')}) format('woff2');}
@font-face{font-family:'Comic Neue';font-weight:400;src:url(data:font/woff2;base64,${b64('4UaHrEJDsxBrF37olUeD96rp5w.woff2')}) format('woff2');}
@font-face{font-family:'Comic Neue';font-weight:700;src:url(data:font/woff2;base64,${b64('4UaErEJDsxBrF37olUeD_xHM8pxULg.woff2')}) format('woff2');}
`;

const INK = C.INK;

// ---------- Vignette del placcaggio (4 pose), area 440x210, terreno a y=182 ----------
function tacklePanel(n) {
  const id = 'p' + n;
  const W = 440, H = 210, G = 182;
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${C.kitDefs(id)}</defs>`;
  s += `<rect width="${W}" height="${H}" fill="#eaf6ff"/>`;
  // nuvole leggere
  s += `<g fill="#fff" opacity="0.9"><ellipse cx="70" cy="34" rx="34" ry="14"/><ellipse cx="90" cy="26" rx="22" ry="12"/><ellipse cx="380" cy="40" rx="30" ry="12"/></g>`;
  s += C.grass(W, G, H - G);

  // avversario in piedi, guarda a sinistra, con il pallone
  const oppStand = (tilt) => C.player('opp', {
    facing: -1, head: [232, 52], neck: [236, 78], hip: [240, 132], torsoW: 44,
    legs: [[[240, 132], [262, 156], [270, 180]], [[240, 132], [222, 156], [212, 180]]],
    arms: [[[236, 88], [214, 110], [208, 122]], [[236, 88], [212, 104], [226, 124]]],
  }, id, { mouth: 'oh' });

  if (n === 1) {
    // Gabriel arriva basso da destra: la testa va dietro la schiena (dietro il busto dell'avversario)
    const gab = C.player('gabriel', {
      facing: -1, head: [262, 118], neck: [292, 126], hip: [344, 134], torsoW: 40, headRot: -20,
      legs: [[[344, 134], [372, 116], [406, 152]], [[344, 134], [366, 160], [412, 180]]],
      arms: [[[292, 132], [262, 152], [240, 160]], [[292, 134], [270, 156], [252, 168]]],
    }, id, { mouth: 'grit', mud: true });
    const opp = oppStand(0);
    s += gab.legBack + gab.armBack + gab.torso + gab.head + gab.legFront;
    s += opp.legBack + opp.armBack + opp.torso + opp.legFront + opp.head + opp.armFront;
    s += C.ball(220, 118, -20, 0.9);
    s += gab.armFront;
    // testa dietro: spunta verde; davanti: croce rossa
    s += C.badgeCheck(300, 100, 0.9);
    s += `<path d="M300,114 q-8,10 -18,10" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    s += `<g opacity="0.55"><circle cx="186" cy="124" r="18" fill="none" stroke="${C.RED}" stroke-width="3" stroke-dasharray="6 5"/></g>`;
    s += C.badgeCross(162, 108, 0.9);
    // frecce di corsa
    s += `<g stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M395,110 l14,0"/><path d="M402,124 l16,0"/></g>`;
  }
  if (n === 2) {
    // contatto: la spalla sul fianco, all'altezza della coscia
    const gab = C.player('gabriel', {
      facing: -1, head: [258, 122], neck: [282, 138], hip: [338, 146], torsoW: 40, headRot: -25,
      legs: [[[338, 146], [372, 130], [408, 156]], [[338, 146], [376, 164], [418, 180]]],
      arms: [[[284, 142], [256, 158], [236, 166]], [[284, 144], [262, 162], [246, 172]]],
    }, id, { mouth: 'grit', mud: true });
    const opp = oppStand(0);
    s += gab.legBack + gab.armBack + gab.torso + gab.head + gab.legFront;
    s += opp.legBack + opp.armBack + opp.torso + opp.legFront + opp.head + opp.armFront;
    s += C.ball(220, 118, -20, 0.9);
    s += gab.armFront;
    s += C.star(272, 142, 0.8);
    s += C.badgeCheck(310, 108, 0.9);
    s += `<path d="M300,118 q-10,14 -22,20" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  }
  if (n === 3) {
    // le braccia chiudono e stringono le gambe
    const gab = C.player('gabriel', {
      facing: -1, head: [256, 126], neck: [280, 142], hip: [336, 150], torsoW: 40, headRot: -25,
      legs: [[[336, 150], [370, 134], [406, 160]], [[336, 150], [374, 168], [418, 180]]],
      arms: [[[282, 146], [250, 150], [222, 150]], [[282, 148], [252, 162], [224, 160]]],
    }, id, { mouth: 'grit', mud: true });
    // avversario che si inclina (perde l'equilibrio)
    const oppParts = C.player('opp', {
      facing: -1, head: [216, 50], neck: [224, 76], hip: [240, 132], torsoW: 44,
      legs: [[[240, 132], [262, 156], [270, 180]], [[240, 132], [226, 156], [214, 180]]],
      arms: [[[224, 86], [196, 96], [180, 84]], [[224, 86], [200, 106], [190, 96]]],
    }, id, { mouth: 'oh' });
    s += gab.legBack + gab.armBack + gab.torso + gab.head + gab.legFront;
    s += oppParts.legBack + oppParts.armBack + oppParts.torso + oppParts.legFront + oppParts.head + oppParts.armFront;
    s += C.ball(176, 78, -30, 0.9);
    // anello delle braccia che stringono le gambe
    s += `<ellipse cx="246" cy="154" rx="30" ry="12" fill="none" stroke="${INK}" stroke-width="18" stroke-linecap="round"/><ellipse cx="246" cy="154" rx="30" ry="12" fill="none" stroke="${C.SKIN}" stroke-width="12"/>`;
    s += `<circle cx="222" cy="150" r="9" fill="${C.SKIN}" stroke="${INK}" stroke-width="3"/><circle cx="224" cy="160" r="9" fill="${C.SKIN}" stroke="${INK}" stroke-width="3"/>`;
    s += C.badgeCheck(210, 128, 0.9);
    s += `<g stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M196,40 l-12,-6"/><path d="M188,60 l-14,-2"/></g>`;
  }
  if (n === 4) {
    // a terra insieme, si accompagna la caduta e ci si rialza subito
    const oppDown = C.player('opp', {
      facing: -1, head: [100, 160], neck: [126, 158], hip: [186, 160], torsoW: 40, headRot: 90,
      legs: [[[186, 160], [222, 150], [258, 164]], [[186, 160], [220, 166], [256, 176]]],
      arms: [[[128, 162], [110, 176], [90, 178]], [[128, 154], [120, 138], [100, 132]]],
    }, id, { mouth: 'oh' });
    // Gabriel si rialza: una mano a terra, l'altra avanti, gambe piegate
    const gab = C.player('gabriel', {
      facing: -1, head: [292, 92], neck: [310, 112], hip: [348, 150], torsoW: 40, headRot: 10,
      legs: [[[348, 150], [386, 144], [396, 180]], [[348, 150], [330, 168], [308, 180]]],
      arms: [[[312, 120], [292, 150], [280, 176]], [[312, 118], [282, 112], [258, 96]]],
    }, id, { mouth: 'smile', mud: true });
    s += oppDown.legBack + oppDown.armBack + oppDown.torso + oppDown.legFront + oppDown.head + oppDown.armFront;
    s += C.ball(74, 150, 20, 0.9);
    s += gab.legBack + gab.armBack + gab.torso + gab.legFront + gab.head + gab.armFront;
    // freccia in su
    s += `<g transform="translate(400,60)"><path d="M0,44 L0,4" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M0,44 L0,4" stroke="#2e9e4f" stroke-width="5" stroke-linecap="round"/><path d="M-14,16 L0,0 L14,16 Z" fill="#2e9e4f" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></g>`;
    s += `<g stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M372,76 l-6,-10"/><path d="M420,80 l6,-10"/></g>`;
    s += C.badgeCheck(262, 62, 0.9);
  }
  s += `</svg>`;
  return s;
}

// ---------- Disegno della regola: mani solo indietro o di lato, piedi anche avanti ----------
function ruleDrawing() {
  const W = 180, H = 150;
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  s += `<rect width="${W}" height="${H}" rx="10" fill="#eaf6ff" stroke="${INK}" stroke-width="2.5"/>`;
  s += `<g stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"><path d="M70,34 L70,8 M110,34 L110,8 M70,20 L110,20"/></g>`;
  s += `<path d="M14,36 L166,36" stroke="${INK}" stroke-width="2" stroke-dasharray="6 4"/>`;
  s += C.ball(90, 82, 0, 1.1);
  // freccia in avanti con le mani: rossa e sbarrata
  s += `<path d="M90,62 L90,44" stroke="${C.RED}" stroke-width="5" stroke-linecap="round"/><path d="M80,50 L90,38 L100,50 Z" fill="${C.RED}" stroke="${INK}" stroke-width="2"/>`;
  s += C.badgeCross(116, 46, 0.7);
  // frecce indietro e di lato: verdi
  const arrow = (x1, y1, x2, y2) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const hx = x2 - Math.cos(a) * 10, hy = y2 - Math.sin(a) * 10;
    const px = -Math.sin(a) * 8, py = Math.cos(a) * 8;
    return `<path d="M${x1},${y1} L${hx},${hy}" stroke="#2e9e4f" stroke-width="5" stroke-linecap="round"/><path d="M${hx + px},${hy + py} L${x2},${y2} L${hx - px},${hy - py} Z" fill="#2e9e4f" stroke="${INK}" stroke-width="2"/>`;
  };
  s += arrow(66, 82, 34, 82) + arrow(114, 82, 146, 82) + arrow(90, 100, 90, 128);
  s += C.badgeCheck(24, 100, 0.7) + C.badgeCheck(156, 100, 0.7);
  s += `</svg>`;
  return s;
}

// ---------- Stretta di mano ----------
function handshake() {
  const W = 470, H = 130, G = 112;
  const id = 'hs';
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${C.kitDefs(id)}</defs>`;
  s += `<rect width="${W}" height="${H}" fill="#eaf6ff"/>`;
  s += `<g fill="#fff" opacity="0.9"><ellipse cx="80" cy="30" rx="34" ry="13"/><ellipse cx="400" cy="34" rx="30" ry="12"/></g>`;
  // pali della meta sullo sfondo
  s += `<g stroke="#ffffff" stroke-width="6" fill="none"><path d="M392,112 L392,30 M426,112 L426,30 M392,66 L426,66"/></g><g stroke="${INK}" stroke-width="2" fill="none"><path d="M392,112 L392,30 M426,112 L426,30 M392,66 L426,66"/></g>`;
  s += C.grass(W, G, H - G);
  s += `<g transform="translate(235,${G}) scale(0.75) translate(-226,-174)">`;
  // Gabriel a sinistra guarda a destra, avversario a destra guarda a sinistra, mani che si stringono al centro
  const gab = C.player('gabriel', {
    facing: 1, head: [160, 52], neck: [166, 78], hip: [166, 130], torsoW: 44,
    legs: [[[166, 130], [150, 154], [142, 174]], [[166, 130], [182, 154], [190, 174]]],
    arms: [[[166, 88], [150, 116], [156, 132]], [[166, 88], [200, 104], [226, 110]]],
  }, id, { mouth: 'smile', mud: true });
  const opp = C.player('opp', {
    facing: -1, head: [290, 52], neck: [284, 78], hip: [284, 130], torsoW: 44,
    legs: [[[284, 130], [300, 154], [308, 174]], [[284, 130], [268, 154], [260, 174]]],
    arms: [[[284, 88], [300, 116], [294, 132]], [[284, 88], [250, 104], [226, 110]]],
  }, id, { mouth: 'smile' });
  s += gab.legBack + gab.armBack + gab.torso + gab.legFront + gab.head;
  s += opp.legBack + opp.armBack + opp.torso + opp.legFront + opp.head;
  s += gab.armFront + opp.armFront;
  // mani unite
  s += `<g transform="translate(226,110)"><ellipse cx="0" cy="0" rx="16" ry="11" fill="${C.SKIN}" stroke="${INK}" stroke-width="3"/><path d="M-10,-2 q10,4 20,0" stroke="${INK}" stroke-width="2" fill="none"/></g>`;
  // cuoricino no: piccole linee di simpatia
  s += `<g stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M214,84 l-4,-8"/><path d="M238,84 l4,-8"/><path d="M226,80 l0,-9"/></g>`;
  s += `</g></svg>`;
  return s;
}

// ---------- Pagina ----------
const svgOvaleTop = `<svg width="200" height="220" viewBox="0 0 200 220"><g transform="translate(100,100)">${C.ovale({ wink: true, scale: 0.95 })}</g></svg>`;
const svgOvaleBottom = `<svg width="150" height="170" viewBox="0 0 150 170"><g transform="translate(75,80)">${C.ovale({ wink: false, scale: 0.68, tilt: -10 })}</g></svg>`;
const svgGabriel = `<svg width="290" height="300" viewBox="0 0 290 300"><defs>${C.kitDefs('bust')}</defs><g transform="translate(120,125)">${C.gabrielBustWave('bust')}</g></svg>`;

const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>Il giornalino del rugby, numero zero</title>
<style>
${fonts}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1024px;height:1536px;overflow:hidden;background:#f6efdc}
body{position:relative;font-family:'Patrick Hand','Comic Neue',sans-serif;color:${INK}}
.paper{position:absolute;inset:0;background:
  radial-gradient(circle at 20% 10%, rgba(255,255,255,.55), transparent 40%),
  radial-gradient(circle at 80% 90%, rgba(214,190,140,.25), transparent 45%),
  #f6efdc}
.abs{position:absolute}
.box{position:absolute;background:#fff;border:4px solid ${INK};border-radius:14px;box-shadow:5px 5px 0 rgba(0,0,0,.28)}
.head{position:absolute;left:-4px;right:-4px;top:-4px;background:#d7262c;border:4px solid ${INK};border-radius:14px 14px 0 0;color:#fff;font-family:'Luckiest Guy';text-align:center;letter-spacing:.5px;text-shadow:2px 2px 0 #5a0a0a}
.title{font-family:'Luckiest Guy';color:#d7262c;-webkit-text-stroke:2.5px #4a0808;paint-order:stroke fill;text-shadow:4px 4px 0 #4a0808;line-height:.95;letter-spacing:1px}
.bubble{position:absolute;background:#fff;border:3.5px solid ${INK};border-radius:22px;padding:14px 18px;font-size:27px;line-height:1.18;font-family:'Comic Neue';font-weight:700;text-align:center}
.bubble .tail{position:absolute;width:0;height:0}
.num{position:absolute;width:44px;height:44px;border-radius:50%;background:#d7262c;border:3.5px solid ${INK};color:#fff;font-family:'Luckiest Guy';font-size:28px;text-align:center;line-height:42px;text-shadow:1.5px 1.5px 0 #4a0808}
.cap{font-family:'Comic Neue';font-weight:700;font-size:21.5px;line-height:1.15}
.panel{position:absolute;width:440px;height:210px;border:3.5px solid ${INK};border-radius:10px;overflow:hidden;background:#eaf6ff}
.yellow{background:#f7c72e;border:4px solid ${INK};border-radius:12px;font-family:'Bangers';letter-spacing:1px;box-shadow:4px 4px 0 rgba(0,0,0,.25)}
.grey{color:#a8a39a}
</style></head><body>
<div class="paper"></div>

<!-- 1. TESTATA -->
<div class="abs" style="left:26px;top:26px;width:172px;height:126px;border:3px dashed #8a8579;border-radius:10px;background:rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;text-align:center;color:#8a8579;font-family:'Comic Neue';font-size:19px;line-height:1.2;padding:8px">spazio<br>logo società</div>
<svg class="abs" style="left:200px;top:22px" width="640" height="150" viewBox="0 0 640 150"><path d="M18,52 q90,-26 300,-18 q220,4 300,22 l-14,54 q-110,-14 -300,-8 q-200,6 -300,-6 z" fill="#f7c72e" opacity=".95"/></svg>
<div class="abs title" style="left:206px;top:34px;width:626px;text-align:center;font-size:66px">IL GIORNALINO<br>DEL RUGBY</div>
<div class="abs" style="left:206px;top:156px;width:626px;text-align:center;font-family:'Bangers';font-size:28px;letter-spacing:1px;color:#143a7a">Numero zero - esempio dimostrativo</div>
<div class="abs" style="left:826px;top:6px">${svgOvaleTop}</div>

<!-- 2. BENVENUTO -->
<div class="abs" style="left:14px;top:158px;transform:scale(.82);transform-origin:top left">${svgGabriel}</div>
<div class="bubble" style="left:330px;top:232px;width:600px">Una pagina al mese: il gesto, le date, una regola e una curiosità. Poi si va in campo!
  <svg class="abs" style="right:70px;top:-30px" width="60" height="32" viewBox="0 0 60 32"><path d="M8,32 L36,2 L52,32 Z" fill="#fff" stroke="${INK}" stroke-width="3.5"/><path d="M12,32 L50,32" stroke="#fff" stroke-width="6"/></svg>
</div>

<!-- 3. IL GESTO DEL MESE -->
<div class="box" style="left:26px;top:392px;width:972px;height:632px">
  <div class="head" style="height:62px;font-size:40px;line-height:58px">IL GESTO DEL MESE: IL PLACCAGGIO SICURO</div>
  <div class="panel" style="left:22px;top:78px">${tacklePanel(1)}</div>
  <div class="num" style="left:12px;top:68px">1</div>
  <div class="panel" style="left:500px;top:78px">${tacklePanel(2)}</div>
  <div class="num" style="left:490px;top:68px">2</div>
  <div class="cap abs" style="left:22px;top:296px;width:440px">La testa va dietro la schiena dell'avversario, mai davanti.</div>
  <div class="cap abs" style="left:500px;top:296px;width:440px">La spalla si appoggia sul fianco, all'altezza della coscia.</div>
  <div class="panel" style="left:22px;top:356px">${tacklePanel(3)}</div>
  <div class="num" style="left:12px;top:346px">3</div>
  <div class="panel" style="left:500px;top:356px">${tacklePanel(4)}</div>
  <div class="num" style="left:490px;top:346px">4</div>
  <div class="cap abs" style="left:22px;top:574px;width:440px">Le braccia chiudono e stringono le gambe.</div>
  <div class="cap abs" style="left:500px;top:574px;width:440px">Si va a terra insieme, si accompagna la caduta e ci si rialza subito.</div>
</div>
<div class="abs yellow" style="left:60px;top:1036px;width:904px;height:50px;font-size:27px;line-height:42px;text-align:center;transform:rotate(-0.6deg)">
  <span style="display:inline-block;width:30px;height:30px;border-radius:50%;background:#d7262c;border:3px solid ${INK};color:#fff;font-family:'Luckiest Guy';font-size:22px;line-height:26px;vertical-align:-6px;margin-right:10px">!</span>Sempre sotto la linea delle spalle. Sopra è pericoloso ed è fallo.
</div>

<!-- 4. DUE RIQUADRI -->
<div class="box" style="left:26px;top:1102px;width:520px;height:188px">
  <div class="head" style="height:50px;font-size:30px;line-height:46px">GLI APPUNTAMENTI DI OTTOBRE</div>
  <div class="abs" style="left:18px;top:60px;width:480px;font-size:26px;line-height:1.38" class="grey">
    <div class="grey">&#9679;&nbsp; Martedì e giovedì, allenamento</div>
    <div class="grey">&#9679;&nbsp; Domenica 12, prima partita in casa</div>
    <div class="grey">&#9679;&nbsp; Sabato 25, riunione genitori</div>
  </div>
  <div class="abs grey" style="right:14px;bottom:6px;font-family:'Comic Neue';font-style:italic;font-size:17px">esempio, da compilare</div>
</div>
<div class="box" style="left:568px;top:1102px;width:430px;height:188px">
  <div class="head" style="height:50px;font-size:30px;line-height:46px">LA REGOLA</div>
  <div class="abs" style="left:12px;top:58px;transform:scale(.78);transform-origin:top left">${ruleDrawing()}</div>
  <div class="abs cap" style="left:158px;top:58px;width:262px;font-size:20px;line-height:1.15">La palla con le mani va solo indietro o di lato, mai in avanti. Con i piedi invece puoi calciarla avanti quanto vuoi. Il rugby è così.</div>
</div>

<!-- 5. IL VALORE DEL MESE -->
<div class="box" style="left:26px;top:1306px;width:972px;height:186px">
  <div class="head" style="height:50px;font-size:30px;line-height:46px">IL VALORE DEL MESE: RISPETTO</div>
  <div class="abs" style="left:16px;top:54px;width:476px;height:120px;border:3px solid ${INK};border-radius:10px;overflow:hidden"><div style="margin-top:-8px">${handshake()}</div></div>
  <div class="bubble" style="left:504px;top:66px;width:330px;font-size:25px;padding:12px 14px">Si placca forte, poi si dà la mano. Sempre.
    <svg class="abs" style="right:-30px;top:26px" width="34" height="40" viewBox="0 0 34 40"><path d="M2,4 L32,20 L2,36 Z" fill="#fff" stroke="${INK}" stroke-width="3.5"/><path d="M2,8 L2,32" stroke="#fff" stroke-width="6"/></svg>
  </div>
  <div class="abs" style="left:842px;top:20px">${svgOvaleBottom}</div>
</div>

<!-- 6. PIE' DI PAGINA -->
<div class="abs" style="left:0;top:1500px;width:1024px;height:36px;background:#143a7a;color:#fff;font-family:'Bangers';font-size:21px;letter-spacing:1.5px;line-height:36px;text-align:center">Giornalino della società - numero zero</div>
</body></html>`;
fs.writeFileSync(path.join(__dirname, '..', 'GIORNALINO-RUGBY-numero-zero.html'), html);
console.log('page.html', html.length);
