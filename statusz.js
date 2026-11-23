/*
  Páciens státusz szabályai (spec: Páciens státusz átkapcsolása)
  várakozó -> előgondozott -> ellátott -> távozott  (+ újrafelvétel: távozott -> várakozó)
*/

'use strict';

const STATUSZOK = ['várakozó', 'előgondozott', 'ellátott', 'távozott'];

const DATUM_MEZO = { 'várakozó':'VARAKOZO_DATUM', 'előgondozott':'ELOGOND_DATUM',
                     'ellátott':'ELLATOTT_DATUM', 'távozott':'TAVOZOTT_DATUM' };

function kovetkezoStatusz(s) {
    const i = STATUSZOK.indexOf(s);
    return (i >= 0 && i < STATUSZOK.length - 1) ? STATUSZOK[i + 1] : null;
}

function elozoStatusz(s) {
    const i = STATUSZOK.indexOf(s);
    return i > 0 ? STATUSZOK[i - 1] : null;
}

function maiNap() {
    return new Date().toLocaleDateString('sv-SE');             // 'ÉÉÉÉ-HH-NN' helyi idő szerint
}

/* felajánlott / beírt dátum ellenőrzése: valós dátum, nem jövőbeli, nem korábbi az előző lépcső dátumánál */
function datumEllenorzes(datum, minDatum) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum || "") || isNaN(new Date(datum))) { return "Hibás dátum!"; }
    if (new Date(datum).toISOString().substring(0, 10) !== datum)            { return "Hibás dátum!"; }   // pl. 02-30
    if (datum > maiNap())                                                    { return "A dátum nem lehet jövőbeli!"; }
    if (minDatum && datum < minDatum) { return `A dátum nem lehet korábbi az előző lépés dátumánál (${minDatum})!`; }
    return null;
}

module.exports = { STATUSZOK, DATUM_MEZO, kovetkezoStatusz, elozoStatusz, maiNap, datumEllenorzes };
