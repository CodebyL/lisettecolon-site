/* Checkout summary. Prices here are for display only; the server sets the real amount from its own catalog. */
(function(){
  "use strict";
  var CFG=window.LC_CONFIG||{};
  function $(id){return document.getElementById(id)}
  var C={
    "website-starter":{name:"Starter website",total:1200,kind:"website",desc:"One page with services, hours, contact and map, one form, one round of changes. About 1 to 2 weeks after kickoff.",
      options:[{id:"deposit",label:"50% deposit now, 50% at launch",now:600,later:"$600 invoiced on launch day, before the site goes live on your domain."},
               {id:"plan12",label:"12-month plan",now:300,later:"Then $85 a month for 12 months, charged automatically. Total $1,320. The site stays on my hosting until paid in full."}]},
    "website-standard":{name:"Standard website",total:2500,kind:"website",desc:"Up to 5 pages, two forms, your content rewritten, your photos, Google Maps and search basics, two rounds of changes. About 3 to 4 weeks after kickoff.",
      options:[{id:"deposit",label:"50% deposit now, 50% at launch",now:1250,later:"$1,250 invoiced on launch day, before the site goes live on your domain."},
               {id:"plan12",label:"12-month plan",now:625,later:"Then $175 a month for 12 months, charged automatically. Total $2,725. The site stays on my hosting until paid in full."}]},
    "website-premium":{name:"Premium website",total:3800,kind:"website",desc:"Up to 10 pages, two forms, a photo session, menu or flyer conversion, Google Business Profile cleanup and launch-day social graphics, three rounds of changes. About 5 to 6 weeks after kickoff.",
      options:[{id:"deposit",label:"50% deposit now, 50% at launch",now:1900,later:"$1,900 invoiced on launch day, before the site goes live on your domain."},
               {id:"plan12",label:"12-month plan",now:950,later:"Then $270 a month for 12 months, charged automatically. Total $4,190. The site stays on my hosting until paid in full."}]},
    "photo-session":{name:"Photo session",total:450,desc:"About 20 edited photos taken at your business. We pick the date together after you book.",options:[{id:"deposit",label:"Deposit to hold a date",now:150,later:"$300 balance invoiced after the session."}]},
    "drone":{name:"Drone photos and video",total:625,desc:"About 10 edited aerial photos and a short video clip. Flights depend on weather and local airspace rules; if a flight isn't allowed at your site, the deposit is refunded.",options:[{id:"deposit",label:"Deposit to hold a date",now:200,later:"$425 balance invoiced after delivery."}]},
    "logo":{name:"Logo refresh",total:400,desc:"A cleaned-up, modern version of your logo in web and print files.",options:[{id:"deposit",label:"50% deposit now",now:200,later:"$200 invoiced when you approve the final files."}]},
    "gbp":{name:"Google Business Profile setup",total:250,desc:"Categories, hours, services, photos and description completed and cleaned up. You add me as a manager; you stay the owner.",options:[{id:"full",label:"Pay in full",now:250,later:"No further charges."}]},
    "local-search":{name:"Local Search Setup",total:450,desc:"Profile cleanup, page titles and descriptions, business details marked up for Google, Search Console and sitemap, five matching listings, and a review-request link and card. No ranking is guaranteed.",options:[{id:"full",label:"Pay in full",now:450,later:"No further charges."}]},
    "local-visibility":{name:"Local Visibility plan",recurring:true,desc:"Two Google profile posts, new photos, drafted review replies, one site update and a one-page report each month. Cancel with 30 days' notice. No ranking is guaranteed.",options:[{id:"monthly",label:"Monthly",now:150,later:"$150 every month after, charged automatically, until you cancel."}]},
    "care-hosting":{name:"Hosting plan",recurring:true,eligibility:true,desc:"Site online, secure and backed up, with domain renewal reminders. No content changes.",options:[{id:"monthly",label:"Monthly",now:35,later:"$35 every month after, charged automatically."},{id:"yearly",label:"Yearly",now:350,later:"$350 every year after, with a reminder 30 days before renewal."}]},
    "care-care":{name:"Care plan",recurring:true,eligibility:true,desc:"Hosting plus up to 1 hour of updates a month, done within 2 business days. Unused hours don't roll over.",options:[{id:"monthly",label:"Monthly",now:100,later:"$100 every month after, charged automatically."},{id:"yearly",label:"Yearly",now:1000,later:"$1,000 every year after, with a reminder 30 days before renewal."}]},
    "care-plus":{name:"Care Plus plan",recurring:true,eligibility:true,desc:"Care plus up to 3 hours a month, a monthly visitor report and same-business-day urgent changes.",options:[{id:"monthly",label:"Monthly",now:200,later:"$200 every month after, charged automatically."},{id:"yearly",label:"Yearly",now:2000,later:"$2,000 every year after, with a reminder 30 days before renewal."}]},
    "update-hour":{name:"Extra update hour",total:85,desc:"One hour of changes to a site I built or look after. I confirm what fits in the hour before starting.",options:[{id:"full",label:"Pay in full",now:85,later:"No further charges."}]}
  };
  var money=function(n){return "$"+n.toLocaleString("en-US")};
  var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
  var key=null; try{key=new URLSearchParams(location.search).get("item")}catch(e){}
  var item=C[key], sum=$("co-summary"), form=$("co-form");
  if(!item){
    sum.innerHTML='<h2 class="h4">Choose a service first</h2><p class="body">This page needs a service from the price list.</p><div class="actions"><a class="btn" href="services.html#online">See services you can book online</a></div>';
    return;
  }
  var opt=item.options[0];
  function draw(){
    sum.innerHTML='<span class="label">'+(item.recurring?"Plan":"Service")+'</span><h2 class="d3">'+esc(item.name)+'</h2><p class="body">'+esc(item.desc)+'</p>'+
      '<ul class="facts">'+
      (item.total?'<li><b>Total price</b><span class="num">'+money(item.total)+'</span></li>':'')+
      '<li><b>Due now</b><span class="num"><strong>'+money(opt.now)+'</strong></span></li>'+
      '<li><b>Later</b><span>'+esc(opt.later)+'</span></li>'+
      (item.kind==="website"?'<li><b>Before work starts</b><span>We confirm the details on a kickoff call. If the package isn\'t the right fit, we change it or I refund the deposit in full.</span></li>':'')+
      (item.eligibility?'<li><b>Eligibility</b><span>For sites I built or have checked first. If your site isn\'t eligible, I refund the first payment.</span></li>':'')+
      (!item.recurring && opt.id!=="full"?'<li><b>Refunds</b><span>Deposit fully refunded if you cancel before work starts. Once work starts, it covers work already done.</span></li>':'')+
      '</ul>';
  }
  if(item.options.length>1){
    $("co-options").hidden=false;
    $("co-options-list").innerHTML=item.options.map(function(o,i){return '<label class="option"><input type="radio" name="option" value="'+o.id+'"'+(i===0?" checked":"")+'><span>'+esc(o.label)+'<small>'+money(o.now)+' now</small></span></label>'}).join("");
    $("co-options-list").addEventListener("change",function(e){opt=item.options.filter(function(o){return o.id===e.target.value})[0];draw()});
  }
  draw(); form.hidden=false;
  var pay=$("co-pay"), status=form.querySelector(".status");
  function show(k,m){status.className="status "+k;status.textContent=m;status.hidden=false}
  form.addEventListener("submit",function(e){
    e.preventDefault(); var ok=true;
    ["co-biz","co-email"].forEach(function(id){var el=$(id),v=el.value.trim(),bad=!v||(el.type==="email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));el.setAttribute("aria-invalid",bad?"true":"false");var er=el.parentNode.querySelector(".err");er.hidden=!bad;er.textContent=bad?(v?"Please enter a valid email address.":"Please fill this in."):"";if(bad)ok=false});
    var t=$("co-terms"),ter=t.closest(".field").querySelector(".err");ter.hidden=t.checked;ter.textContent=t.checked?"":"Please confirm you've read the terms.";if(!t.checked)ok=false;
    if(!ok){show("bad","Please check the highlighted fields.");return}
    if(!CFG.functionsUrl){show("info","Preview mode: online payments aren't switched on yet, so nothing was charged. To book now, email hi@lisettecolon.com or call (917) 960-4871.");return}
    pay.disabled=true;pay.textContent="Opening secure payment…";
    fetch(CFG.functionsUrl+"/create-checkout",{method:"POST",headers:{"Content-Type":"application/json","apikey":CFG.supabaseAnonKey||""},
      body:JSON.stringify({item:key,option:opt.id,business:$("co-biz").value.trim(),email:$("co-email").value.trim()})})
    .then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})})
    .then(function(res){if(res.ok&&res.j.url&&/^https:\/\/checkout\.stripe\.com\//.test(res.j.url)){location.href=res.j.url}else{pay.disabled=false;pay.textContent="Continue to secure payment";show("bad",(res.j&&res.j.error)||"Payment couldn't start. Nothing was charged. Please try again.")}})
    .catch(function(){pay.disabled=false;pay.textContent="Continue to secure payment";show("bad","Payment couldn't start because the connection dropped. Nothing was charged.")});
  });
})();
