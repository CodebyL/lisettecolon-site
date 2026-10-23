/* Signature effects for concepts B and C. Content is readable without this script. */
(function () {
  "use strict";
  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  /* B: the pile of notes sorts itself into one list */
  document.querySelectorAll("[data-pile]").forEach(function (pile) {
    var btn = pile.querySelector("[data-pile-toggle]");
    function set(done) {
      pile.classList.toggle("done", done);
      if (btn) { btn.textContent = done ? "Show the pile" : "Sort it"; btn.setAttribute("aria-pressed", done ? "true" : "false"); }
    }
    if (btn) btn.addEventListener("click", function () { set(!pile.classList.contains("done")); });
    if (reduce) { set(true); return; }
    if ("IntersectionObserver" in window) {
      var o = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { setTimeout(function () { set(true); }, 900); o.disconnect(); } });
      }, { threshold: 0.45 });
      o.observe(pile);
    } else set(true);
  });

  /* C: the work rail drifts sideways as the page scrolls (wide screens only; phones swipe) */
  document.querySelectorAll("[data-rail]").forEach(function (rail) {
    var root = rail.closest("[data-rail-root]") || rail.parentElement, clip = rail.parentElement, ticking = false, held = false;
    function max() {
      var last = rail.lastElementChild; if (!last) return 0;
      var pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
      return Math.max(0, last.offsetLeft + last.offsetWidth + pad - clip.clientWidth);
    }
    function active() { return !reduce && window.innerWidth >= 960; }
    function drift() {
      ticking = false;
      clip.classList.toggle("native", !active());
      if (!active()) { rail.style.transform = ""; return; }
      if (held) return;
      var r = root.getBoundingClientRect(), vh = window.innerHeight || 800;
      var p = Math.min(1, Math.max(0, (vh * 0.9 - r.top) / (vh * 0.6)));
      rail.style.transform = "translate3d(" + (-p * max()) + "px,0,0)";
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(drift); } }, { passive: true });
    window.addEventListener("resize", drift);
    // keyboard users: bring a focused card fully into view
    rail.addEventListener("focusin", function (e) {
      if (!active()) return;
      var c = e.target.closest("a"); if (!c) return;
      held = true;
      var x = -Math.min(max(), Math.max(0, c.offsetLeft + c.offsetWidth - clip.clientWidth + 24));
      rail.style.transform = "translate3d(" + x + "px,0,0)";
    });
    rail.addEventListener("focusout", function () { held = false; drift(); });
    drift();
  });
})();
