/* menü json tömb. text: menüpont neve; ikon: bootstrap icon class (https://icons.getbootstrap.com)
   tip=0: id="main1" TAG-be töltődik az url; tip=1: teljes oldal; tip=2: új lapon
--------------------------------------------------------------*/
var menü_json = [
  { text: "Kezdőlap", ikon: "bi-house-door", url: "banner.html", tip: 0 }
];


/* menü_json ból menüpontokat generál id="menu1_ul" ba
--------------------------------------------------------------*/
function menu_generator() {
  let result = '';
  for (let i = 0; i < menü_json.length; i++) {
    result += `<li class="xmenu" id="menu1_${i}"><i class="bi ${menü_json[i].ikon}"></i>${menü_json[i].text}</li>`;
  }
  return result;
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
