#!/usr/bin/env python3
"""Assemble pages from src/ with the shared header and footer.
Each src file starts with: <!--meta title=...|desc=...|nav=...|noindex=0-->"""
import os, re, pathlib, hashlib, shutil
ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
OUT = ROOT
def ver(rel):
    return hashlib.sha256((OUT/rel).read_bytes()).hexdigest()[:8]
PRE = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
THEMES = {
  # name: (output folder, theme stylesheet added on top of site.css, Google Fonts query, theme colour, page overrides folder)
  "a": (ROOT, None, "DM+Mono:wght@400;500&family=Figtree:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400..600", "#faf7f5", None),
}
FONTS = ""
THEME_COLOR = "#faf7f5"
LAUNCH = os.environ.get("LAUNCH") == "1"
# What is switched on in the launch build. Turn each on once it is connected and tested.
FEATURES = {"accounts": False, "payments": False}
PRIVATE = {"account/index.html", "admin/index.html", "checkout.html", "thanks.html", "pay.html", "404.html"}
SERVICE_FOR = {"website-starter":"website","website-standard":"website","website-premium":"website","care-hosting":"care","care-care":"care","care-plus":"care",
  "logo":"website","update-hour":"care","photo-session":"photo","drone":"photo","gbp":"marketing","local-search":"marketing","local-visibility":"marketing"}
def launch_edits(rel, body):
    if not FEATURES["payments"]:
        body = re.sub(r'href="(\{R\}|[./]*)checkout\.html\?item=([a-z-]+)">[^<]+<', lambda m: f'href="{m.group(1)}book.html?service={SERVICE_FOR.get(m.group(2),"other")}#quote">Ask about booking<', body)
        body = body.replace("Fixed-price work can be reserved here without a meeting. Every deposit counts toward the total, and you see the full amount, what's due now and any future charges before you pay.",
                            "Online booking and payment are being set up. For now, ask about any service with the quote form, by phone or by text, and I'll send a secure payment link. Every deposit counts toward the total.")
        body = body.replace('<p class="body">Have an invoice from me? <a class="link" href="{R}pay.html">Pay an invoice</a>.</p>', "")
        body = body.replace('You pay the deposit and send your logo, photos and details. Your client account opens.', 'You pay the deposit and send your logo, photos and details.')
    return body
NAV = [("services","Services","services.html"),("tools","Business tools","business-tools.html"),("work","Work","work.html"),("about","About","about.html")]

def head(meta, r):
    noindex = meta.get("noindex","1")=="1"
    if LAUNCH: noindex = meta.get("_rel") in PRIVATE
    robots = '<meta name="robots" content="noindex, nofollow">' if noindex else ""
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{meta["title"]}</title>
<meta name="description" content="{meta["desc"]}">
{robots}
<meta name="theme-color" content="{THEME_COLOR}">
<link rel="icon" href="{r}assets/img/favicon.svg" type="image/svg+xml">
{FONTS}
<link rel="stylesheet" href="{r}assets/css/site.css?v={ver('assets/css/site.css')}">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>'''

def header(meta, r):
    links = "".join(f'<a href="{r}{h}"{" aria-current=\"page\"" if meta.get("nav")==k else ""}>{t}</a>' for k,t,h in NAV)
    mlinks = "".join(f'<a href="{r}{h}">{t}</a>' for k,t,h in NAV)
    return f'''<header class="site-head">
  <div class="wrap">
    <a class="brand" href="{r}index.html">Lisette Colon</a>
    <nav class="nav" aria-label="Main">{links}</nav>
    {"" if LAUNCH and not FEATURES["accounts"] else f'<a class="login-link" href="{r}account/index.html">Client login</a>'}
    <a class="btn sm" href="{r}book.html">Book a consultation</a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="mobile-nav"><span>Menu</span></button>
  </div>
</header>
<nav class="mobile-nav" id="mobile-nav" aria-label="Main" hidden>
  <a href="{r}index.html">Home</a>{mlinks}
  <a class="btn" href="{r}book.html">Book a consultation</a>
  {"" if LAUNCH and not FEATURES["accounts"] else f'<a class="login-link" href="{r}account/index.html">Client login</a>'}
</nav>'''

def footer(r):
    return f'''<footer class="site-foot">
  <div class="wrap">
    <div class="foot-grid">
      <div class="stack-sm">
        <span class="foot-brand">Lisette Colon</span>
        <p>Websites and business tools for local businesses. Based near Hicksville, New York.</p>
        <div class="copy-row"><span>hi@lisettecolon.com</span><button class="copy-btn" type="button" data-copy="hi@lisettecolon.com">Copy</button></div>
        <div class="copy-row"><span>(917) 960-4871</span><button class="copy-btn" type="button" data-copy="9179604871">Copy</button></div>
      </div>
      <div><h2>Services</h2><ul><li><a href="{r}services.html#websites">Websites</a></li><li><a href="{r}business-tools.html">Business tools</a></li><li><a href="{r}services.html#care">Care plans</a></li><li><a href="{r}services.html#photo">Photography and drone</a></li><li><a href="{r}services.html#marketing">Marketing</a></li></ul></div>
      <div><h2>Work with me</h2><ul><li><a href="{r}book.html">Book a consultation</a></li><li><a href="{r}book.html#quote">Request a quote</a></li><li><a href="{r}work.html">Work and demos</a></li><li><a href="{r}about.html">About</a></li></ul></div>
      <div><h2>Clients</h2><ul>{"" if LAUNCH and not FEATURES["accounts"] else f'<li><a href="{r}account/index.html">Client login</a></li>'}{"" if LAUNCH and not FEATURES["payments"] else f'<li><a href="{r}pay.html">Pay an invoice</a></li>'}<li><a href="{r}legal/payments.html">Payments and cancellations</a></li><li><a href="{r}legal/privacy.html">Privacy</a></li><li><a href="{r}legal/terms.html">Terms of service</a></li></ul></div>
    </div>
    <div class="foot-base"><span>&copy; <span data-year>2026</span> Lisette Colon</span><span>English and Spanish</span></div>
  </div>
</footer>
<script src="{r}assets/js/config.js?v={ver('assets/js/config.js')}"></script>
<script src="{r}assets/js/site.js?v={ver('assets/js/site.js')}"></script>'''

def build(name):
    global OUT, FONTS, THEME_COLOR
    out, css, fonts, color, overrides = THEMES[name]
    if LAUNCH: out = ROOT / "dist"
    OUT, THEME_COLOR = out, color
    FONTS = PRE + f'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family={fonts}&display=swap">'
    if out != ROOT:
        if out.exists(): shutil.rmtree(out)
        shutil.copytree(ROOT / "assets", out / "assets")
        if css: (out / "assets/css/site.css").write_text((ROOT / "assets/css/site.css").read_text() + "\n" + css.read_text())
    if LAUNCH:
        cfg = (ROOT / "assets/js/config.js").read_text()
        # Until the admin login is switched on, launch forms open the visitor's email app so no request goes unseen.
        if not FEATURES["accounts"]: cfg = re.sub(r'functionsUrl: "[^"]*"', 'functionsUrl: ""', cfg)
        cfg = cfg.replace('stripeMode: "test"', 'stripeMode: "test",\n  contactMode: "email",\n  accounts: ' + str(FEATURES["accounts"]).lower() + ',\n  payments: ' + str(FEATURES["payments"]).lower())
        (out / "assets/js/config.js").write_text(cfg)
        for stub in ["projects.html","contact.html","projects"]:
            src_stub = ROOT / stub
            if src_stub.is_dir(): shutil.copytree(src_stub, out / stub)
            elif src_stub.exists(): shutil.copy(src_stub, out / stub)
    for src in sorted(SRC.rglob("*.html")):
        rel = src.relative_to(SRC)
        if overrides and (overrides / rel).exists(): src = overrides / rel
        text = src.read_text()
        m = re.match(r"<!--meta (.*?)-->\n?", text)
        meta = dict(p.split("=",1) for p in m.group(1).split("|"))
        meta["_rel"] = str(rel)
        body = text[m.end():]
        if LAUNCH: body = launch_edits(str(rel), body)
        depth = len(rel.parts) - 1
        r = "../" * depth
        body = body.replace("{R}", r)
        extra_js = meta.get("js","")
        scripts = "".join(f'<script src="{s.replace("{R}", r)}{"?v="+ver(s.replace("{R}","")) if s.startswith("{R}") else ""}"></script>' for s in extra_js.split(",") if s)
        bare = meta.get("bare","0") == "1"
        page = head(meta, r) + ("" if bare else header(meta, r)) + "\n<main id=\"main\">\n" + body + "\n</main>\n" + ("" if bare else footer(r)) + scripts + "\n</body>\n</html>\n"
        dest = out / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(page)
    print("built", name, "->", out.relative_to(ROOT) if out != ROOT else ".")

for name in THEMES: build(name)
