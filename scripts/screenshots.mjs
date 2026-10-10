// מייצר את צילומי המסך של חלון ההתקנה (manifest.json → screenshots) מנתוני דוגמה, עם Firebase מדומה. הרצה: node scripts/screenshots.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { spawnSync } from 'node:child_process';
const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'shas-shot-'));
spawnSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit', env: { ...process.env, FIREBASE_STUB: 'tests/firebase-stub', OUT_DIR: DIST } });
const srv = http.createServer((q, r) => { let p = new URL(q.url, 'http://x').pathname.replace(/^\/shas-tracker/, ''); if (p === '/' || !p) p = '/index.html'; const f = path.join(DIST, p); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html; charset=utf-8' : 'image/png' }); r.end(fs.readFileSync(f)); }).listen(8767);
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const learned = {}; const add = (t, a, b) => { for (let d = a; d <= b; d++) for (const x of ['א','ב']) learned[t + '||' + d + '||' + x] = true; };
add('ברכות', 2, 64); add('שבת', 2, 40); add('פסחים', 2, 30);
const reviews = {}; for (let d = 2; d <= 20; d++) reviews['ברכות||' + d + '||א'] = 1 + (d % 4);
const data = { 'shas-learned': JSON.stringify(learned), 'shas-reviews': JSON.stringify(reviews), 'shas-streak': JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 12 }),
  'shas-target': JSON.stringify({ age: 60, birth: '1985-03-05', date: '2045-03-01T00:00:00.000Z' }) };
for (const [file, vp, open] of [['screenshot-mobile.png', { width: 390, height: 844 }, 'שבת'], ['screenshot-wide.png', { width: 1280, height: 800 }, 'שבת']]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.width < 500 ? 2 : 1, serviceWorkers: 'block' });
  await ctx.route(u => !u.href.startsWith('http://localhost'), r => r.abort());
  const p = await ctx.newPage();
  await p.addInitScript(s => localStorage.setItem('__stub', s), JSON.stringify({ data }));
  await p.goto('http://localhost:8767/shas-tracker/'); await p.waitForTimeout(800);
  await p.click(`.thdr-btn:has-text("${open}")`); await p.waitForTimeout(300);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: file });
  await ctx.close();
}
await browser.close(); srv.close(); fs.rmSync(DIST, { recursive: true });
