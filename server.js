const express     = require('express');
const session     = require('express-session');
const DataModule  = require('./datamodule_mysql2.js');

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

app.use(express.static('public'));                       // public/index.html a def.
app.use(express.json());                                 // a frontend JSON-t küld (ajax_post)
app.use(session({ name:'user_sid', secret:beallitas.session_secret, resave:false, saveUninitialized:false }));

/* ---------- jogosultság vizsgálat (route-ok elé) ---------- */
function csakBelepve(req, res, next) {                   // listák, kimutatások
    if (req.session.user) { return next(); }
    res.status(401).json({ "message":"Nincs bejelentkezve!" });
}

function csakAdmin(req, res, next) {                     // jelenlét, zárás, befizetés, státuszváltás
    if (req.session.user && ['ADMIN', 'ADMIN_B'].includes(req.session.user.JOGOSULTSAG)) { return next(); }
    res.status(403).json({ "message":"Ehhez a művelethez nincs jogosultsága!" });
}

/* ---------- login / logout ---------- */
app.post('/login', async (req, res) => {
    const login  = req.body.login  || "";
    const jelszo = req.body.jelszo || "";
    // TODO: operator tábla mezőnevei és a jelszó tárolás módja a közös SQL (SZ6-A) szerint
    const sql = "select ID, NEV, EMAIL, JOGOSULTSAG from operator where EMAIL = ? and PASSWORD = md5(?) limit 1";
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

app.listen(port, function () { console.log(`progi app listening at http://localhost:${port}`); });
