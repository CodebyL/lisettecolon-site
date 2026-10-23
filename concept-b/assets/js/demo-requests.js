(function(){
  "use strict";
  var SETS={
    con:{biz:"Harbor Masonry (example)",title:"Request an estimate",what:"What do you need?",when:"Town",dw:"New front steps",dt:"Massapequa",steps:["New","Quote sent","Scheduled","Done"],
      seed:[["Paver patio","Syosset · Lee",0],["Retaining wall","Bethpage · Ortiz",1],["Driveway apron","Hicksville · Shah",2]]},
    who:{biz:"Bay Supply Co. (example)",title:"Place an order",what:"Items",when:"Delivery day",dw:"16 oz cups × 40 cases",dt:"Tomorrow",steps:["New","Packing","Out for delivery","Delivered"],
      seed:[["To-go bags × 10","Main St Pizza",0],["Gloves L × 6","Sal's Bakery",1],["Foil pans × 12","Park Café",2]]},
    off:{biz:"Elm Street Tax Office (example)",title:"Book an appointment",what:"Service",when:"Preferred day",dw:"Tax return review",dt:"Tuesday",steps:["New","Waiting on items","Ready","Done"],
      seed:[["Payroll question","Walk-in · Kim",0],["Return prep","2 of 5 items · Patel",1],["Return review","Signed · Gomez",2]]}
  };
  var cur="con", items=[], id=0;
  var cols=document.getElementById("demo-cols"), form=document.getElementById("demo-form"), count=document.getElementById("demo-count");
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
  function load(k){
    cur=k; var s=SETS[k]; id=0;
    items=s.seed.map(function(x){return{id:++id,t:x[0],w:x[1],st:x[2]}});
    document.getElementById("demo-biz").textContent=s.biz;
    document.getElementById("demo-title").textContent=s.title;
    document.getElementById("d-what-l").textContent=s.what;
    document.getElementById("d-when-l").textContent=s.when;
    document.getElementById("d-what").value=s.dw; document.getElementById("d-when").value=s.dt;
    var st=form.querySelector(".status"); st.hidden=true;
    render();
  }
  function render(focusId){
    var s=SETS[cur];
    cols.style.gridTemplateColumns="repeat(4,minmax(120px,1fr))";
    cols.innerHTML=s.steps.map(function(name,i){
      var list=items.filter(function(x){return x.st===i});
      return '<div class="col"><h3><span>'+esc(name)+'</span><span>'+list.length+'</span></h3>'+list.map(function(x){
        var btns='';
        if(i>0) btns+='<button class="chip" type="button" data-mv="-1" data-id="'+x.id+'" aria-label="Move '+esc(x.t)+' back to '+esc(s.steps[i-1])+'" style="min-height:32px;padding:2px 10px;font-size:13px">&larr;</button>';
        if(i<s.steps.length-1) btns+='<button class="chip" type="button" data-mv="1" data-id="'+x.id+'" aria-label="Move '+esc(x.t)+' to '+esc(s.steps[i+1])+'" style="min-height:32px;padding:2px 10px;font-size:13px">Next &rarr;</button>';
        return '<div class="tk'+(x.fresh?' is-new':'')+'"><b>'+esc(x.t)+'</b>'+esc(x.w)+'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'+btns+'</div></div>';
      }).join("")+'</div>';
    }).join("");
    count.textContent=items.length+" total";
    if(focusId){var b=cols.querySelector('[data-id="'+focusId+'"]');if(b)b.focus();}
  }
  cols.addEventListener("click",function(e){
    var b=e.target.closest("[data-mv]"); if(!b)return;
    var it=items.find(function(x){return x.id===+b.getAttribute("data-id")});
    it.st=Math.max(0,Math.min(SETS[cur].steps.length-1,it.st+(+b.getAttribute("data-mv")))); it.fresh=false;
    render(it.id);
  });
  form.addEventListener("submit",function(e){
    e.preventDefault();
    var ok=true;
    form.querySelectorAll("[required]").forEach(function(el){
      var bad=!el.value.trim(); el.setAttribute("aria-invalid",bad?"true":"false");
      var er=el.parentNode.querySelector(".err"); er.hidden=!bad; er.textContent=bad?"Please fill this in.":""; if(bad)ok=false;
    });
    if(!ok)return;
    items.forEach(function(x){x.fresh=false});
    items.unshift({id:++id,t:document.getElementById("d-what").value.trim(),w:document.getElementById("d-when").value.trim()+" · "+document.getElementById("d-name").value.trim(),st:0,fresh:true});
    render();
    var st=form.querySelector(".status"); st.hidden=false; st.textContent="Demo only: the request was added to the list on this page. Nothing was sent.";
  });
  document.querySelectorAll("[data-demo]").forEach(function(b){
    b.addEventListener("click",function(){document.querySelectorAll("[data-demo]").forEach(function(x){x.setAttribute("aria-selected",x===b?"true":"false")});load(b.getAttribute("data-demo"))});
  });
  load("con");
})();
