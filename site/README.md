# LAYAW SYSTEM · Flagship site

Static site, no build step. Everything (fonts, Three.js, GSAP, Lenis) is self-hosted, so it runs on any static host with no third-party requests.

## Deploy

**Cloudflare Pages:** connect the repo, set *Build command* to empty and *Build output directory* to `site`. `_headers` sets long-term caching for fonts and vendor files plus basic security headers.

**GitHub Pages:** publish the `site` folder (for example with an Actions "upload-pages-artifact" step pointing at `site/`). `.nojekyll` is included.

Local preview: `npx http-server site -p 8080` (any static server works; ES modules need http, not `file://`).

## Before going live

1. **Messenger link.** `MESSENGER_URL` at the top of `js/main.js` is set to `https://m.me/layawsystem`. Confirm it matches the real Facebook page; every Messenger button on the page reads from it.
2. **Case-study screens.** The dayonkàmu, Kitchen Arena, and LAYAW POS devices are HTML recreations, labelled as illustrations. Swap in real screenshots when you have them: replace the `.ui-*` block inside each `.frame__device` with an `<img>` (WebP, about 1280px wide, `loading="lazy"`).
3. **Gotham.** If you license Gotham for web, drop the WOFF2 files in `fonts/`, add `@font-face` rules, and put `"Gotham"` first in `--f-sans` in `css/site.css`. Red Hat Display was chosen because its proportions sit closest to Gotham's.
4. **Domain.** Canonical, Open Graph, sitemap, and JSON-LD URLs point at `https://layawsystem.pages.dev/`. Update them together if you move to a custom domain.

## Structure

```
index.html            Single flagship page, semantic sections 00 to 08
css/site.css          Tokens, layout, sections (mobile-first)
js/main.js            Lenis + GSAP choreography, index menu, Cebu clock,
                      ecosystem wiring, System Builder configurator,
                      light personalisation (?for=cafe|clinic|court|construction|rental)
js/hero.js            Three.js monogram, extruded from the vector trace
js/monogram-paths.js  potrace output of the official logo PNG (do not edit)
assets/brand/         Original logo PNG, resized copies, favicons, SVG trace
assets/img/           3D poster (fallback + LCP), OG image, grain
vendor/               three 0.169, gsap 3.15 + ScrollTrigger, lenis 1.3
fonts/                Red Hat Display, Newsreader italic, IBM Plex Mono (WOFF2)
```

## Behaviour notes

- **3D fallback.** `prefers-reduced-motion`, Save-Data, 2G, ≤2 GB RAM, ≤2 cores, or no WebGL keep the pre-rendered poster (`assets/img/monogram-poster.webp`, a frame of the same 3D scene). Phones and mid-range devices get a lighter mesh and capped pixel ratio. The scene only renders while visible.
- **Reduced motion.** No smooth scrolling, no scroll scrubbing, no loader; everything renders in its final state.
- **No JavaScript.** All content is visible; only the configurator output and 3D need JS.
- **Logo contrast.** The navy S disappears on the night background, so on dark surfaces the flat logo always sits on an ice "seal" plate. On paper sections it appears at full size, unaltered.
- **Personalisation.** Choosing a business in System Builder (or arriving with `?for=court`, useful for ads) adapts the hero line, the contact headline, the email subject, and puts the closest case study first. The choice is remembered per browser.
