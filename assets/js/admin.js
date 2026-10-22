(function(){
  "use strict";
  var A = window.LCApp, sb = A.sb, esc = A.esc, $ = function(id){ return document.getElementById(id); };
  if (!sb) { $("gate-msg").textContent = "Preview mode: the admin isn't connected yet."; return; }
  var clients = [];
  async function boot(){
    var s = (await sb.auth.getSession()).data.session;
    if (!s) return;
    var me = await sb.from("profiles").select("is_admin").eq("id", s.user.id).maybeSingle();
    if (!me.data || !me.data.is_admin) { $("gate-msg").textContent = "This account isn't an admin."; return; }
    $("gate").hidden = true; $("admin").hidden = false; render("inquiries");
  }
  $("signout").onclick = async function(){ await sb.auth.signOut(); location.href = "../account/index.html"; };
  A.tabs(document.querySelector(".app-nav"), render);
  async function loadClients(){ var r = await sb.from("clients").select("id,business_name,billing_email,stripe_customer_id,created_at").order("business_name"); clients = r.data || []; return clients; }
  function clientName(id){ var c = clients.filter(function(x){ return x.id === id; })[0]; return c ? c.business_name : ""; }
  function clientOptions(sel){ return '<option value="">Choose a client</option>' + clients.map(function(c){ return '<option value="' + esc(c.id) + '"' + (c.id === sel ? " selected" : "") + ">" + esc(c.business_name) + "</option>"; }).join(""); }
  function statusSelect(table, id, cur, opts){ return '<label class="sr" for="s-' + esc(id) + '">Status</label><select class="select" style="min-height:36px;padding:4px 8px;width:auto" id="s-' + esc(id) + '" data-upd="' + table + '" data-id="' + esc(id) + '">' + opts.map(function(o){ return '<option' + (o === cur ? " selected" : "") + ' value="' + o + '">' + esc(A.label(o)) + "</option>"; }).join("") + "</select>"; }
  function wireStatus(P, tab){ P.querySelectorAll("[data-upd]").forEach(function(sel){ sel.onchange = async function(){ var r = await sb.from(sel.getAttribute("data-upd")).update({ status: sel.value }).eq("id", sel.getAttribute("data-id")); if (r.error) { sel.setAttribute("aria-invalid","true"); sel.title = "Couldn't save this change"; } }; }); }

  async function render(tab){
    var P = $("panels"); P.innerHTML = '<div class="panel"><p class="muted">Loading…</p></div>'; await loadClients();
    if (tab === "inquiries") {
      var r = await sb.from("inquiries").select("*").neq("status", "spam").order("created_at", { ascending: false }).limit(200);
      P.innerHTML = '<div class="panel"><h2 class="h4">Inquiries and consultation requests</h2>' + A.table([
        ["Received", function(x){ return esc(A.date(x.created_at, true)); }],
        ["From", function(x){ return "<b>" + esc(x.name) + "</b><br>" + esc(x.business) + '<br><span class="small">' + esc(x.email) + " " + esc(x.phone) + "</span>"; }],
        ["Request", function(x){ return '<span class="pill info">' + esc(A.label(x.kind)) + "</span> " + esc(A.label(x.format || x.service || "")) + '<br><span class="small">' + esc(x.availability) + '</span><br><span class="small muted">' + esc(x.message) + "</span>"; }],
        ["Status", function(x){ return statusSelect("inquiries", x.id, x.status, ["new","contacted","booked","closed","spam"]); }]], r.data, "No inquiries yet.") + "</div>";
      wireStatus(P);
    }
    if (tab === "clients") {
      P.innerHTML = '<form class="panel form" id="inv" novalidate><h2 class="h4">Invite a client to their account</h2><p class="note">Use this after they sign a proposal or pay online. They get an email to choose a password.</p><div class="grid-2"><div class="field"><label for="i-c">Existing client</label><select class="select" id="i-c">' + clientOptions() + '</select></div><div class="field"><label for="i-b">Or new business name</label><input class="input" id="i-b"></div><div class="field"><label for="i-n">Person\'s name</label><input class="input" id="i-n"></div><div class="field"><label for="i-e">Their email</label><input class="input" id="i-e" type="email"></div></div><button class="btn" type="submit">Send invitation</button><p class="status" hidden></p></form>' +
        '<div class="panel"><h2 class="h4">Clients</h2>' + A.table([["Business", function(c){ return esc(c.business_name); }], ["Billing email", function(c){ return esc(c.billing_email); }], ["Stripe", function(c){ return c.stripe_customer_id ? '<a class="link small" target="_blank" rel="noopener" href="https://dashboard.stripe.com/test/customers/' + esc(c.stripe_customer_id) + '">Customer</a>' : '<span class="muted small">Not linked</span>'; }], ["Since", function(c){ return esc(A.date(c.created_at)); }]], clients, "No clients yet.") + "</div>";
      $("inv").onsubmit = async function(e){ e.preventDefault(); var st = this.querySelector(".status");
        try { await A.call("admin-invite", { client_id: $("i-c").value, business_name: $("i-b").value.trim(), full_name: $("i-n").value.trim(), email: $("i-e").value.trim() }); A.status(st, "ok", "Invitation sent."); }
        catch(err){ A.status(st, "bad", err.message); } };
    }
    if (tab === "projects") {
      var pr = await sb.from("projects").select("*").order("updated_at", { ascending: false });
      P.innerHTML = '<form class="panel form" id="np" novalidate><h2 class="h4">New project</h2><div class="grid-2"><div class="field"><label for="p-c">Client</label><select class="select" id="p-c" required>' + clientOptions() + '</select></div><div class="field"><label for="p-t">Title</label><input class="input" id="p-t" required placeholder="Standard website"></div><div class="field"><label for="p-s">Service</label><input class="input" id="p-s" required placeholder="Website"></div><div class="field"><label for="p-a">Total price ($)</label><input class="input" id="p-a" inputmode="decimal"></div><div class="field"><label for="p-d">Target date</label><input class="input" id="p-d" type="date"></div><div class="field"><label for="p-n">Note the client can see</label><input class="input" id="p-n"></div></div><button class="btn" type="submit">Add project</button><p class="status" hidden></p></form>' +
        '<div class="panel"><h2 class="h4">Projects</h2>' + A.table([["Client", function(p){ return esc(clientName(p.client_id)); }], ["Project", function(p){ return esc(p.title); }], ["Total", function(p){ return A.money(p.total_cents); }], ["Status", function(p){ return statusSelect("projects", p.id, p.status, ["proposal","waiting_on_deposit","kickoff","waiting_on_content","in_progress","in_review","launching","live","on_hold","closed"]); }]], pr.data, "No projects yet.") + "</div>";
      wireStatus(P);
      $("np").onsubmit = async function(e){ e.preventDefault(); var st = this.querySelector(".status"); var amt = parseFloat($("p-a").value);
        var r = await sb.from("projects").insert({ client_id: $("p-c").value, title: $("p-t").value.trim(), service: $("p-s").value.trim(), total_cents: isNaN(amt) ? null : Math.round(amt * 100), target_date: $("p-d").value || null, client_note: $("p-n").value.trim() || null });
        if (r.error) A.status(st, "bad", "Couldn't add the project. Check the client, title and service."); else render("projects"); };
    }
    if (tab === "money") {
      var inv = await sb.from("invoices").select("*").order("stripe_created", { ascending: false }).limit(200);
      var pay = await sb.from("payments").select("*").order("created_at", { ascending: false }).limit(200);
      P.innerHTML = '<form class="panel form" id="op" novalidate><h2 class="h4">Record a Zelle, cash or check payment</h2><p class="note">Card and bank payments are recorded automatically from Stripe. Mistakes are corrected by setting the payment to Voided; nothing is deleted, and every change is kept in the history.</p><div class="grid-2"><div class="field"><label for="o-c">Client</label><select class="select" id="o-c" required>' + clientOptions() + '</select></div><div class="field"><label for="o-m">Method</label><select class="select" id="o-m"><option value="zelle">Zelle</option><option value="cash">Cash</option><option value="check">Check</option></select></div><div class="field"><label for="o-a">Amount ($)</label><input class="input" id="o-a" inputmode="decimal" required></div><div class="field"><label for="o-d">Date received</label><input class="input" id="o-d" type="date" required></div></div><div class="field"><label for="o-n">What it was for</label><input class="input" id="o-n" required placeholder="Standard website deposit"></div><button class="btn" type="submit">Record payment</button><p class="status" hidden></p></form>' +
        '<div class="panel"><h2 class="h4">Invoices</h2>' + A.table([["Client", function(i){ return esc(clientName(i.client_id)); }], ["Invoice", function(i){ return esc(i.number || "Draft") + '<br><span class="small muted">' + esc(i.description) + "</span>"; }], ["Type", function(i){ return esc(A.label(i.kind)); }], ["Due", function(i){ return A.money(i.amount_due_cents); }], ["Remaining", function(i){ return A.money(i.amount_remaining_cents); }], ["Status", function(i){ return A.pill(i.status); }]], inv.data, "No invoices yet. Create invoices in Stripe; they appear here automatically.") + "</div>" +
        '<div class="panel"><h2 class="h4">Payments</h2>' + A.table([["Date", function(p){ return esc(A.date(p.received_at || p.created_at)); }], ["Client", function(p){ return esc(clientName(p.client_id)); }], ["For", function(p){ return esc(p.description || p.note || ""); }], ["Method", function(p){ return esc(A.label(p.source)); }], ["Amount", function(p){ return A.money(p.amount_cents) + (p.refunded_cents ? '<br><span class="small muted">' + A.money(p.refunded_cents) + " refunded</span>" : ""); }], ["Status", function(p){ return p.source === "stripe" ? A.pill(p.status) : statusSelect("payments", p.id, p.status, ["succeeded","voided"]); }]], pay.data, "No payments yet.") + "</div>";
      wireStatus(P);
      $("op").onsubmit = async function(e){ e.preventDefault(); var st = this.querySelector(".status"), amt = parseFloat($("o-a").value);
        if (!$("o-c").value || isNaN(amt) || amt <= 0 || !$("o-d").value || !$("o-n").value.trim()) { A.status(st, "bad", "Fill in the client, amount, date and what it was for."); return; }
        var u = (await sb.auth.getUser()).data.user;
        var r = await sb.from("payments").insert({ client_id: $("o-c").value, source: $("o-m").value, amount_cents: Math.round(amt * 100), status: "succeeded", received_at: new Date($("o-d").value + "T12:00:00").toISOString(), description: $("o-n").value.trim(), recorded_by: u.id });
        if (r.error) A.status(st, "bad", "Couldn't record it."); else render("money"); };
    }
    if (tab === "plans") {
      var s = await sb.from("subscriptions").select("*").order("updated_at", { ascending: false });
      P.innerHTML = '<div class="panel"><h2 class="h4">Plans and payment plans</h2>' + A.table([["Client", function(x){ return esc(clientName(x.client_id)); }], ["Plan", function(x){ return esc(A.label(x.plan_key)) + '<br><span class="small muted">' + esc(A.label(x.kind)) + "</span>"; }], ["Amount", function(x){ return A.money(x.amount_cents) + " / " + esc(x.billing_interval || ""); }], ["Status", function(x){ return A.pill(x.status); }], ["Renews or ends", function(x){ return esc(A.date(x.cancel_at || x.current_period_end)); }], ["", function(x){ return '<a class="link small" target="_blank" rel="noopener" href="https://dashboard.stripe.com/test/subscriptions/' + esc(x.stripe_subscription_id) + '">Manage in Stripe</a>'; }]], s.data, "No plans yet.") + "</div>";
    }
    if (tab === "orders") {
      var o = await sb.from("checkout_orders").select("*").order("created_at", { ascending: false }).limit(200);
      P.innerHTML = '<div class="panel"><h2 class="h4">Online orders</h2><p class="note">"Open" means the customer started checkout but hasn\'t finished. "Pending" means a bank payment is clearing.</p>' + A.table([["Started", function(x){ return esc(A.date(x.created_at, true)); }], ["Business", function(x){ return esc(x.business) + '<br><span class="small">' + esc(x.email) + "</span>"; }], ["Item", function(x){ return esc(A.label(x.item)) + " · " + esc(A.label(x.option)); }], ["Due now", function(x){ return A.money(x.amount_due_now_cents); }], ["Status", function(x){ return A.pill(x.status); }]], o.data, "No online orders yet.") + "</div>";
    }
    if (tab === "bookings") {
      var b = await sb.from("bookings").select("*").order("starts_at", { ascending: false });
      P.innerHTML = '<form class="panel form" id="nb" novalidate><h2 class="h4">Add a meeting to a client\'s record</h2><p class="note">Your Google Calendar is the master copy of meeting times. Add meetings here when you want a client to see them in their account.</p><div class="grid-2"><div class="field"><label for="b-c">Client</label><select class="select" id="b-c">' + clientOptions() + '</select></div><div class="field"><label for="b-t">Date and time</label><input class="input" id="b-t" type="datetime-local" required></div><div class="field"><label for="b-f">Format</label><select class="select" id="b-f"><option value="in_person">In person</option><option value="video">Video</option><option value="phone">Phone</option></select></div><div class="field"><label for="b-l">Location or link</label><input class="input" id="b-l"></div></div><button class="btn" type="submit">Add meeting</button><p class="status" hidden></p></form>' +
        '<div class="panel"><h2 class="h4">Meetings</h2>' + A.table([["When", function(x){ return esc(A.date(x.starts_at, true)); }], ["Client", function(x){ return esc(clientName(x.client_id)); }], ["Format", function(x){ return esc(A.label(x.format)); }], ["Status", function(x){ return statusSelect("bookings", x.id, x.status, ["requested","confirmed","rescheduled","cancelled","completed","no_show"]); }]], b.data, "No meetings recorded.") + "</div>";
      wireStatus(P);
      $("nb").onsubmit = async function(e){ e.preventDefault(); var st = this.querySelector(".status"); if (!$("b-t").value) { A.status(st, "bad", "Choose a date and time."); return; }
        var r = await sb.from("bookings").insert({ client_id: $("b-c").value || null, starts_at: new Date($("b-t").value).toISOString(), format: $("b-f").value, location: $("b-l").value.trim() || null, status: "confirmed" });
        if (r.error) A.status(st, "bad", "Couldn't add it."); else render("bookings"); };
    }
    if (tab === "support") {
      var sr = await sb.from("support_requests").select("*").order("created_at", { ascending: false });
      P.innerHTML = '<div class="panel"><h2 class="h4">Support requests</h2>' + A.table([["Sent", function(x){ return esc(A.date(x.created_at, true)); }], ["Client", function(x){ return esc(clientName(x.client_id)); }], ["Request", function(x){ return "<b>" + esc(x.subject) + '</b><br><span class="small">' + esc(x.body) + "</span>"; }], ["Status", function(x){ return statusSelect("support_requests", x.id, x.status, ["open","in_progress","done"]); }]], sr.data, "No support requests.") + "</div>";
      wireStatus(P);
    }
  }
  sb.auth.onAuthStateChange(function(ev){ if (ev === "SIGNED_OUT") location.href = "../account/index.html"; });
  boot();
})();
