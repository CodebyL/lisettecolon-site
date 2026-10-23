(function(){
  "use strict";
  var A = window.LCApp, sb = A.sb, esc = A.esc, $ = function(id){ return document.getElementById(id); };
  var views = { signin: $("signin-view"), setpass: $("setpass-view"), app: $("app-view") };
  function show(v){ Object.keys(views).forEach(function(k){ views[k].hidden = k !== v; }); }
  var siForm = $("signin-form"), siStatus = siForm.querySelector(".status");

  if (!sb) { $("cfg-note").hidden = false; siForm.addEventListener("submit", function(e){ e.preventDefault(); A.status(siStatus, "info", "Preview mode: sign-in isn't connected yet."); });
    $("si-link").addEventListener("click", function(){ A.status(siStatus, "info", "Preview mode: sign-in isn't connected yet."); });
    $("si-forgot").addEventListener("click", function(){ A.status(siStatus, "info", "Preview mode: sign-in isn't connected yet."); }); return; }

  function emailOk(){ var el = $("si-email"), v = el.value.trim(), ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); el.setAttribute("aria-invalid", ok ? "false" : "true");
    var er = el.parentNode.querySelector(".err"); er.hidden = ok; er.textContent = ok ? "" : "Please enter the email you use with Lisette."; return ok ? v : null; }
  var back = location.origin + location.pathname;
  siForm.addEventListener("submit", async function(e){ e.preventDefault(); var em = emailOk(); if(!em) return; var pw = $("si-pass").value;
    if (!pw) { return sendLink(em); }
    var r = await sb.auth.signInWithPassword({ email: em, password: pw });
    if (r.error) A.status(siStatus, "bad", "That email and password don't match. Try again, or use an email link."); });
  async function sendLink(em){ var r = await sb.auth.signInWithOtp({ email: em, options: { shouldCreateUser: false, emailRedirectTo: back } });
    A.status(siStatus, r.error ? "bad" : "ok", r.error ? "We couldn't send a link. If you're a client, check the email address or contact Lisette." : "Check your email for a sign-in link. It works once and expires in an hour."); }
  $("si-link").addEventListener("click", function(){ var em = emailOk(); if(em) sendLink(em); });
  $("si-forgot").addEventListener("click", async function(){ var em = emailOk(); if(!em) return;
    await sb.auth.resetPasswordForEmail(em, { redirectTo: back + "#set-password" });
    A.status(siStatus, "ok", "If that email has an account, a reset link is on its way."); });

  $("setpass-form").addEventListener("submit", async function(e){ e.preventDefault(); var el = $("sp-pass"), st = this.querySelector(".status");
    if (el.value.length < 10) { A.status(st, "bad", "Please use at least 10 characters."); return; }
    var r = await sb.auth.updateUser({ password: el.value });
    if (r.error) A.status(st, "bad", "Couldn't save the password. Please request a new link."); else { history.replaceState(null, "", location.pathname); boot(); } });

  $("signout").addEventListener("click", async function(){ await sb.auth.signOut(); show("signin"); });

  var state = { clients: [], client: null };
  async function boot(){
    var s = (await sb.auth.getSession()).data.session;
    if (!s) { show("signin"); return; }
    if (location.hash === "#set-password") { show("setpass"); return; }
    show("app"); $("who").textContent = "Signed in as " + s.user.email;
    var r = await sb.from("clients").select("id,business_name,billing_email,phone,address,website").order("business_name");
    state.clients = r.data || [];
    if (!state.clients.length) { $("panels").innerHTML = '<div class="panel"><h2 class="h4">Your account isn\'t linked to a business yet</h2><p class="body">Lisette will link it shortly. Questions: hi@lisettecolon.com.</p></div>'; return; }
    var pick = $("client-pick");
    if (state.clients.length > 1) { pick.hidden = false; pick.innerHTML = state.clients.map(function(c){ return '<option value="' + esc(c.id) + '">' + esc(c.business_name) + "</option>"; }).join("");
      pick.onchange = function(){ select(pick.value); }; }
    select(state.clients[0].id);
  }
  function select(id){ state.client = state.clients.filter(function(c){ return c.id === id; })[0]; $("biz-name").textContent = state.client.business_name; render(current()); }
  function current(){ var b = document.querySelector(".app-nav [aria-current=true]"); return b ? b.getAttribute("data-tab") : "overview"; }
  A.tabs(document.querySelector(".app-nav"), render);

  async function q(table, order){ var r = await sb.from(table).select("*").eq("client_id", state.client.id).order(order || "created_at", { ascending: false }); return r.data || []; }

  async function render(tab){
    var P = $("panels"); P.innerHTML = '<div class="panel"><p class="muted">Loading…</p></div>';
    var c = state.client;
    if (tab === "overview") {
      var inv = await q("invoices", "stripe_created"), pr = await q("projects"), subs = await q("subscriptions", "updated_at");
      var owed = inv.filter(function(i){ return i.status === "open"; }).reduce(function(a, i){ return a + i.amount_remaining_cents; }, 0);
      P.innerHTML = '<div class="panel"><div class="kv"><div><span class="label">Open balance</span><b>' + A.money(owed) + '</b></div><div><span class="label">Active projects</span><b>' + pr.filter(function(p){ return p.status !== "closed"; }).length + '</b></div><div><span class="label">Active plans</span><b>' + subs.filter(function(s){ return ["active","trialing","past_due"].indexOf(s.status) > -1; }).length + "</b></div></div>" +
        (owed ? '<p class="body">You have an open invoice. Pay it from <button class="link" type="button" data-go="billing" style="background:none;border:0;padding:0;cursor:pointer">Invoices and payments</button>.</p>' : '<p class="body">Nothing is due right now.</p>') + "</div>";
      P.querySelectorAll("[data-go]").forEach(function(b){ b.onclick = function(){ document.querySelector('[data-tab="' + b.getAttribute("data-go") + '"]').click(); }; });
    }
    if (tab === "projects") {
      var rows = await q("projects");
      P.innerHTML = '<div class="panel"><h2 class="h4">Projects</h2>' + A.table([["Project", function(r){ return "<b>" + esc(r.title) + "</b><br><span class=\"small muted\">" + esc(r.service) + "</span>"; }], ["Status", function(r){ return A.pill(r.status); }], ["Target date", function(r){ return esc(A.date(r.target_date)); }], ["Note", function(r){ return esc(r.client_note); }]], rows, "No projects yet.") + "</div>";
    }
    if (tab === "documents") {
      var docs = await q("documents");
      P.innerHTML = '<div class="panel"><h2 class="h4">Proposals and agreements</h2>' + A.table([["Document", function(r){ return esc(r.title); }], ["Type", function(r){ return esc(A.label(r.kind)); }], ["Status", function(r){ return A.pill(r.status); }], ["", function(r){ return '<button class="btn ghost sm" type="button" data-doc="' + esc(r.storage_path) + '">Open</button>'; }]], docs, "No documents yet.") + "</div>";
      P.querySelectorAll("[data-doc]").forEach(function(b){ b.onclick = async function(){ var r = await sb.storage.from("client-docs").createSignedUrl(b.getAttribute("data-doc"), 120); if (r.data) window.open(r.data.signedUrl, "_blank", "noopener"); }; });
    }
    if (tab === "billing") {
      var invs = await q("invoices", "stripe_created"), pays = await q("payments");
      P.innerHTML = '<div class="panel"><div class="head-row"><h2 class="h4">Invoices</h2><button class="btn ghost sm" type="button" id="portal">Update card or bank account</button></div>' +
        A.table([["Invoice", function(r){ return esc(r.number || "Draft") + '<br><span class="small muted">' + esc(r.description) + "</span>"; }], ["Type", function(r){ return esc(A.label(r.kind)); }], ["Amount", function(r){ return '<span class="num">' + A.money(r.amount_due_cents) + "</span>"; }], ["Still due", function(r){ return '<span class="num">' + A.money(r.amount_remaining_cents) + "</span>"; }], ["Status", function(r){ return A.pill(r.status); }],
          ["", function(r){ var u = A.safeUrl(r.hosted_invoice_url); return u ? '<a class="btn sm' + (r.status === "open" ? "" : " ghost") + '" href="' + esc(u) + '" target="_blank" rel="noopener">' + (r.status === "open" ? "Pay" : "View") + "</a>" : ""; }]], invs, "No invoices yet.") +
        '<p class="status" id="portal-st" hidden></p></div><div class="panel"><h2 class="h4">Payments received</h2>' +
        A.table([["Date", function(r){ return esc(A.date(r.received_at || r.created_at)); }], ["Description", function(r){ return esc(r.description || ""); }], ["Method", function(r){ return esc(A.label(r.source === "stripe" ? "card or bank" : r.source)); }], ["Amount", function(r){ return '<span class="num">' + A.money(r.amount_cents) + (r.refunded_cents ? '<br><span class="small muted">' + A.money(r.refunded_cents) + " refunded</span>" : "") + "</span>"; }], ["Status", function(r){ return A.pill(r.status); }], ["", function(r){ var u = A.safeUrl(r.receipt_url) || (r.receipt_url && /^https:\/\/pay\.stripe\.com\//.test(r.receipt_url) ? r.receipt_url : ""); return u ? '<a class="link small" href="' + esc(u) + '" target="_blank" rel="noopener">Receipt</a>' : ""; }]], pays, "No payments yet.") +
        '<p class="note">A deposit counts toward your project total; the balance shows as its own invoice. Bank payments show as pending until they clear.</p></div>';
      $("portal").onclick = async function(){ var st = $("portal-st"); try { var j = await A.call("customer-portal", { client_id: c.id }); if (/^https:\/\/billing\.stripe\.com\//.test(j.url)) location.href = j.url; } catch(err){ A.status(st, "bad", err.message); } };
    }
    if (tab === "plans") {
      var ss = await q("subscriptions", "updated_at");
      P.innerHTML = '<div class="panel"><h2 class="h4">Plans</h2>' + A.table([["Plan", function(r){ return esc(A.label(r.plan_key)) + '<br><span class="small muted">' + esc(r.kind === "website_installments" ? "Website payment plan" : A.label(r.kind) + " plan") + "</span>"; }], ["Amount", function(r){ return '<span class="num">' + A.money(r.amount_cents) + (r.billing_interval ? " / " + esc(r.billing_interval) : "") + "</span>"; }], ["Status", function(r){ return A.pill(r.status); }], ["Next charge", function(r){ return r.cancel_at_period_end || (r.cancel_at && new Date(r.cancel_at) <= new Date(r.current_period_end)) ? "Ends " + esc(A.date(r.cancel_at || r.current_period_end)) : esc(A.date(r.current_period_end)); }]], ss, "No plans yet.") +
        '<p class="note">To change or cancel a plan, send a support request; plans need 30 days\' notice.</p></div>';
    }
    if (tab === "bookings") {
      var bk = await q("bookings", "starts_at");
      P.innerHTML = '<div class="panel"><div class="head-row"><h2 class="h4">Meetings</h2><a class="btn ghost sm" href="../book.html">Book another meeting</a></div>' + A.table([["When", function(r){ return esc(A.date(r.starts_at, true)); }], ["Format", function(r){ return esc(A.label(r.format)); }], ["Where", function(r){ return esc(r.location || ""); }], ["Status", function(r){ return A.pill(r.status); }]], bk, "No meetings on record.") + "<p class=\"note\">Your confirmation email has links to reschedule or cancel.</p></div>";
    }
    if (tab === "support") {
      var sr = await q("support_requests");
      P.innerHTML = '<form class="panel form" id="sup-form" novalidate><h2 class="h4">Ask for a change or help</h2><div class="field"><label for="sup-s">Subject</label><input class="input" id="sup-s" maxlength="200" required></div><div class="field"><label for="sup-b">What do you need?</label><textarea class="textarea" id="sup-b" maxlength="5000" required></textarea><span class="hint">Please don\'t include passwords or card numbers.</span></div><button class="btn" type="submit">Send request</button><p class="status" role="status" hidden></p></form>' +
        '<div class="panel"><h2 class="h4">Your requests</h2>' + A.table([["Sent", function(r){ return esc(A.date(r.created_at)); }], ["Subject", function(r){ return esc(r.subject); }], ["Status", function(r){ return A.pill(r.status); }]], sr, "No requests yet.") + "</div>";
      $("sup-form").onsubmit = async function(e){ e.preventDefault(); var st = this.querySelector(".status"), s = $("sup-s").value.trim(), b = $("sup-b").value.trim();
        if (!s || !b) { A.status(st, "bad", "Please add a subject and a message."); return; }
        var u = (await sb.auth.getUser()).data.user;
        var r = await sb.from("support_requests").insert({ client_id: c.id, user_id: u.id, subject: s, body: b });
        if (r.error) A.status(st, "bad", "Couldn't send. Please email hi@lisettecolon.com."); else render("support"); };
    }
    if (tab === "profile") {
      P.innerHTML = '<form class="panel form" id="pf" novalidate><h2 class="h4">Contact details for ' + esc(c.business_name) + '</h2><div class="grid-2"><div class="field"><label for="pf-e">Billing email</label><input class="input" id="pf-e" type="email" value="' + esc(c.billing_email) + '"></div><div class="field"><label for="pf-p">Phone</label><input class="input" id="pf-p" type="tel" value="' + esc(c.phone) + '"></div></div><div class="field"><label for="pf-a">Address</label><input class="input" id="pf-a" value="' + esc(c.address) + '"></div><div class="field"><label for="pf-w">Website</label><input class="input" id="pf-w" value="' + esc(c.website) + '"></div><button class="btn" type="submit">Save</button><p class="status" role="status" hidden></p><p class="note">Card and bank details are changed on Stripe\'s secure page under Invoices and payments.</p></form>';
      $("pf").onsubmit = async function(e){ e.preventDefault(); var st = this.querySelector(".status");
        var r = await sb.rpc("update_my_contact", { cid: c.id, p_phone: $("pf-p").value.trim(), p_address: $("pf-a").value.trim(), p_website: $("pf-w").value.trim(), p_billing_email: $("pf-e").value.trim() });
        if (r.error) A.status(st, "bad", "Couldn't save. Please try again."); else { A.status(st, "ok", "Saved."); Object.assign(c, { phone: $("pf-p").value.trim(), address: $("pf-a").value.trim(), website: $("pf-w").value.trim(), billing_email: $("pf-e").value.trim() }); } };
    }
  }
  sb.auth.onAuthStateChange(function(ev){ if (ev === "PASSWORD_RECOVERY") { show("setpass"); return; } if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") boot(); });
  boot();
})();
