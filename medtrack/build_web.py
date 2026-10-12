#!/usr/bin/env python3
"""Builds the stand-alone website (web/) from Index.html, Styles.html and JavaScript.html.
Run:  python3 build_web.py   - then upload the web/ folder to any static host (Netlify, Cloudflare Pages, Firebase Hosting...)."""
import os, re
from PIL import Image, ImageDraw
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, 'web')
os.makedirs(out, exist_ok=True)
rd = lambda n: open(os.path.join(here, n), encoding='utf-8').read()

html = rd('Index.html')
html = html.replace("  <script>window.MT_MULTI = <?!= multiJson ?>; window.MT_RESET = <?!= resetJson ?>;</script>\n", '  <script src="config.js"></script>\n')
html = html.replace("<?!= include('Styles'); ?>", rd('Styles.html'))
html = html.replace("<?!= include('JavaScript'); ?>", rd('JavaScript.html'))
html = html.replace('<base target="_top">', '')
head_extra = '''  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" type="image/png" href="icon-192.png">
  <link rel="apple-touch-icon" href="apple-touch-icon.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="MedTrack">
  <meta name="description" content="MedTrack: expiry and inventory monitoring for medical representatives.">
'''
html = html.replace('  <title>MedTrack</title>\n', '  <title>MedTrack</title>\n' + head_extra, 1)
sw = "<script>if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) { window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); }); }</script>\n</body>"
html = html.replace('</body>', sw, 1)
assert '<?' not in html.replace('<?xml', ''), 'unrendered template tag left in build'
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)

cfg = os.path.join(out, 'config.js')
if not os.path.exists(cfg):
    open(cfg, 'w').write("""// MedTrack website settings. Edit this one file, then upload the folder again.
window.MT_CONFIG = {
  // Paste your Apps Script Web app link here (Deploy > Manage deployments > Web app URL, ends with /exec)
  api: 'PASTE_YOUR_WEB_APP_LINK_HERE',
  multi: true
};
""")
open(os.path.join(out, 'manifest.webmanifest'), 'w').write('''{
  "name": "MedTrack",
  "short_name": "MedTrack",
  "description": "Expiry and inventory monitoring for medical representatives",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0F2A44",
  "theme_color": "#0F2A44",
  "icons": [
    {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
    {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
  ]
}
''')
open(os.path.join(out, 'sw.js'), 'w').write('''/* MedTrack service worker: keeps the app shell available offline. Network first, cache as fallback. API calls are never touched. */
const CACHE = 'medtrack-shell-v2';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png']).catch(() => {}))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (u.origin !== location.origin && u.hostname !== 'cdnjs.cloudflare.com') return;
  e.respondWith(fetch(r).then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('index.html'))));
});
''')

def icon(size):
    s = size * 2
    im = Image.new('RGBA', (s, s))
    px = im.load()
    for y in range(s):
        for x in range(s):
            t = (x + y) / (2 * s)
            px[x, y] = (int(15 + (14 - 15) * t), int(42 + (154 - 42) * t), int(68 + (167 - 68) * t), 255)
    layer = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    w, h = int(s * 0.62), int(s * 0.25)
    cx, cy = s // 2, s // 2
    d.rounded_rectangle([cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2], radius=h // 2, fill=(255, 255, 255, 255))
    d.line([cx, cy - h // 2 + 6, cx, cy + h // 2 - 6], fill=(14, 154, 167, 255), width=max(4, s // 60))
    layer = layer.rotate(40, resample=Image.BICUBIC)
    im = Image.alpha_composite(im, layer).convert('RGB')
    return im.resize((size, size), Image.LANCZOS)
for name, size in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)]:
    icon(size).save(os.path.join(out, name), optimize=True)
print('built', out, sorted(os.listdir(out)))
