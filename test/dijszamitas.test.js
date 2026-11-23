// díjszámítás tesztek a specifikáció számpéldái alapján. Futtatás: npm test
const test   = require('node:test');
const assert = require('node:assert');
const D      = require('../dijszamitas.js');

const cfg = { NAPIDIJ_SZAZALEK:'60', JELEN_SZORZO:'100', KUSZOB_NAP:'40',
              KORHAZ_SZORZO_ALATT:'20', KORHAZ_SZORZO_FELETT:'40',
              HELYFOGLAL_SZORZO_ALATT:'20', HELYFOGLAL_SZORZO_FELETT:'60', KEREKITES_EGYSEG:'1' };

test('év napjai, szökőév', () => {
    assert.strictEqual(D.evNapjai(2026), 365);
    assert.strictEqual(D.evNapjai(2028), 366);
    assert.strictEqual(D.evNapjai(1900), 365);
    assert.strictEqual(D.evNapjai(2000), 366);
});

test('hónap napjai', () => {
    assert.strictEqual(D.honapNapjai(2026, 2), 28);
    assert.strictEqual(D.honapNapjai(2028, 2), 29);
    assert.strictEqual(D.honapNapjai(2026, 4), 30);
    assert.strictEqual(D.honapNapjai(2026, 12), 31);
});

test('alap napidíj: 200 000 Ft, 2026 -> 3 945 Ft (spec 1. lépés)', () => {
    assert.strictEqual(D.alapNapidij(200000, 2026, cfg), 3945);
});

test('alap napidíj szökőévben: 200 000 Ft, 2028 -> 3 934 Ft', () => {
    assert.strictEqual(D.alapNapidij(200000, 2028, cfg), 3934);
});

test('kerekítés 5 Ft-ra, ha a config így kéri', () => {
    assert.strictEqual(D.kerekit(3947, 5), 3945);
    assert.strictEqual(D.kerekit(3948, 5), 3950);
});

test('40 napos küszöb: előtte 38 K nap, most 5 K nap -> 789 + 4 × 1 578 = 7 101 Ft', () => {
    const napok = 'KKKKK' + 'N'.repeat(23) + '---';
    const e = D.haviDij(napok, 3945, 38, 0, cfg);
    assert.strictEqual(e.fizetendo, 7101);
    assert.strictEqual(e.korhaz, 5);
});

test('teljes havi példa: 24 I, 5 K (előtte 36), 1 N -> 100 203 Ft (spec 3. lépés)', () => {
    const napok = 'I'.repeat(24) + 'KKKKK' + 'N' + '-';
    const e = D.haviDij(napok, 3945, 36, 0, cfg);
    assert.strictEqual(e.fizetendo, 100203);
    assert.deepStrictEqual([e.jelen, e.korhaz, e.helyfoglal], [24, 5, 0]);
});

test('helyfoglalás a küszöb felett 60%', () => {
    const e = D.haviDij('HH' + 'N'.repeat(29), 3945, 0, 38, cfg);
    assert.strictEqual(e.fizetendo, 789 + 2367);            // 39. H nap 20%, 40. H nap 60% = 2 367 Ft
});

test('január: a számláló nulláról indul, 0 korábbi nappal mind 20%', () => {
    const e = D.haviDij('K'.repeat(31), 3945, 0, 0, cfg);
    assert.strictEqual(e.fizetendo, 31 * 789);
});

test('rögzítetlen (0) nappal nem számol', () => {
    const e = D.haviDij('I'.repeat(30) + '0', 3945, 0, 0, cfg);
    assert.ok(e.hiba);
});

test('számítás paraméterek oda-vissza', () => {
    const vissza = D.parameterekBeolvas(D.szamitasParameterek(cfg));
    assert.deepStrictEqual(vissza, cfg);
});
