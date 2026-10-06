/*
  mysql2 async - await osztály
  constructor -->  def paraméter, amely felülírható példányosításnál: const DM = new DataModule( {port:9406, password:"pite"} );
  let sjson =  runQuery(sql) --> sql select, méri a rekordszámot is.  return: { "message":msg, "maxcount":maxcount, "rows":res2 }
  let tjson =  runExecute(sql, req, név) --> sql insert, update, select. a req és a név a naplózáshoz kell.

*/

'use strict';
const header1 = 'Content-Type';
const header2 = 'application/json; charset=UTF-8';
const mysql = require('mysql2/promise');

class DataModule {

    constructor(mysql_conn = {}) {
        this.mysql_conn = {
            host: mysql_conn.host         || 'localhost',         
            user: mysql_conn.user         || 'root',               
            port: mysql_conn.port         || "3306",
            password: mysql_conn.password || '123456',
            database: mysql_conn.database || 'sz12_egeszseghaz'  
        };
    }

    _strEscape(s) 
    { 
        return s.trim().replaceAll("'","").replaceAll("\"","").replaceAll("\t","").replaceAll("\\","").replaceAll("`","");
    }

    _vagUtolso(s, sub) 
    {
        let poz = s.toUpperCase().lastIndexOf(sub.toUpperCase());
        return poz === -1 ? s : s.substring(0, poz);
    };
 
    async runQuery(sql) {                                      // SELECT sql (+ count)
        let maxcount = 0;                                      // rekordszám
        let msg = "ok";
        let sqlC =  this._vagUtolso(sql, ";");                 // a "count"-hoz a végén nem lehet ";"
            sqlC =  this._vagUtolso(sqlC, " LIMIT ");          // "limit" sem kell, vagy marad az előző, ha nincs...
            sqlC =  this._vagUtolso(sqlC, " ORDER BY ");       // "order" sem kell, vagy marad az előző, ha nincs...
        let json_data, conn, res1, res2=[];

        try {
            conn = await mysql.createConnection(this.mysql_conn);
            [res1] = await conn.execute(`select count(*) as db from (${sqlC}) as tabla;`);  // tömb 0. eleme
            maxcount = res1[0].db | 0;                         // :-) 
            if (maxcount > 0) {  
              [res2] = await conn.execute(sql);   
            }
        } catch (err) {
            msg = err.sqlMessage; maxcount = -1; console.error('Hiba:', err); 
        } finally {
            await conn.end();                                     // !!! conn error esetet nem kezeli 
            json_data = JSON.stringify({ "message":msg, "maxcount":maxcount, "rows":res2 });  // rest-api
        }
        return json_data;
    }

    async runExecute(sql, req, loginuser) {                     // insert, update, delete sql
        let msg = "ok";
        let json_data, conn, res1, jrn1, jrn;
        let jrn_text = "";
        let userx = "- no login -";
        if (loginuser && loginuser !== "") { userx = loginuser; } 

        try 
        {
            conn = await mysql.createConnection(this.mysql_conn); 
            res1 = await conn.execute(sql);  
            jrn_text = JSON.stringify(res1);
            console.log("execute: " + jrn_text);
        } 
        catch (err) 
        {   msg = err.sqlMessage; console.error('Hiba:', err); 
        } 
        finally 
        {    
            jrn_text = (sql.replace(/\s\s+/g, ' ')+"\n"+jrn_text+"\n"+msg).replaceAll("\"","'");
            jrn  = `insert into naplo (USER, URL, SQLX) values ("${userx}","${req.socket.remoteAddress}${req.originalUrl} ","${jrn_text}");`;      
            jrn1 = await conn.execute(jrn); 
            await conn.end();                                    
            json_data = JSON.stringify({"message":msg, "rows":res1 });  // rest-api
        }
        return json_data;
    } 

    async sendJson_toFrontend (res, sql) {
        let json_data = await this.runQuery(sql);
        res.set(header1, header2);
        res.send(json_data);
        res.end();
    }
}

module.exports = DataModule;