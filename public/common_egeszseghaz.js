/* menü json tömb. 

https://stackoverflow.com/questions/2799283/use-a-json-array-with-objects-with-javascript

*/
var menü_json = [ {
  }];


/* menü_json ból menüpontokat generál id="menu1_ul" ba
--------------------------------------------------------------*/
function menu_generator() {
  let result = '';
  for (var i = 0; i < menü_json.length; i++) {
    result += `<li class="xmenu" id="menu1_${i}"><img src="${menü_json[i].ikon}">${menü_json[i].text}</li>`;
  }
 return result;
}

/* ------- nem kell sql injection ! tessék szépen "kieszképelni" a user inputot! */
function strE(s) { return s.replaceAll("'","").replaceAll("\"","").replaceAll("\t","").replaceAll("\\","").replaceAll("`","");}

/* length kar. hosszú reandom stringet generál (pl: jelszó, vagy auto ID generátor)
-------------------------------------------------*/
function makeid(length) {
let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

/* server: url címről <TAG> "hova" id-be kerül a html / json adat
-----------------------------------------------------------------*/
function ajax_get( urlsor, hova, tipus, aszinkron ) {
    $.ajax({url: urlsor, type:"get", async:aszinkron, cache:false, dataType:tipus===0?'html':'json',
        beforeSend:function(xhr)   { $('#loader1').css("display","block");  }, 
        success:   function(data)  { $(hova).html(data); },
        error:     function(jqXHR, textStatus, errorThrown) {mySend({text:jqXHR.responseText, tip:"danger", mp:5});},
        complete:  function()      { $('#loader1').css("display","none"); }   
    });
return true;
};

/* server: url címről "return s"-be kerül a html / json adat: Rest API
/*-------------------------------------------------------------------*/
function ajax_post( urlsor, tipus ) {
    var s = "";
    $.ajax({url: urlsor, type:"post", async:false, cache:false, dataType:tipus===0?'html':'json',
        beforeSend:function(xhr)   { $('#loader1').css("display","block");  }, 
        success:   function(data)  { s = data; },
        error:     function(jqXHR, textStatus, errorThrown) {mySend({text:jqXHR.responseText, tip:"danger", mp:5});},
        complete:  function()      { $('#loader1').css("display","none"); } 
    });
    return s;
};  

/* üzenet ablakot generál, s jelenít meg. alkalmazása: 
   mySend( {text: "Pite!",  tip: Bootstap --> "info" "success", "warning", "error"} );   
-------------------------------------------------------------------------------------*/
function mySend( ops ) {
    var defOps = {text:"", tip:"success", mp:5 };   /* tip: info, success, danger, warning; mp: 5 másodperc (0:off) */
    ops = $.extend( {}, defOps, ops );              // tömb összefésülése  
    var id = "toast1";
    var idx = "#"+id;                               // jquery
    var s =`<div id="${id}" class="toast bg-${ops.tip} text-black hide" style="position:fixed; right:10px; bottom:10px; z-index:99999">
                <div class="toast-header">
                <h3 class="me-auto"><i class="bi bi-chat-square-text"></i> ${ops.tip} ...</h3>
                <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
              </div>
                <div class="toast-body" style="font-size: 12pt; font-weight:bold;">${ops.text}</div>
            </div>`;

    $(idx).remove();       
    $("body").append(s); 

    if (ops.mp == 0) { $(idx).toast({ autohide: false }); } 
    $(idx).toast("show");
};

/* kérdés ablakot generál, s jelenít meg. Alkalmazása: 
   myQuestion({text: `Pite ...? `});
   $("#myQuestion").on("click",".btn-success", function() {  mySend( {text: "Pite!",  tip:"warning"} );   });
-----------------------------------------------------------------------------------------------------------*/
function myQuestion( ops ) {
    var id = "myQuestion";
    var idx = "#"+id;                               // jquery
    var s =`<div class="modal" id="${id}" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                <div class="modal-header bg-secondary text-white"><h3 class="modal-title">Megerősítés</h3></div>
                <div class="modal-body">${ops.text}</div>
                <div class="modal-footer">
                    <div class="button ok" data-bs-dismiss="modal">OK</div>
                    <div class="button cancel" data-bs-dismiss="modal">mégse</div>
                </div>
                </div>
            </div>
            </div>`;
           
    $(idx).off('click');       // unbind, különben N.szer futna le az N. hívásra !!        
    $(idx).remove();      
    $("body").append(s); 
    $(idx).modal('show');   
};