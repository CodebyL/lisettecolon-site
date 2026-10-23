(function(){
  "use strict";
  var CFG=window.LC_CONFIG||{}, live=document.getElementById("live-booking"), form=document.getElementById("request-form"),
      link=document.getElementById("booking-link"), fmt=document.getElementById("format-field"),
      town=document.getElementById("b-town"), townL=document.getElementById("b-town-l"), townH=document.getElementById("b-town-h");
  // When a real booking page is configured, show it; the request form stays as the fallback below it.
  var urls=CFG.bookingUrls||{};
  function current(){var c=document.querySelector("input[name=fmt]:checked");return c?c.value:"in_person";}
  function update(){
    var f=current(); fmt.value=f;
    var u=urls[f];
    if(u){live.hidden=false;link.href=u;}else{live.hidden=true;}
    var inPerson=f==="in_person";
    town.required=inPerson; townH.textContent=inPerson?"Where should we meet?":"Optional.";
  }
  document.querySelectorAll("input[name=fmt]").forEach(function(r){r.addEventListener("change",update);});
  try{var want=new URLSearchParams(location.search).get("format");var pick=want&&document.querySelector("input[name=fmt][value='"+want.replace(/[^a-z_]/g,"")+"']");if(pick)pick.checked=true;}catch(e){}
  update();
})();
