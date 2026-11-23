/* menü json tömb. text: menüpont neve; ikon: bootstrap icon class (https://icons.getbootstrap.com)
   tip=0: id="main1" TAG-be töltődik az url; tip=1: teljes oldal; tip=2: új lapon
   jog=0: mindenki; jog=1: bejelentkezett; jog=2: ADMIN vagy ADMIN_B; jog=3: csak ADMIN
--------------------------------------------------------------*/
var menü_json = [
  { text: "Kezdőlap",       ikon: "bi-house-door", url: "banner.html",        tip: 0, jog: 0 },
  { text: "Páciens listák", ikon: "bi-people",     url: "paciens_listak.html", tip: 0, jog: 1 },
  { text: "Beállítások",    ikon: "bi-gear",       url: "config.html",         tip: 0, jog: 1 }
];

var aktUser = null;                                 // a bejelentkezett operátor (session), index.html user_kiir() tölti

/* van-e joga a bejelentkezett usernek (menü_json jog értékei szerint)
--------------------------------------------------------------*/
function jogosult( jog ) {
  if (jog == 0) { return true; }
  if (!aktUser) { return false; }
  if (jog == 1) { return true; }
  if (jog == 2) { return aktUser.ADMIN == 'Y' || aktUser.ADMIN_B == 'Y'; }
  return aktUser.ADMIN == 'Y';
}

/* menü_json ból menüpontokat generál id="menu1_ul" ba, csak amihez van joga
--------------------------------------------------------------*/
function menu_generator() {
  let result = '';
  for (let i = 0; i < menü_json.length; i++) {
    if (!jogosult(menü_json[i].jog)) { continue; }
    result += `<li class="xmenu" id="menu1_${i}"><i class="bi ${menü_json[i].ikon}"></i>${menü_json[i].text}</li>`;
  }
  return result;
}

/* html-be írás előtt: < > & " ' karakterek cseréje (adatbázisból jövő szöveg ne fusson le html-ként)
--------------------------------------------------------------*/
function esc( s ) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}

function ft( szam ) {                               // 100203 --> "100 203 Ft"
  return (szam === null || szam === undefined) ? "" : Number(szam).toLocaleString('hu-HU') + " Ft";
}

/* táblázat generátor: JSON rows --> Bootstrap táblázat a "hova" TAG-be. Fejlécre kattintva rendez, sorra kattintva kijelöl.
   oszlopok: [ {mezo:"NEV", cim:"Név", tip:"ft"|"szam"|"", mobil:false (kis képernyőn rejtett), formaz:function(ertek, sor){ return html; }} ]
   ops: {kattint: function(sor){...}}
   pl: tablazat("#pl_tabla", json.rows, [{mezo:"NEV", cim:"Név"}, {mezo:"NAPIDIJ", cim:"Napidíj", tip:"ft"}], {kattint: sor => ...});
--------------------------------------------------------------*/
function tablazat( hova, rows, oszlopok, ops = {} ) {
  ops = $.extend({ kattint: null, rendez: null, irany: 1 }, ops);

  if (ops.rendez) {                                   // rendezés: üres érték a végére, szöveg magyar abc szerint
    let m = ops.rendez;
    rows.sort(function(a, b) {
      if (a[m] === null || a[m] === "") { return 1; }
      if (b[m] === null || b[m] === "") { return -1; }
      if (typeof a[m] === "number") { return (a[m] - b[m]) * ops.irany; }
      return String(a[m]).localeCompare(String(b[m]), 'hu') * ops.irany;
    });
  }

  let s = `<div class="table-responsive"><table class="table table-sm table-striped table-hover align-middle"><thead><tr>`;
  oszlopok.forEach(function(o, i) {
    let nyil = ops.rendez == o.mezo ? (ops.irany > 0 ? " ▲" : " ▼") : "";
    let cls  = (o.mobil === false ? "d-none d-md-table-cell " : "") + (o.tip == "ft" || o.tip == "szam" ? "text-end" : "");
    s += `<th class="${cls}" data-i="${i}" style="cursor:pointer">${o.cim}${nyil}</th>`;
  });
  s += `</tr></thead><tbody>`;

  rows.forEach(function(sor, j) {
    s += `<tr data-sor="${j}" style="cursor:pointer">`;
    oszlopok.forEach(function(o) {
      let ertek = sor[o.mezo];
      let html  = o.formaz ? o.formaz(ertek, sor) : (o.tip == "ft" ? ft(ertek) : esc(ertek));
      let cls   = (o.mobil === false ? "d-none d-md-table-cell " : "") + (o.tip == "ft" || o.tip == "szam" ? "text-end" : "");
      s += `<td class="${cls}">${html}</td>`;
    });
    s += `</tr>`;
  });
  if (rows.length == 0) { s += `<tr><td colspan="${oszlopok.length}" class="text-center text-muted">Nincs megjeleníthető adat.</td></tr>`; }
  s += `</tbody></table></div>`;

  $(hova).html(s);

  $(hova + " th").on("click", function() {
    let mezo = oszlopok[$(this).data("i")].mezo;
    let irany = (ops.rendez == mezo) ? -ops.irany : 1;
    tablazat(hova, rows, oszlopok, $.extend({}, ops, { rendez: mezo, irany: irany }));
    if (ops.kattint) { ops.kattint(null); }          // rendezés után nincs kijelölt sor
  });

  $(hova + " tbody tr[data-sor]").on("click", function() {
    $(hova + " tbody tr").removeClass("table-primary");
    $(this).addClass("table-primary");
    if (ops.kattint) { ops.kattint(rows[$(this).data("sor")]); }
  });
}

/* server: url címről a "hova" TAG-be kerül a html oldal
-----------------------------------------------------------------*/
function ajax_get( urlsor, hova ) {
    $.ajax({url: urlsor, type:"get", cache:false, dataType:'html',
        beforeSend: function()      { $('#loader1').css("display","block"); },
        success:    function(data)  { $(hova).html(data); },
        error:      function(jqXHR) { mySend({text:`Az oldal nem tölthető be (${jqXHR.status}): ${urlsor}`, tip:"danger", mp:5}); },
        complete:   function()      { $('#loader1').css("display","none"); }
    });
}

/* server: Rest API hívások. await-tel kell hívni, a válasz JSON. Hiba esetén null, és hibaüzenet ablak.
   pl: let lista  = await ajax_getjson("varakozok");
       let valasz = await ajax_post("login", {login:"admin", jelszo:"..."});
-------------------------------------------------------------------*/
function ajax_getjson( urlsor )        { return ajax_rest({url: urlsor, type:"get"}); }
function ajax_post( urlsor, adat={} )  { return ajax_rest({url: urlsor, type:"post", contentType:"application/json; charset=UTF-8", data: JSON.stringify(adat)}); }
function ajax_put( urlsor, adat={} )   { return ajax_rest({url: urlsor, type:"put",  contentType:"application/json; charset=UTF-8", data: JSON.stringify(adat)}); }

async function ajax_rest( ops ) {
    $('#loader1').css("display","block");
    try {
        return await $.ajax( $.extend({cache:false, dataType:'json'}, ops) );
    } catch (jqXHR) {
        let szoveg = jqXHR.responseJSON ? jqXHR.responseJSON.message : `Szerver hiba (${jqXHR.status})`;
        mySend({text:szoveg, tip:"danger", mp:5});
        return null;
    } finally {
        $('#loader1').css("display","none");
    }
}

/* üzenet ablakot generál, s jelenít meg. alkalmazása:
   mySend( {text: "Pite!", tip: "info"} );    tip: Bootstrap szín --> "info", "success", "warning", "danger"
   mp: ennyi másodperc után eltűnik (0: nem tűnik el)
-------------------------------------------------------------------------------------*/
function mySend( ops ) {
    ops = $.extend( {}, {text:"", tip:"success", mp:5}, ops );
    var cim = {success:"Rendben", info:"Információ", warning:"Figyelem", danger:"Hiba"}[ops.tip] || ops.tip;
    var id  = "toast1";
    var idx = "#"+id;                               // jquery
    var s =`<div id="${id}" class="toast bg-${ops.tip}-subtle hide" style="position:fixed; right:10px; bottom:10px; z-index:99999">
                <div class="toast-header">
                  <strong class="me-auto"><i class="bi bi-chat-square-text"></i> ${cim}</strong>
                  <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body fw-bold">${ops.text}</div>
            </div>`;

    $(idx).remove();
    $("body").append(s);
    $(idx).toast({ autohide: ops.mp > 0, delay: ops.mp * 1000 });
    $(idx).toast("show");
};

/* kérdés ablakot generál, s jelenít meg. Az OK gombra lefut az ok függvény. Alkalmazása:
   myQuestion({text: `Pite ...? `, ok: function() { mySend( {text: "Pite!", tip:"warning"} ); } });
-----------------------------------------------------------------------------------------------------------*/
function myQuestion( ops ) {
    var id  = "myQuestion";
    var idx = "#"+id;                               // jquery
    var s =`<div class="modal fade" id="${id}" data-bs-backdrop="static">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                <div class="modal-header bg-secondary text-white"><h3 class="modal-title">Megerősítés</h3></div>
                <div class="modal-body">${ops.text}</div>
                <div class="modal-footer">
                    <button type="button" class="button ok" data-bs-dismiss="modal">OK</button>
                    <button type="button" class="button cancel" data-bs-dismiss="modal">mégse</button>
                </div>
                </div>
            </div>
            </div>`;

    $(idx).remove();
    $("body").append(s);
    $(idx + " .ok").on("click", ops.ok);
    $(idx).modal('show');
};
