/*
  mysql2 async - await osztály, pool kapcsolattal
  constructor -->  def paraméter, amely felülírható példányosításnál: const DM = new DataModule( {port:9406, password:"pite"} );
  let sjson = await runQuery(sql, param)            --> sql select. return: { "message":msg, "maxcount":rekordszám, "rows":[...] }
  let tjson = await runExecute(sql, param, req)     --> sql insert, update, delete + naplózás. return: { "message":msg, "affectedRows":db, "insertId":id }

  A user inputot "?" paraméterként kell átadni, NEM az sql stringbe fűzve! (sql injection)
     pl: DM.runQuery("select * from paciens where STATUS = ? and SURGOS = ?", ["varakozo", 1]);
*/

'use strict';
const mysql = require('mysql2/promise');

const PROJEKT = 'SZ6-B';                                       // a napló COMMENT mezőjébe kerül

class DataModule {

    constructor(mysql_conn = {}) {
        this.mysql_conn = {
            host:     mysql_conn.host     || 'localhost',
            user:     mysql_conn.user     || 'root',
            port:     mysql_conn.port     || 3306,
            password: mysql_conn.password || '',
            database: mysql_conn.database || 'csany_zeg',
            dateStrings: true,                                 // dátum stringként jön ('2026-11-02'), így nincs időzóna eltolódás
            connectionLimit: 10
        };
        this.pool = mysql.createPool(this.mysql_conn);
    }

    async runQuery(sql, param = []) {                          // SELECT sql
        try {
            const [rows] = await this.pool.query(sql, param);
            return { "message":"ok", "maxcount":rows.length, "rows":rows };
        } catch (err) {
            console.error('Hiba:', err.message);
            return { "message":err.sqlMessage || err.message, "maxcount":-1, "rows":[] };
        }
    }

    async runExecute(sql, param = [], req = null) {            // insert, update, delete sql
        let msg = "ok";
        let eredmeny = {};
        try {
            [eredmeny] = await this.pool.query(sql, param);
        } catch (err) {
            msg = err.sqlMessage || err.message;
            console.error('Hiba:', err.message);
        }
        await this._naplo(sql, param, req, msg, eredmeny);
        return { "message":msg, "affectedRows":eredmeny.affectedRows || 0, "insertId":eredmeny.insertId || 0 };
    }

    /* minden adatkarbantartás a naplóba kerül. req nélkül (automatikus művelet) a "RENDSZER" a végrehajtó
       !!! a mezőneveket a végleges naplo táblához kell igazítani */
    async _naplo(sql, param, req, msg, eredmeny) {
        let userx = "RENDSZER";
        let url   = "";
        if (req) {
            userx = req.session && req.session.user ? req.session.user.NEV : "- no login -";
            url   = req.socket.remoteAddress + req.originalUrl;
        }
        let sqlx = sql.replace(/\s\s+/g, ' ') + "\n" + JSON.stringify(param) + "\n" + JSON.stringify(eredmeny) + "\n" + msg;
        try {
            await this.pool.query("insert into naplo (USER, URL, SQLX, COMMENT) values (?, ?, ?, ?)", [userx, url, sqlx, PROJEKT]);
        } catch (err) {
            console.error('Napló hiba:', err.message);
        }
    }
}

module.exports = DataModule;
