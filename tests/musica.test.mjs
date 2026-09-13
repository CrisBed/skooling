import test from 'node:test';
import assert from 'node:assert/strict';
import { SEGNI_MUSICALI, GRUPPI_MUSICALI, ANTEPRIMA, segnoValido, ingombroSegno, disegnaSegnoMusicale, disegnaAnteprimaSegno, unitaAnteprima, appoggioAnteprima } from '../musica.js';
import { agganciaAlRigo, RIGO } from '../quaderni.js';
import { riquadroElemento, hitTestElement, spostaElemento } from '../strumenti.js';

// I segni sono i glifi veri del font di notazione che l'app si porta dietro.
// Questa finta tela registra le chiamate, cosi' si verifica che ogni segno
// scriva davvero il suo glifo (o disegni l'archetto, per la legatura).
function telaFinta() {
  const fatte = [];
  const nulla = () => {};
  return {
    fatte,
    save: nulla, restore: nulla, translate: nulla, rotate: nulla,
    beginPath: nulla, closePath: nulla, moveTo: nulla,
    lineTo: () => fatte.push('linea'),
    bezierCurveTo: () => fatte.push('curva'),
    ellipse: () => fatte.push('ovale'), arc: () => fatte.push('arco'),
    rect: nulla, fillRect: () => fatte.push('rettangolo'),
    stroke: () => fatte.push('tratto'), fill: () => fatte.push('pieno'),
    fillText: (t) => fatte.push('glifo:' + [...t].map((c) => c.codePointAt(0).toString(16).toUpperCase()).join()),
    set lineWidth(v) {}, set strokeStyle(v) {}, set fillStyle(v) {},
    set lineCap(v) {}, set lineJoin(v) {}, set font(v) { fatte.push('font:' + v); },
    set textAlign(v) {}, set textBaseline(v) {},
  };
}

test('ogni segno musicale scrive il glifo del font di notazione', () => {
  for (const segno of SEGNI_MUSICALI) {
    const tela = telaFinta();
    disegnaSegnoMusicale(tela, segno.chiave, 100, 100, 16, '#000');
    assert.ok(tela.fatte.length > 0, `il segno ${segno.chiave} non disegna niente`);
    if (segno.chiave === 'legatura') {
      assert.ok(tela.fatte.includes('curva'), 'la legatura e\' un archetto disegnato, nei font non c\'e\'');
      continue;
    }
    const glifo = tela.fatte.find((v) => v.startsWith('glifo:'));
    assert.ok(glifo, `il segno ${segno.chiave} non scrive nessun glifo`);
    // i glifi di notazione stanno nell'area a uso privato di Unicode
    const codice = parseInt(glifo.slice(6), 16);
    assert.ok(codice >= 0xE000 && codice <= 0xF8FF, `${segno.chiave} non usa un glifo di notazione (${glifo})`);
    assert.ok(tela.fatte.some((v) => v.startsWith('font:') && v.includes('SkoolingMusica')), `${segno.chiave} non usa il font di notazione`);
  }
});

test('un segno sconosciuto non viene accettato e non disegna niente', () => {
  assert.equal(segnoValido('semiminima'), true);
  assert.equal(segnoValido('legatura'), true);
  assert.equal(segnoValido('trombone'), false);
  const tela = telaFinta();
  disegnaSegnoMusicale(tela, 'trombone', 100, 100, 16, '#000');
  assert.equal(tela.fatte.length, 0);
});

test('i simboli si agganciano alla riga o allo spazio più vicini', () => {
  const altezza = 1000;
  const inQuota = (px) => agganciaAlRigo(px / altezza, altezza) * altezza;
  // la prima riga sta a 15px, poi ogni 16: righe e spazi ogni 8px
  assert.equal(Math.round(inQuota(RIGO.primaRiga + 0.4)), RIGO.primaRiga, 'quasi sulla prima riga');
  assert.equal(Math.round(inQuota(RIGO.primaRiga + 7.6)), RIGO.primaRiga + 8, 'quasi a metà fra due righe');
  assert.equal(Math.round(inQuota(RIGO.primaRiga + 17)), RIGO.primaRiga + 16, 'quasi sulla seconda riga');
});

test('fuori dal rigo il simbolo resta dove lo si è messo', () => {
  const altezza = 1000;
  // ben sotto la quinta riga, nello spazio vuoto fra un rigo e il successivo
  const libero = (RIGO.primaRiga + 110) / altezza;
  assert.equal(agganciaAlRigo(libero, altezza), libero);
  // senza sapere l'altezza del foglio non si aggancia niente
  assert.equal(agganciaAlRigo(0.5, 0), 0.5);
});

test('un simbolo si può riprendere toccandolo e si sposta come gli altri segni', () => {
  const nota = { id: 'n1', tipo: 'simbolo', segno: 'semiminima', x: 0.5, y: 0.4, unita: 0.02 };
  const bordi = riquadroElemento(nota);
  assert.ok(bordi.alto < nota.y && bordi.basso > nota.y, 'il riquadro contiene la nota');
  assert.ok(bordi.alto < bordi.basso - 0.05, 'il gambo allunga il riquadro verso l’alto');
  assert.equal(hitTestElement(nota, { x: 0.5, y: 0.4 }, 0.01), true, 'toccando la testa');
  assert.equal(hitTestElement(nota, { x: 0.9, y: 0.9 }, 0.01), false, 'lontano no');
  const spostata = spostaElemento({ ...nota }, nota, 0.1, 0.05);
  assert.equal(+spostata.x.toFixed(3), 0.6);
  assert.equal(+spostata.y.toFixed(3), 0.45);
  assert.equal(spostata.unita, nota.unita, 'la misura non cambia');
});

test('l’ingombro viene dalle misure vere del font', () => {
  // Misurati con fontTools sul font Bravura, non stimati a occhio.
  const nota = ingombroSegno('semiminima');
  assert.ok(nota.sopra > nota.sotto, 'la semiminima ha il gambo verso l’alto');
  assert.ok(Math.abs(nota.sopra - 3.5) < 0.01, 'il gambo e’ alto tre spazi e mezzo, come nel font');
  const semibreve = ingombroSegno('semibreve');
  assert.ok(semibreve.sopra < nota.sopra, 'la semibreve non ha gambo');
  const pausaSemibreve = ingombroSegno('pausa-semibreve');
  const pausaMinima = ingombroSegno('pausa-minima');
  assert.ok(pausaSemibreve.sotto > pausaSemibreve.sopra, 'la pausa di semibreve sta appesa sotto la riga');
  assert.ok(pausaMinima.sopra > pausaMinima.sotto, 'quella di minima sta appoggiata sopra');
  assert.deepEqual(ingombroSegno('sconosciuto'), { sinistra: 1, destra: 1, sopra: 1, sotto: 1 });
});

// ---- L'anteprima nel selettore -------------------------------------------
// Prima i riquadri restavano vuoti (il font non era ancora pronto quando si
// disegnavano) e i segni erano comunque minuscoli. Qui si verifica che ogni
// segno stia dentro il suo riquadro e ci stia grande.

function telaAnteprima() {
  const contesto = telaFinta();
  contesto.clearRect = () => {};
  contesto.setTransform = () => {};
  return {
    width: 0, height: 0,
    getContext: () => contesto,
    setTransform: undefined,
    contesto,
  };
}

test('ogni segno del selettore sta dentro il riquadro, righe del rigo comprese', () => {
  const { larghezza, altezza } = ANTEPRIMA;
  for (const segno of SEGNI_MUSICALI) {
    const ingombro = ingombroSegno(segno.chiave);
    const { unita, y } = appoggioAnteprima(segno.chiave, larghezza, altezza);
    const alto = y - Math.max(ingombro.sopra, 2) * unita;
    const basso = y + Math.max(ingombro.sotto, 2) * unita;
    assert.ok(alto >= -0.01, `${segno.chiave} esce dal bordo di sopra (${alto})`);
    assert.ok(basso <= altezza + 0.01, `${segno.chiave} esce dal bordo di sotto (${basso})`);
    const largo = (ingombro.sinistra + ingombro.destra) * unita;
    assert.ok(largo <= larghezza, `${segno.chiave} e' piu' largo del riquadro (${largo})`);
  }
});

test('nel selettore i segni si vedono grandi, non piu’ a diciotto pixel', () => {
  // Prima ogni segno era disegnato con unita' 9 su una tela mostrata a meta':
  // 4,5 pixel di passo del rigo, cioe' un segno alto meno di venti pixel.
  for (const segno of SEGNI_MUSICALI) {
    const unita = unitaAnteprima(segno.chiave);
    assert.ok(unita >= 6.5, `${segno.chiave} resta troppo piccolo (unita ${unita})`);
  }
});

test('l’anteprima disegna prima il rigo e poi il segno', () => {
  const tela = telaAnteprima();
  const esito = disegnaAnteprimaSegno(tela, 'pausa-semibreve');
  assert.ok(esito, 'l’anteprima deve dire dove ha appoggiato il segno');
  assert.equal(tela.width, ANTEPRIMA.larghezza * 2, 'la tela e’ al doppio per non sgranare');
  const tratti = tela.contesto.fatte.filter((voce) => voce === 'tratto').length;
  assert.equal(tratti, 5, 'le cinque righe del rigo che fanno da riferimento');
  assert.ok(tela.contesto.fatte.some((voce) => voce.startsWith('glifo:')), 'e poi il segno vero');
});

test('ogni segno del selettore ha un nome scritto sotto', () => {
  for (const segno of SEGNI_MUSICALI) {
    assert.ok(segno.breve && segno.breve.length <= 11, `${segno.chiave} non ha un nome corto da scrivere sotto`);
    assert.ok(GRUPPI_MUSICALI.some((gruppo) => gruppo.chiave === segno.gruppo), `${segno.chiave} non sta in nessun gruppo`);
  }
});
