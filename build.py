#!/usr/bin/env python3
"""Assemble pages from src/ with the shared header and footer.
Each src file starts with: <!--meta title=...|desc=...|nav=...|noindex=0-->"""
import os, re, pathlib, hashlib
ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
def ver(rel):
    return hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()[:8]
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Figtree:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400..600&display=swap">'
NAV = [("services","Services","services.html"),("tools","Business tools","business-tools.html"),("work","Work","work.html"),("about","About","about.html")]

def head(meta, r):
    robots = '<meta name="robots" content="noindex, nofollow">' if meta.get("noindex","1")=="1" else ""
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{meta["title"]}</title>
<meta name="description" content="{meta["desc"]}">
{robots}
<meta name="theme-color" content="#faf7f5">
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
    <a class="login-link" href="{r}account/index.html">Client login</a>
    <a class="btn sm" href="{r}book.html">Book a consultation</a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="mobile-nav"><span>Menu</span></button>
  </div>
</header>
<nav class="mobile-nav" id="mobile-nav" aria-label="Main" hidden>
  <a href="{r}index.html">Home</a>{mlinks}
  <a class="btn" href="{r}book.html">Book a consultation</a>
  <a class="login-link" href="{r}account/index.html">Client login</a>
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
      <div><h2>Clients</h2><ul><li><a href="{r}account/index.html">Client login</a></li><li><a href="{r}pay.html">Pay an invoice</a></li><li><a href="{r}legal/payments.html">Payments and cancellations</a></li><li><a href="{r}legal/privacy.html">Privacy</a></li><li><a href="{r}legal/terms.html">Terms of service</a></li></ul></div>
    </div>
    <div class="foot-base"><span>&copy; <span data-year>2026</span> Lisette Colon</span><span>English and Spanish</span></div>
  </div>
</footer>
<script src="{r}assets/js/config.js?v={ver('assets/js/config.js')}"></script>
<script src="{r}assets/js/site.js?v={ver('assets/js/site.js')}"></script>'''

for src in sorted(SRC.rglob("*.html")):
    rel = src.relative_to(SRC)
    text = src.read_text()
    m = re.match(r"<!--meta (.*?)-->\n?", text)
    meta = dict(p.split("=",1) for p in m.group(1).split("|"))
    body = text[m.end():]
    depth = len(rel.parts) - 1
    r = "../" * depth
    body = body.replace("{R}", r)
    extra_js = meta.get("js","")
    scripts = "".join(f'<script src="{s.replace("{R}", r)}{"?v="+ver(s.replace("{R}","")) if s.startswith("{R}") else ""}"></script>' for s in extra_js.split(",") if s)
    bare = meta.get("bare","0") == "1"
    out = head(meta, r) + ("" if bare else header(meta, r)) + "\n<main id=\"main\">\n" + body + "\n</main>\n" + ("" if bare else footer(r)) + scripts + "\n</body>\n</html>\n"
    dest = ROOT / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out)
    print("built", rel)
