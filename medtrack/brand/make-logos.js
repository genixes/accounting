const { chromium } = require('playwright'); const fs = require('fs');
const MARK = (id, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F2A44"/><stop offset="1" stop-color="#0E9AA7"/></linearGradient></defs><rect width="512" height="512" rx="${rounded ? 116 : 0}" fill="url(#g${id})"/><g transform="translate(256 256) rotate(-40)"><rect x="-168" y="-68" width="336" height="136" rx="68" fill="#fff"/><rect x="-5" y="-62" width="10" height="124" fill="#0E9AA7"/></g></svg>`;
const MARK_PAD = (id) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="p${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0F2A44"/><stop offset="1" stop-color="#0E9AA7"/></linearGradient></defs><rect width="512" height="512" fill="url(#p${id})"/><g transform="translate(256 256) rotate(-40) scale(.78)"><rect x="-168" y="-68" width="336" height="136" rx="68" fill="#fff"/><rect x="-5" y="-62" width="10" height="124" fill="#0E9AA7"/></g></svg>`;
const font = `font-family:'Inter','Inter Display',sans-serif;`;
const word = (dark, size) => `<span style="${font}font-weight:800;letter-spacing:-.03em;font-size:${size}px;color:${dark ? '#0F2A44' : '#fff'}">Med<span style="color:${dark ? '#0E9AA7' : '#6FD8E2'}">Track</span></span>`;
const items = {
  'medtrack-icon-1024': { w: 1024, h: 1024, html: `<div style="width:1024px;height:1024px">${MARK('a', true)}</div>`, transparent: true },
  'medtrack-profile-picture-1024': { w: 1024, h: 1024, html: `<div style="width:1024px;height:1024px">${MARK_PAD('b')}</div>` },
  'medtrack-logo-horizontal': { w: 1800, h: 520, transparent: true, html: `<div style="display:flex;align-items:center;gap:56px;padding:40px 60px;width:1800px;height:520px;box-sizing:border-box"><div style="width:300px;height:300px;flex:none">${MARK('c', true)}</div><div>${word(true, 250)}</div></div>` },
  'medtrack-logo-horizontal-white': { w: 1800, h: 520, transparent: true, html: `<div style="display:flex;align-items:center;gap:56px;padding:40px 60px;width:1800px;height:520px;box-sizing:border-box"><div style="width:300px;height:300px;flex:none">${MARK('d', true)}</div><div>${word(false, 250)}</div></div>` },
  'medtrack-logo-with-tagline': { w: 2000, h: 600, transparent: true, html: `<div style="display:flex;align-items:center;gap:64px;padding:50px 70px;width:2000px;height:600px;box-sizing:border-box"><div style="width:360px;height:360px;flex:none">${MARK('e', true)}</div><div>${word(true, 260)}<div style="${font}font-weight:600;font-size:46px;letter-spacing:.2em;color:#5B6F83;margin-top:14px;padding-left:8px">INVENTORY &amp; EXPIRY MONITORING</div></div></div>` },
  'medtrack-logo-stacked': { w: 1200, h: 1200, transparent: true, html: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:50px;width:1200px;height:1200px"><div style="width:520px;height:520px">${MARK('f', true)}</div>${word(true, 220)}</div>` },
  'medtrack-logo-on-navy': { w: 1800, h: 700, html: `<div style="background:#0F2A44;display:flex;align-items:center;justify-content:center;gap:56px;width:1800px;height:700px"><div style="width:300px;height:300px;flex:none">${MARK('g', true)}</div><div>${word(false, 250)}</div></div>` },
};
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  for (const [name, it] of Object.entries(items)) {
    const p = await b.newPage({ viewport: { width: it.w, height: it.h } });
    await p.setContent(`<html><body style="margin:0;background:${it.transparent ? 'transparent' : '#fff'}">${it.html}</body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: name + '.png', omitBackground: !!it.transparent, clip: { x: 0, y: 0, width: it.w, height: it.h } });
    await p.close();
  }
  fs.writeFileSync('medtrack-icon.svg', MARK('z', true));
  await b.close();
})();
