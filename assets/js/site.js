/* Lisette Colon — shared site behaviour. No tracking. */
(function () {
  "use strict";
  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var CFG = window.LC_CONFIG || {};

  /* ---------- header shadow + mobile menu ---------- */
  var head = document.querySelector(".site-head");
  function onScroll() { if (head) head.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  var btn = document.querySelector(".menu-btn"), menu = document.getElementById("mobile-nav");
  function setMenu(open) {
    if (!btn || !menu) return;
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.querySelector("span").textContent = open ? "Close" : "Menu";
    document.documentElement.style.overflow = open ? "hidden" : "";
    if (open) { var first = menu.querySelector("a"); if (first) first.focus(); }
  }
  if (btn && menu) {
    btn.addEventListener("click", function () { setMenu(menu.hidden); });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) { setMenu(false); btn.focus(); } });
    window.addEventListener("resize", function () { if (window.innerWidth > 960 && !menu.hidden) setMenu(false); });
  }

  /* ---------- reveal on scroll (visible by default) ---------- */
  if (!reduce && "IntersectionObserver" in window) {
    var els = document.querySelectorAll("[data-reveal]");
    if (els.length) {
      document.documentElement.classList.add("js-reveal");
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight) el.classList.add("in"); else io.observe(el);
      });
      setTimeout(function () { els.forEach(function (el) { el.classList.add("in"); }); }, 4000); // safety: never leave content hidden
    }
  }

  /* ---------- copy buttons ---------- */
  document.querySelectorAll("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var t = b.getAttribute("data-copy"), done = function () { var o = b.textContent; b.textContent = "Copied"; setTimeout(function () { b.textContent = o; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () {});
    });
  });

  /* ---------- front & back stage ---------- */
  var DATA = {
    con: { biz: "Harbor Masonry (example)", form: ["Request an estimate", "Project", "Front steps and walkway", "Town", "Massapequa", "Photos", "3 attached"],
      card: ["Front steps and walkway", "Massapequa · 3 photos"], after: "Follow up Fri",
      cols: [["New", [["Paver patio", "Syosset", "Today"]]], ["Quote sent", [["Retaining wall", "Bethpage", "Follow up Thu"], ["Chimney repair", "Levittown", "Sent Mon"]]], ["Scheduled", [["Driveway apron", "Hicksville", "Oct 29"]]]],
      caption: "A homeowner asks for an estimate from their phone. It lands in your list with the photos, and you can see which quotes need a follow-up." },
    who: { biz: "Bay Supply Co. (example)", form: ["Place an order", "Item", "16 oz cups, 40 cases", "Deliver", "Tomorrow morning", "Account", "Corner Deli"],
      card: ["16 oz cups × 40", "Corner Deli · tomorrow"], after: "On packing list",
      cols: [["New", [["To-go bags × 10", "Main St Pizza", "Today"]]], ["Packing", [["Gloves L × 6", "Sal's Bakery", "Route 2"], ["Napkins × 20", "Shore Diner", "Route 1"]]], ["Out for delivery", [["Foil pans × 12", "Park Café", "Driver: J"]]]],
      caption: "A regular customer reorders online. The order joins tomorrow's packing list, and stock counts go down by what was ordered." },
    off: { biz: "Elm Street Tax Office (example)", form: ["Book an appointment", "Service", "Tax return review", "Time", "Tue 10:30 a.m.", "Checklist", "Sent by email"],
      card: ["Tax return review", "Tue 10:30 · checklist sent"], after: "Reminder set",
      cols: [["New", [["Payroll question", "Walk-in", "Today"]]], ["Waiting on items", [["Return prep", "2 of 5 items", "Reminder Fri"], ["Amendment", "1 of 3 items", "Reminder Mon"]]], ["Ready", [["Return review", "Signed", "Pick up"]]]],
      caption: "A client books a time online and gets a checklist of what to bring. Your staff can see who is still missing items." }
  };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function tk(c, cls) { return '<div class="tk' + (cls ? " " + cls : "") + '"><b>' + esc(c[0]) + "</b>" + esc(c[1]) + "<br><small>" + esc(c[2]) + "</small></div>"; }

  document.querySelectorAll("[data-stage]").forEach(function (stage) {
    var cols = stage.querySelector(".cols"), phone = stage.querySelector(".phone-screen"), biz = stage.querySelector(".biz"),
        root = stage.closest("[data-stage-root]") || document, cap = root.querySelector(".stage-caption"),
        cur = stage.getAttribute("data-stage") || "con", timers = [];
    function render(withNew) {
      var d = DATA[cur];
      biz.textContent = d.biz;
      var f = d.form;
      phone.innerHTML = '<div class="ph-title">' + esc(f[0]) + '</div><div class="ph-field">' + esc(f[1]) + "<span>" + esc(f[2]) + '</span></div><div class="ph-field">' + esc(f[3]) + "<span>" + esc(f[4]) + '</span></div><div class="ph-field">' + esc(f[5]) + "<span>" + esc(f[6]) + '</span></div><div class="ph-send">Send</div>';
      cols.innerHTML = d.cols.map(function (col, i) {
        var n = col[1].length + (i === 0 && withNew ? 1 : 0);
        var cards = col[1].map(function (c) { return tk(c); }).join("");
        if (i === 0 && withNew) cards = tk([d.card[0], d.card[1], d.after], "is-new") + cards;
        return '<div class="col"><h3><span>' + esc(col[0]) + "</span><span>" + n + "</span></h3>" + cards + "</div>";
      }).join("");
      if (cap) cap.textContent = d.caption;
    }
    function clear() { timers.forEach(clearTimeout); timers = []; var f = stage.querySelector(".flyer"); if (f) f.remove(); }
    function play() {
      clear(); render(false);
      if (reduce || !Element.prototype.animate) { render(true); return; }
      var d = DATA[cur];
      timers.push(setTimeout(function () {
        var send = phone.querySelector(".ph-send"), first = cols.querySelector(".col");
        if (!send || !first) { render(true); return; }
        var sr = stage.getBoundingClientRect(), a = send.getBoundingClientRect(), b = first.getBoundingClientRect();
        var fl = document.createElement("div"); fl.className = "flyer"; fl.setAttribute("aria-hidden", "true");
        fl.innerHTML = tk([d.card[0], d.card[1], "New"], "is-new");
        fl.style.width = Math.max(120, b.width - 16) + "px"; fl.style.left = (a.left - sr.left) + "px"; fl.style.top = (a.top - sr.top - 24) + "px";
        stage.appendChild(fl);
        var dx = (b.left + 8) - a.left, dy = (b.top + 30) - (a.top - 24);
        var an = fl.animate([
          { opacity: 0, transform: "translate(0,0) scale(.6)" },
          { opacity: 1, transform: "translate(0,-32px) scale(.92)", offset: 0.25 },
          { opacity: 1, transform: "translate(" + dx + "px," + dy + "px) scale(1)" }
        ], { duration: 1100, easing: "cubic-bezier(.3,.7,.2,1)", fill: "forwards" });
        an.onfinish = function () {
          fl.remove(); render(true);
          var s = cols.querySelector(".tk.is-new small");
          if (s) { s.textContent = "New"; timers.push(setTimeout(function () { s.textContent = d.after; }, 700)); }
        };
      }, 450));
    }
    render(false);
    root.querySelectorAll("[data-stage-pick]").forEach(function (b) {
      b.addEventListener("click", function () {
        root.querySelectorAll("[data-stage-pick]").forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
        cur = b.getAttribute("data-stage-pick"); play();
      });
    });
    var replay = root.querySelector("[data-stage-replay]");
    if (replay) replay.addEventListener("click", play);
    if ("IntersectionObserver" in window) {
      var seen = false, o = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !seen) { seen = true; play(); o.disconnect(); } }); }, { threshold: 0.4 });
      o.observe(stage);
    } else play();
    window.addEventListener("resize", function () { if (stage.querySelector(".flyer")) { clear(); render(true); } });
  });

  /* ---------- forms: inquiry / booking request ---------- */
  function setErr(input, msg) {
    var box = input.closest(".field"), e = box && box.querySelector(".err");
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (e) { e.textContent = msg || ""; e.hidden = !msg; }
  }
  function validate(form) {
    var ok = true, firstBad = null;
    form.querySelectorAll("[required]").forEach(function (el) {
      if (el.type === "radio") return;
      var v = (el.value || "").trim(), msg = "";
      if (!v) msg = "Please fill this in.";
      else if (el.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = "Please enter an email address like name@business.com.";
      else if (el.type === "tel" && v.replace(/\D/g, "").length < 10) msg = "Please enter a 10-digit phone number.";
      setErr(el, msg); if (msg) { ok = false; if (!firstBad) firstBad = el; }
    });
    var groups = {};
    form.querySelectorAll("input[type=radio][required]").forEach(function (r) { groups[r.name] = groups[r.name] || form.querySelector("input[name='" + r.name + "']:checked"); });
    Object.keys(groups).forEach(function (n) {
      var fs = form.querySelector("input[name='" + n + "']").closest("fieldset"), e = fs && fs.querySelector(".err");
      if (!groups[n]) { ok = false; if (e) { e.textContent = "Please choose one."; e.hidden = false; } if (!firstBad) firstBad = form.querySelector("input[name='" + n + "']"); }
      else if (e) { e.hidden = true; }
    });
    if (firstBad) firstBad.focus();
    return ok;
  }
  document.querySelectorAll("form[data-endpoint]").forEach(function (form) {
    var status = form.querySelector(".status"), submit = form.querySelector("[type=submit]"), label = submit ? submit.textContent : "";
    form.addEventListener("input", function (e) { if (e.target.getAttribute("aria-invalid") === "true") setErr(e.target, ""); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate(form)) { show("bad", "Please check the highlighted fields."); return; }
      if (form.querySelector(".hp input") && form.querySelector(".hp input").value) { show("ok", "Thanks, your message was received."); form.reset(); return; }
      var data = {}; new FormData(form).forEach(function (v, k) { if (k !== "company_site") data[k] = typeof v === "string" ? v.trim() : v; });
      data.kind = form.getAttribute("data-kind") || "inquiry";
      data.page = location.pathname;
      submit.disabled = true; submit.textContent = "Sending…";
      if (!CFG.functionsUrl) {
        setTimeout(function () {
          submit.disabled = false; submit.textContent = label;
          show("info", "Preview mode: this form is not connected yet, so nothing was sent. To reach Lisette now, email hi@lisettecolon.com or call (917) 960-4871.");
        }, 700);
        return;
      }
      fetch(CFG.functionsUrl + "/" + form.getAttribute("data-endpoint"), {
        method: "POST", headers: { "Content-Type": "application/json", "apikey": CFG.supabaseAnonKey || "" }, body: JSON.stringify(data)
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          submit.disabled = false; submit.textContent = label;
          if (res.ok) { form.reset(); show("ok", form.getAttribute("data-success") || "Thanks. Your message reached Lisette, and you'll hear back within one business day."); }
          else show("bad", (res.j && res.j.error) || "That didn't go through. Please try again, or email hi@lisettecolon.com.");
        }).catch(function () {
          submit.disabled = false; submit.textContent = label;
          show("bad", "That didn't go through because the connection dropped. Please try again, or email hi@lisettecolon.com.");
        });
    });
    function show(kind, msg) { if (!status) return; status.className = "status " + kind; status.textContent = msg; status.hidden = false; }
  });

  /* ---------- prefill from ?service= (book page) ---------- */
  try {
    var q = new URLSearchParams(location.search), svc = q.get("service"), sel = document.getElementById("need");
    if (svc && sel) { Array.prototype.forEach.call(sel.options, function (o) { if (o.value === svc) sel.value = svc; }); }
  } catch (e) {}

  var y = document.querySelector("[data-year]"); if (y) y.textContent = new Date().getFullYear();
})();
