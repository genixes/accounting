import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import path from 'path';
const [,, comp, outDir, ...times] = process.argv;
const exe = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const bundled = await bundle({entryPoint: path.resolve('src/index.ts'), webpackOverride: (c) => c});
const browser = await openBrowser('chrome', {browserExecutable: exe, chromiumOptions: {gl: 'swangle'}});
const c = await selectComposition({serveUrl: bundled, id: comp, puppeteerInstance: browser});
for (const t of times) {
  const frame = Math.min(c.durationInFrames - 1, Math.round(parseFloat(t) * 30));
  await renderStill({composition: c, serveUrl: bundled, output: path.join(outDir, `${comp}_${t}.png`), frame, puppeteerInstance: browser, scale: 0.5});
}
await browser.close({silent: true});
console.log('done');
