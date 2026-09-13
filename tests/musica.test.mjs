import test from 'node:test';
import assert from 'node:assert/strict';
import { SEGNI_MUSICALI, segnoValido, ingombroSegno, disegnaSegnoMusicale } from '../musica.js';
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
