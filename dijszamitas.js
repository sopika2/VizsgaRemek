/*
  Napidíj / havi díj számítás (spec: Napidíj, Díjszámítás bővebben). Adatbázis nélkül tesztelhető: npm test
  cfg: a config tábla { FIELD: VALUE } alakban (configBetolt())
*/

'use strict';

function evNapjai(ev) {                                        // szökőév: 4-gyel osztható, de 100-zal nem, vagy 400-zal igen
    return ((ev % 4 === 0 && ev % 100 !== 0) || ev % 400 === 0) ? 366 : 365;
}

function honapNapjai(ev, ho) {
    return new Date(ev, ho, 0).getDate();                      // a következő hónap 0. napja = ennek a hónapnak az utolsó napja
}

function kerekit(ertek, egyseg = 1) {
    return Math.round(ertek / egyseg) * egyseg;
}

/* alap_napidij = KEREKÍT( (nyugdíj_havi × 12 × napidíj_százalék) / akt_év_napjainak_száma ), egy lépésben */
function alapNapidij(nyugdijHavi, ev, cfg) {
    return kerekit(nyugdijHavi * 12 * Number(cfg.NAPIDIJ_SZAZALEK) / 100 / evNapjai(ev), Number(cfg.KEREKITES_EGYSEG));
}

/* az adott nap szorzója %-ban. evesSorszam: hányadik K (vagy H) nap az évben (1-től) */
function napiSzorzo(kod, evesSorszam, cfg) {
    const kuszob = Number(cfg.KUSZOB_NAP);
    switch (kod) {
        case 'I': return Number(cfg.JELEN_SZORZO);
        case 'K': return evesSorszam < kuszob ? Number(cfg.KORHAZ_SZORZO_ALATT)    : Number(cfg.KORHAZ_SZORZO_FELETT);
        case 'H': return evesSorszam < kuszob ? Number(cfg.HELYFOGLAL_SZORZO_ALATT) : Number(cfg.HELYFOGLAL_SZORZO_FELETT);
        default:  return 0;                                    // N és '-' nem díjköteles
    }
}

/* egy hónap fizetendője. korhazEddig / helyfoglalEddig: az év korábbi hónapjaiban összesen hány K / H nap volt
   minden nap díja külön kerekítve, a fizetendő ezek összege. A 40 napos küszöb nem visszamenőleges. */
function haviDij(napok, alap, korhazEddig, helyfoglalEddig, cfg) {
    if (napok.includes('0')) {
        return { "hiba":"A hónapban van még rögzítetlen (0) nap!" };
    }
    let fizetendo = 0, jelen = 0, korhaz = 0, helyfoglal = 0;
    for (const kod of napok) {
        let sorszam = 0;
        if (kod === 'I') { jelen++; }
        if (kod === 'K') { korhaz++;     sorszam = korhazEddig + korhaz; }
        if (kod === 'H') { helyfoglal++; sorszam = helyfoglalEddig + helyfoglal; }
        fizetendo += kerekit(alap * napiSzorzo(kod, sorszam, cfg) / 100, Number(cfg.KEREKITES_EGYSEG));
    }
    return { "fizetendo":fizetendo, "jelen":jelen, "korhaz":korhaz, "helyfoglal":helyfoglal };
}

/* a záráskor érvényes paraméterek szövegként (ellatas.SZAMITAS_PARAMETEREK) és vissza */
function szamitasParameterek(cfg) {
    return `szazalek=${cfg.NAPIDIJ_SZAZALEK};jelen=${cfg.JELEN_SZORZO};kuszob=${cfg.KUSZOB_NAP};` +
           `korhaz_alatt=${cfg.KORHAZ_SZORZO_ALATT};korhaz_felett=${cfg.KORHAZ_SZORZO_FELETT};` +
           `helyfoglal_alatt=${cfg.HELYFOGLAL_SZORZO_ALATT};helyfoglal_felett=${cfg.HELYFOGLAL_SZORZO_FELETT};` +
           `kerekites=${cfg.KEREKITES_EGYSEG}`;
}

function parameterekBeolvas(szoveg) {
    const nevek = { szazalek:'NAPIDIJ_SZAZALEK', jelen:'JELEN_SZORZO', kuszob:'KUSZOB_NAP',
                    korhaz_alatt:'KORHAZ_SZORZO_ALATT', korhaz_felett:'KORHAZ_SZORZO_FELETT',
                    helyfoglal_alatt:'HELYFOGLAL_SZORZO_ALATT', helyfoglal_felett:'HELYFOGLAL_SZORZO_FELETT',
                    kerekites:'KEREKITES_EGYSEG' };
    const cfg = {};
    for (const resz of szoveg.split(';')) {
        const [kulcs, ertek] = resz.split('=');
        if (nevek[kulcs]) { cfg[nevek[kulcs]] = ertek; }
    }
    return cfg;
}

module.exports = { evNapjai, honapNapjai, kerekit, alapNapidij, napiSzorzo, haviDij, szamitasParameterek, parameterekBeolvas };
