/*
  config tábla (FIELD, VALUE, DESCRIPTOR) beolvasása. Induláskor és minden módosítás után újraolvassuk,
  a díjszámítás mindig a cfg objektumból dolgozik:  cfg.NAPIDIJ_SZAZALEK --> '60'
*/

'use strict';

const cfg = {};

/* számot váró mezők (a többi szöveg, pl. CSV_ELVALASZTO) */
const SZAM_MEZOK = ['NAPIDIJ_SZAZALEK', 'JELEN_SZORZO', 'KUSZOB_NAP', 'KORHAZ_SZORZO_ALATT', 'KORHAZ_SZORZO_FELETT',
                    'HELYFOGLAL_SZORZO_ALATT', 'HELYFOGLAL_SZORZO_FELETT', 'KEREKITES_EGYSEG', 'RENDSZER_OPERATOR_ID'];

async function configBetolt(DM) {
    const json = await DM.runQuery("select FIELD, VALUE from config");
    if (json.message !== "ok") {
        console.error('A config tábla nem olvasható:', json.message);
        return cfg;
    }
    for (const sor of json.rows) { cfg[sor.FIELD] = sor.VALUE; }
    return cfg;
}

/* új érték ellenőrzése mentés előtt. return: hibaüzenet, vagy null */
function configEllenorzes(field, value) {
    if (value === undefined || String(value).trim() === "") { return "Az érték nem lehet üres!"; }
    if (String(value).length > 100)                          { return "Az érték legfeljebb 100 karakter lehet!"; }
    if (SZAM_MEZOK.includes(field)) {
        if (!/^\d+$/.test(String(value)))                     { return `A(z) ${field} értéke csak pozitív egész szám lehet!`; }
        if (field === 'KEREKITES_EGYSEG' && Number(value) < 1) { return "A kerekítés egysége legalább 1 Ft!"; }
    }
    return null;
}

module.exports = { cfg, configBetolt, configEllenorzes };
