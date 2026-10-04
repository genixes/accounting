# LAYAW SYSTEM website

The official marketing site for LAYAW SYSTEM, Cebu City. It is plain static HTML, CSS and JavaScript with no build step, and it lives in this folder so it stays separate from the Accounting app in the rest of the repo.

```
website/
  index.html              the page
  404.html                not-found page
  assets/css/main.css     all styles (tokens at the top)
  assets/js/main.js       clock, nav, ecosystem, configurator, scroll, personalisation
  assets/js/hero-gl.js    WebGL monogram (loaded only on capable devices)
  assets/vendor/          three.js r169 (self-hosted, no CDN dependency)
  assets/brand/           monogram SVGs (colour, reverse, outline), PNG/WebP marks, original logo
  assets/img/og-image.png 1200x630 share image
  _headers                Cloudflare Pages caching and security headers
  robots.txt, sitemap.xml, site.webmanifest, favicon.svg
```

## Preview locally

ES modules need a server, so opening the file directly will not run the 3D hero.

```bash
cd website
npx http-server -p 8080 .     # or: python3 -m http.server 8080
```

## Deploy

**Cloudflare Pages (recommended).** Create a project from this GitHub repo. Leave the build command empty and set the build output directory to `website`. `_headers` is picked up automatically. Add `layawsystem.com` under Custom domains.

**GitHub Pages.** In the repo, go to Settings, then Pages, and set Source to "GitHub Actions". Then run the "Deploy website to GitHub Pages" workflow from the Actions tab. It only runs when you trigger it manually.

## How the site adapts

- **3D hero.** Runs only when WebGL is available, motion is allowed, Data Saver is off and the device has enough cores and memory. Phones and tablets get a lighter scene (fewer bevel segments, no clearcoat, capped pixel ratio). A frame-time governor drops resolution, then falls back to the static SVG mark if the device struggles. The SVG is always the first paint.
- **Reduced motion.** No WebGL, no reveals, no scroll-linked device motion, no custom cursor, and every section is shown at rest.
- **Personalisation.** Greets in Cebuano by Cebu time and shows the hour difference from the visitor. It remembers which systems a visitor explores (in localStorage only, never sent anywhere) and uses that to open the ecosystem on that system, preset the configurator, and write a closing line in the contact section.

## Things to replace

1. **Case-study screens.** The laptop, phone and tablet screens in Selected Work are recreated in HTML for illustration (marked on the page). Swap in real screenshots of dayonkàmu, The Kitchen Arena and the LAYAW POS café demo, or keep the HTML versions and match them to the real UI.
2. **PDF Pro window.** Also illustrated. Replace it with a real product screenshot.
3. **Typeface.** The brand face is Gotham. The CSS already lists `"Gotham"` first, so once you license Gotham webfonts, add the `@font-face` rules at the top of `main.css` and remove the Montserrat link in `index.html`.
4. **Canonical domain.** Meta tags, `sitemap.xml` and `robots.txt` assume `https://layawsystem.com/`.
5. **Copy to confirm.** The definition of *layaw* in the Belief section, the example prices in the mock screens, and which systems are "Available now" versus "Built on request".
