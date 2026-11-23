const express     = require('express');
const session     = require('express-session');
const DataModule  = require('./datamodule_mysql2.js');
const { cfg, configBetolt, configEllenorzes } = require('./config.js');
const D           = require('./dijszamitas.js');
const S           = require('./statusz.js');

let beallitas;                                           // gépenként más (jelszó, port) --> beallitasok.json nincs a github-on
try {
    beallitas = require('./beallitasok.json');
} catch (err) {
    beallitas = require('./beallitasok.minta.json');
    console.log('Nincs beallitasok.json, a minta beállításokkal indul. (beallitasok.minta.json --> beallitasok.json)');
}

const app  = express();
const port = beallitas.port || 3000;
const DM   = new DataModule(beallitas.mysql);

app.use(express.static(__dirname + '/public'));          // public/index.html a def. (__dirname: bármelyik mappából indítva működik)
app.use(express.json());                                 // a frontend JSON-t küld (ajax_post)
app.use(session({ name:'user_sid', secret:beallitas.session_secret, resave:false, saveUninitialized:false }));

/* ---------- jogosultság vizsgálat (route-ok elé) ---------- */
function csakBelepve(req, res, next) {                   // listák, kimutatások
    if (req.session.user) { return next(); }
    res.status(401).json({ "message":"Nincs bejelentkezve!" });
}

function csakAdmin(req, res, next) {                     // jelenlét, zárás, befizetés, státuszváltás: ADMIN vagy ADMIN_B
    const u = req.session.user;
    if (u && (u.ADMIN === 'Y' || u.ADMIN_B === 'Y')) { return next(); }
    res.status(403).json({ "message":"Ehhez a művelethez nincs jogosultsága!" });
}

function csakFoadmin(req, res, next) {                   // config módosítás: csak ADMIN
    if (req.session.user && req.session.user.ADMIN === 'Y') { return next(); }
    res.status(403).json({ "message":"Ehhez a művelethez ADMIN jogosultság kell!" });
}

/* ---------- login / logout ---------- */
app.post('/login', async (req, res) => {
    const login  = req.body.login  || "";
    const jelszo = req.body.jelszo || "";
    const sql = "select ID_OPERATOR, LOGIN, NEV, EMAIL, ADMIN, ADMIN_A, ADMIN_B from operator where LOGIN = ? and PASSWORD = md5(?) limit 1";
    const json = await DM.runQuery(sql, [login, jelszo]);

    if (json.message !== "ok")   { return res.status(500).json({ "message":json.message }); }
    if (json.maxcount !== 1)     { return res.status(401).json({ "message":"Hibás felhasználónév, vagy jelszó!" }); }

    req.session.user = json.rows[0];
    res.json({ "message":"ok", "user":req.session.user });
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => { res.json({ "message":"Kijelentkezve." }); });
});

app.get('/session', (req, res) => {                      // oldal frissítés után ki van bejelentkezve?
    res.json({ "message":"ok", "user":req.session.user || null });
});

/* ---------- config ---------- */
app.get('/config', csakBelepve, async (req, res) => {
    const json = await DM.runQuery("select FIELD, VALUE, DESCRIPTOR from config order by ID_CONFIG");
    res.status(json.message === "ok" ? 200 : 500).json(json);
});

app.put('/config/:field', csakFoadmin, async (req, res) => {
    const hiba = configEllenorzes(req.params.field, req.body.value);
    if (hiba) { return res.status(400).json({ "message":hiba }); }

    const json = await DM.runExecute("update config set VALUE = ? where FIELD = ?", [String(req.body.value).trim(), req.params.field], req);
    if (json.message !== "ok")   { return res.status(500).json(json); }
    if (json.affectedRows === 0) { return res.status(404).json({ "message":"Nincs ilyen beállítás!" }); }
    await configBetolt(DM);                              // a díjszámítás azonnal az új értékkel dolgozik
    res.json(json);
});

/* ---------- páciens listák: sürgős elöl, azon belül a régebben várakozó elöl ---------- */
app.get('/paciensek', csakBelepve, async (req, res) => {
    const status = req.query.status || "";
    if (status && !S.STATUSZOK.includes(status)) { return res.status(400).json({ "message":"Ismeretlen státusz!" }); }

    let sql = `select ID_PACIENS, NEV, TAJ, SZULDATUM, STATUS, SURGOS_VARAKOZO, VARAKOZO_DATUM, ELOGOND_DATUM,
                      ELLATOTT_DATUM, TAVOZOTT_DATUM, NYUGDIJ
                 from paciensek ` + (status ? "where STATUS = ? " : "") +
              `order by SURGOS_VARAKOZO = 'Y' desc, VARAKOZO_DATUM is null, VARAKOZO_DATUM, NEV`;
    const json = await DM.runQuery(sql, status ? [status] : []);
    if (json.message !== "ok") { return res.status(500).json(json); }

    const most = new Date();                             // napidíj az idei évre, havidíj teljes jelenléttel az aktuális hónapra
    for (const p of json.rows) {
        p.NAPIDIJ = D.alapNapidij(p.NYUGDIJ, most.getFullYear(), cfg);
        p.HAVIDIJ = p.NAPIDIJ * D.honapNapjai(most.getFullYear(), most.getMonth() + 1);
    }
    res.json(json);
});

async function paciensBetolt(id) {
    const json = await DM.runQuery("select * from paciensek where ID_PACIENS = ?", [id]);
    return json.maxcount === 1 ? json.rows[0] : null;
}

async function utolsoIdoszak(id) {                       // a páciens legutóbbi ellátási időszaka + hány ellátás rekordja van
    const json = await DM.runQuery(`select i.ID_IDOSZAK, i.ELLATOTT_DATUM, i.TAVOZOTT_DATUM,
                                           (select count(*) from ellatas e where e.ID_IDOSZAK = i.ID_IDOSZAK) as REKORDOK
                                      from ellatasi_idoszak i where i.ID_PACIENS = ?
                                     order by i.ID_IDOSZAK desc limit 1`, [id]);
    return json.maxcount === 1 ? json.rows[0] : null;
}

/* ---------- státuszváltás. body: { irany:"elore"|"vissza", datum:"ÉÉÉÉ-HH-NN" } ---------- */
app.put('/paciensek/:id/statusz', csakAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const p  = await paciensBetolt(id);
    if (!p) { return res.status(404).json({ "message":"Nincs ilyen páciens!" }); }

    const lista = [];
    let uj;

    if (req.body.irany === "elore") {
        uj = S.kovetkezoStatusz(p.STATUS);
        if (!uj) { return res.status(400).json({ "message":"A távozott páciens csak újrafelvehető!" }); }

        const datum = req.body.datum;
        const hiba  = S.datumEllenorzes(datum, p[S.DATUM_MEZO[p.STATUS]]);
        if (hiba) { return res.status(400).json({ "message":hiba }); }

        if (uj === 'ellátott') {
            lista.push({ sql:"update paciensek set STATUS = ?, ELLATOTT_DATUM = ?, TAVOZOTT_DATUM = null where ID_PACIENS = ?", param:[uj, datum, id] });
            lista.push({ sql:"insert into ellatasi_idoszak (ID_PACIENS, ELLATOTT_DATUM) values (?, ?)", param:[id, datum] });
        } else if (uj === 'távozott') {
            const idoszak = await utolsoIdoszak(id);
            const json = await DM.runQuery("select count(*) as DB from ellatas where ID_IDOSZAK = ? and EV * 100 + HO > ?",
                                           [idoszak ? idoszak.ID_IDOSZAK : 0, Number(datum.substring(0, 4)) * 100 + Number(datum.substring(5, 7))]);
            if (json.rows.length && json.rows[0].DB > 0) {
                return res.status(409).json({ "message":"A távozás dátuma utáni hónapra már van ellátás rekord!" });
            }
            lista.push({ sql:"update paciensek set STATUS = ?, TAVOZOTT_DATUM = ? where ID_PACIENS = ?", param:[uj, datum, id] });
            lista.push({ sql:"update ellatasi_idoszak set TAVOZOTT_DATUM = ? where ID_PACIENS = ? and TAVOZOTT_DATUM is null", param:[datum, id] });
        } else {
            lista.push({ sql:`update paciensek set STATUS = ?, ${S.DATUM_MEZO[uj]} = ? where ID_PACIENS = ?`, param:[uj, datum, id] });
        }

    } else if (req.body.irany === "vissza") {
        uj = S.elozoStatusz(p.STATUS);
        if (!uj) { return res.status(400).json({ "message":"A várakozó státusz előtt nincs másik!" }); }

        if (p.STATUS === 'ellátott' || p.STATUS === 'távozott') {
            const idoszak = await utolsoIdoszak(id);
            if (idoszak && idoszak.REKORDOK > 0) {
                return res.status(409).json({ "message":"Vissza nem léptethető: a jelenlegi ellátási időszakra már van ellátás rekord!" });
            }
            if (p.STATUS === 'ellátott') {
                lista.push({ sql:"update paciensek set STATUS = ?, ELLATOTT_DATUM = null where ID_PACIENS = ?", param:[uj, id] });
                if (idoszak) { lista.push({ sql:"delete from ellatasi_idoszak where ID_IDOSZAK = ?", param:[idoszak.ID_IDOSZAK] }); }
            } else {
                lista.push({ sql:"update paciensek set STATUS = ?, TAVOZOTT_DATUM = null where ID_PACIENS = ?", param:[uj, id] });
                if (idoszak) { lista.push({ sql:"update ellatasi_idoszak set TAVOZOTT_DATUM = null where ID_IDOSZAK = ?", param:[idoszak.ID_IDOSZAK] }); }
            }
        } else {
            lista.push({ sql:"update paciensek set STATUS = ?, ELOGOND_DATUM = null where ID_PACIENS = ?", param:[uj, id] });
        }

    } else {
        return res.status(400).json({ "message":"Hibás irány!" });
    }

    const json = await DM.runTransaction(lista, req);
    if (json.message !== "ok") { return res.status(500).json(json); }
    res.json({ "message":"ok", "STATUS":uj });
});

/* ---------- újrafelvétel: távozott -> várakozó. A régi időszakok és havi rekordok megmaradnak ---------- */
app.post('/paciensek/:id/ujrafelvetel', csakAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    const p  = await paciensBetolt(id);
    if (!p)                       { return res.status(404).json({ "message":"Nincs ilyen páciens!" }); }
    if (p.STATUS !== 'távozott')  { return res.status(400).json({ "message":"Csak távozott páciens vehető fel újra!" }); }

    const hiba = S.datumEllenorzes(req.body.datum, p.TAVOZOTT_DATUM);
    if (hiba) { return res.status(400).json({ "message":hiba }); }

    const json = await DM.runTransaction([{ sql:`update paciensek set STATUS = 'várakozó', VARAKOZO_DATUM = ?, ELOGOND_DATUM = null,
                                                   ELLATOTT_DATUM = null, TAVOZOTT_DATUM = null where ID_PACIENS = ?`,
                                            param:[req.body.datum, id] }], req);
    if (json.message !== "ok") { return res.status(500).json(json); }
    res.json({ "message":"ok", "STATUS":"várakozó" });
});

configBetolt(DM).then(() => {
    app.listen(port, function () { console.log(`progi app listening at http://localhost:${port}`); });
});
