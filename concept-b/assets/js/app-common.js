/* Shared helpers for the client account and admin screens. */
window.LCApp = (function(){
  "use strict";
  var CFG = window.LC_CONFIG || {};
  var sb = (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase) ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" } }) : null;
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function money(c){ return c == null ? "" : "$" + (c/100).toLocaleString("en-US", { minimumFractionDigits: (c % 100 ? 2 : 0), maximumFractionDigits: 2 }); }
  function date(d, withTime){ if(!d) return ""; var x = new Date(d); return x.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) + (withTime ? ", " + x.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", timeZoneName:"short" }) : ""); }
  var TONE = { paid:"ok", succeeded:"ok", active:"ok", live:"ok", confirmed:"ok", done:"ok", signed:"ok", completed:"ok",
    open:"warn", pending:"warn", past_due:"bad", unpaid:"bad", failed:"bad", uncollectible:"bad", void:"", voided:"", canceled:"", cancelled:"", refunded:"info", partially_refunded:"info", trialing:"info", in_progress:"info", new:"info" };
  function label(s){ return String(s || "").replace(/_/g, " ").replace(/^./, function(c){ return c.toUpperCase(); }); }
  function pill(s){ return '<span class="pill ' + (TONE[s] || "") + '">' + esc(label(s)) + "</span>"; }
  function table(cols, rows, empty){
    if (!rows || !rows.length) return '<div class="empty">' + esc(empty || "Nothing here yet.") + "</div>";
    return '<div class="table-wrap"><table class="data"><thead><tr>' + cols.map(function(c){ return "<th>" + esc(c[0]) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function(r){ return "<tr>" + cols.map(function(c){ return "<td>" + c[1](r) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
  }
  function status(el, kind, msg){ el.className = "status " + kind; el.textContent = msg; el.hidden = false; }
  function safeUrl(u){ return /^https:\/\/(invoice\.stripe\.com|pay\.stripe\.com|dashboard\.stripe\.com|billing\.stripe\.com|[a-z0-9-]+\.supabase\.co)\//.test(u || "") ? u : ""; }
  async function call(fn, body){
    var s = await sb.auth.getSession(); var token = s.data.session && s.data.session.access_token;
    var r = await fetch(CFG.functionsUrl + "/" + fn, { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":"Bearer " + token, "apikey": CFG.supabaseAnonKey }, body: JSON.stringify(body || {}) });
    var j = await r.json().catch(function(){ return {}; }); if (!r.ok) throw new Error(j.error || "Something went wrong."); return j;
  }
  function tabs(nav, render){
    nav.addEventListener("click", function(e){ var b = e.target.closest("[data-tab]"); if(!b) return;
      nav.querySelectorAll("[data-tab]").forEach(function(x){ x.setAttribute("aria-current", x === b ? "true" : "false"); }); render(b.getAttribute("data-tab")); });
  }
  return { sb: sb, cfg: CFG, esc: esc, money: money, date: date, pill: pill, table: table, status: status, call: call, tabs: tabs, safeUrl: safeUrl, label: label };
})();
