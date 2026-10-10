// בדיקות דפדפן מקצה לקצה: בונה את האתר עם Firebase מדומה (tests/firebase-stub), מגיש אותו מקומית ובודק
// תהליכים עיקריים, נגישות (axe-core, WCAG 2 AA), סנכרון/מחיקה, מצב אופליין, מסך העיון ו-Service Worker.
// הרצה: npm run test:e2e   (CHROMIUM_PATH=... לשימוש בדפדפן מותקן)
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'shas-e2e-'));
const b = spawnSync(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit', env: { ...process.env, FIREBASE_STUB: 'tests/firebase-stub', OUT_DIR: DIST } });
if (b.status) process.exit(b.status);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json', '.png':'image/png' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname).replace(/^\/shas-tracker/, ''); if (p === '/' || p === '') p = '/index.html';
  const f = path.join(DIST, p); if (!f.startsWith(DIST) || !fs.existsSync(f)) { r.writeHead(404); return r.end('nf'); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }).listen(8765);
const URL0 = 'http://localhost:8765/shas-tracker/';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const long = 'א'.repeat(150);
const learnedB = {}; for (let d = 2; d <= 6; d++) for (const a of ['א','ב']) learnedB['ברכות||' + d + '||' + a] = true;
const baseData = { 'shas-learned': JSON.stringify(learnedB), 'shas-journal': JSON.stringify([{ id: 1, date: '1.1.2026', text: long }]) };
async function open(stub, vp = { width: 390, height: 844 }, sw = 'block') {
  const ctx = await browser.newContext({ viewport: vp, locale: 'he-IL', serviceWorkers: sw });
  await ctx.route(u => !u.href.startsWith('http://localhost'), r => r.abort());
  const p = await ctx.newPage(); const logs = [];
  p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) logs.push(m.text()); });
  p.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
  p.on('dialog', d => d.type() === 'prompt' ? d.accept('מחק') : d.accept());
  await p.addInitScript(s => { if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', 1); localStorage.setItem('__stub', s); } }, JSON.stringify(stub));
  let navs = 0; p.on('framenavigated', f => { if (f === p.mainFrame()) navs++; });
  await p.goto(URL0); await p.waitForTimeout(700);
  return { p, ctx, logs, navs: () => navs };
}
async function axe(p, label) {
  await p.addScriptTag({ content: axeSrc });
  const v = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(v => v.id + '×' + v.nodes.length + ' ' + v.nodes.slice(0, 2).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]).join(' | ')));
  ok(v.length === 0, 'axe ' + label + (v.length ? ': ' + v.join('\n      ') : ''));
}

console.log('— login');
{ const { p, logs } = await open({ loggedOut: true }); await axe(p, 'login'); ok(!logs.length, 'no errors ' + logs.join(';')); await p.context().close(); }

console.log('— main');
{ const { p, logs } = await open({ data: baseData });
  const tabs = await p.$$eval('[role=tab]', b => b.map(x => x.getAttribute('aria-label') + ':' + x.getAttribute('aria-selected')));
  ok(tabs.length === 3 && tabs[0] === 'מעקב למידה:true', 'tabs named ' + tabs);
  ok(!(await p.textContent('footer')).includes('test@example.com'), 'email hidden in footer');
  ok(JSON.parse(await p.evaluate(() => localStorage.getItem('shas-fulldata') || 'null'))?._uid === 'u1', 'local copy saved right after load');
  ok(/v28·[0-9a-f]{6}/.test(await p.textContent('footer')), 'version injected: ' + (await p.textContent('footer')).match(/v28\S*/));
  await p.click('.thdr-btn >> nth=0'); await p.waitForTimeout(200);
  const cells = await p.$$eval('.amud-cell', c => c.length);
  ok(cells === 125, 'ברכות shows 125 amudim (no 64b): ' + cells);
  ok((await p.textContent('.thdr')).includes('10/125'), 'count 10/125');
  await axe(p, 'main+open card');
  await p.keyboard.press('Tab');
  // unmark all ברכות → "{}" with wipe token, not rejected
  await p.click('text=✕ נקה הכל'); await p.waitForTimeout(300);
  let w = await p.evaluate(() => ({ w: window.__writes.find(x => x['shas-learned'] === '{}'), r: window.__rejected }));
  ok(w.w && w.w['shas-wipe'] && w.w['shas-wipe'].field === 'shas-learned' && !w.r.length, 'clear-all saved with wipe token, not rejected');
  // mark range 60b–64b → clamps to 64a
  await p.click('text=סמן טווח'); await p.selectOption('select[aria-label="מדף"]', '60'); await p.click('[aria-label="עמוד התחלה"] [aria-label="עמוד ב"]');
  await p.selectOption('select[aria-label="עד דף"]', '64'); await p.click('text=✓ סמן >> nth=-1'); await p.waitForTimeout(200);
  ok((await p.textContent('.thdr')).includes('8/125'), 'range 60b–64a marked 8: ' + (await p.textContent('.thdr')).match(/\d+\/125/));
  // reversed range → toast, nothing
  await p.click('text=סמן טווח'); await p.selectOption('select[aria-label="מדף"]', '30'); await p.selectOption('select[aria-label="עד דף"]', '20'); await p.click('text=✓ סמן >> nth=-1'); await p.waitForTimeout(200);
  ok(await p.isVisible('.toast'), 'invalid range shows toast');
  ok(JSON.parse(await p.evaluate(() => localStorage.getItem('shas-fulldata')))['shas-learned'].includes('ברכות||64||א'), 'local snapshot updated after range');
  // journal: delete the only long entry
  await p.click('[role=tab] >> nth=1'); await p.click('[aria-label="מחק רשומה"]'); await p.waitForTimeout(300);
  w = await p.evaluate(() => ({ w: window.__writes.find(x => x['shas-journal'] === '[]'), r: window.__rejected }));
  ok(w.w && w.w['shas-wipe'] && !w.r.length, 'journal last-entry delete saved with wipe token');
  await axe(p, 'journal');
  // target
  await p.click('[role=tab] >> nth=2');
  await p.selectOption('select[aria-label="שנת לידה"]', '1990'); await p.selectOption('select[aria-label="חודש לידה"]', '02');
  const days = await p.$$eval('select[aria-label="יום לידה"] option', o => o.length - 1);
  ok(days === 28, 'Feb 1990 has 28 day options: ' + days);
  await p.selectOption('select[aria-label="יום לידה"]', '28'); await p.selectOption('select[aria-label="חודש לידה"]', '04'); await p.selectOption('select[aria-label="חודש לידה"]', '02');
  await p.selectOption('select[aria-label="יום לידה"]', '28');
  await p.fill('#target-age', '20'); await p.waitForTimeout(100);
  ok(await p.isVisible('#target-age-err'), 'past age rejected');
  ok(await p.isDisabled('text=הגדר יעד'), 'save disabled for invalid');
  await p.fill('#target-age', '70'); await p.check('input[type=checkbox]'); await p.waitForTimeout(100);
  const prev = await p.textContent('[aria-live=polite]');
  await axe(p, 'target');
  await p.click('text=הגדר יעד'); await p.waitForTimeout(200);
  w = await p.evaluate(() => window.__writes.filter(x => x['shas-target']).at(-1));
  ok(w && JSON.parse(w['shas-target']).sunset === true && JSON.parse(w['shas-target']).age === 70, 'target saved with sunset: ' + prev);
  // reader: nav + back
  await p.click('.thdr-btn >> nth=0').catch(() => {});
  await p.click('text=📖 >> nth=0'); await p.waitForTimeout(500);
  ok(await p.isVisible('[role=dialog]'), 'reader open');
  ok(await p.evaluate(() => document.activeElement.getAttribute('aria-label')) === 'סגור את מסך העיון', 'focus moved into reader');
  await p.click('text=☰ דפים'); await p.waitForTimeout(200);
  await p.goBack(); await p.waitForTimeout(300);
  ok(await p.isVisible('[role=dialog]'), 'back closes nav only');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(!(await p.isVisible('[role=dialog]')), 'Escape closes reader');
  ok(!logs.length, 'no errors ' + logs.join(';'));
  // sign out
  await p.click('text=יציאה'); await p.waitForTimeout(800);
  const st = await p.evaluate(() => [window.__calls || [], localStorage.getItem('shas-fulldata')]);
  ok(st[1] === null, 'local data cleared on sign-out');
  ok(await p.isVisible('text=כניסה עם Google'), 'back at login after sign-out');
  await p.context().close();
}
console.log('— sign-out clears Firestore cache (calls before reload)');
{ const { p } = await open({ data: baseData });
  await p.evaluate(() => { const r = location.reload.bind(location); window.__reloads = 0; });
  await p.route('**/*', r => r.continue());
  const calls = []; p.on('console', m => {});
  await p.exposeFunction('__rec', x => calls.push(x));
  await p.evaluate(() => { const o = window.__calls.push.bind(window.__calls); window.__calls.push = x => { window.__rec(x); return o(x); }; });
  await p.click('text=יציאה'); await p.waitForTimeout(800);
  ok(['signOut', 'terminate', 'clearIDB'].every(c => calls.includes(c)), 'signOut+terminate+clearIndexedDbPersistence: ' + calls);
  await p.context().close();
}
console.log('— delete account');
{ const { p } = await open({ data: baseData });
  const calls = []; await p.exposeFunction('__rec', x => calls.push(x));
  await p.evaluate(() => { const o = window.__calls.push.bind(window.__calls); window.__calls.push = x => { window.__rec(x); return o(x); }; });
  await p.click('text=מחיקת חשבון'); await p.waitForTimeout(800);
  ok(['deleteDoc', 'deleteUser', 'clearIDB'].every(c => calls.includes(c)), 'account deleted: ' + calls);
  await p.context().close();
}
console.log('— offline view is read-only');
{ const cached = { _uid: 'u1', ...baseData };
  const { p } = await open({ data: baseData, fail: 'unavailable' });
  await p.evaluate(c => localStorage.setItem('shas-fulldata', JSON.stringify(c)), cached);
  await p.reload(); await p.waitForTimeout(700);
  ok(await p.isVisible('[role=alert]'), 'offline banner: ' + (await p.textContent('[role=alert]')).slice(0, 50));
  await p.click('.thdr-btn >> nth=0'); await p.click('.amud-cell >> nth=0'); await p.waitForTimeout(200);
  ok(await p.isVisible('.toast') && await p.evaluate(() => window.__writes.length === 0), 'click blocked with toast, nothing written');
  ok((await p.textContent('.thdr')).includes('10/125'), 'data unchanged');
  await p.context().close();
}
console.log('— no-cache load failure');
{ const { p } = await open({ data: baseData, fail: 'permission-denied' });
  ok((await p.textContent('[role=alert]')).includes('אין הרשאה'), 'denied banner');
  await p.context().close();
}
console.log('— service worker: first visit does not reload; desktop');
{ const { p, navs, logs } = await open({ data: baseData }, { width: 1280, height: 900 }, 'allow');
  await p.waitForTimeout(1500);
  ok(navs() === 1, 'single navigation on first visit (navs=' + navs() + ')');
  ok(await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())), 'SW registered (relative path)');
  ok(await p.evaluate(async () => (await caches.keys()).some(k => /^shas-[0-9a-f]{8}$/.test(k))), 'versioned cache: ' + await p.evaluate(async () => (await caches.keys()).join(',')));
  ok(!logs.length, 'no errors ' + logs.join(';'));
  await p.context().close();
}
console.log('— reader (Sefaria stubbed)');
{
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const reqs = [];
await ctx.route(u => !u.href.startsWith('http://localhost'), r => {
  const u = new URL(r.request().url());
  if (u.hostname !== 'www.sefaria.org') return r.abort();
  reqs.push(u.pathname);
  if (u.pathname.includes('/raw/index/')) return r.fulfill({ json: { alt_structs: { Chapters: { nodes: [{ wholeRef: 'Bekhorot 2a:1-13b:3', heTitle: 'פרק ראשון - הלוקח עובר חמורו' }, { wholeRef: 'Bekhorot 13b:4-26b:2', heTitle: 'פרק שני' }] } } }, headers: { 'access-control-allow-origin': '*' } });
  const m = /texts\/(Steinsaltz_on_)?Bekhorot\.(\d+[ab])/.exec(u.pathname);
  return r.fulfill({ json: { versions: [{ text: m[1] ? ['ביאור ' + m[2] + ' <sup>1</sup><i class="footnote">הערה</i>', 'ביאור ב'] : ['<b>גמרא</b> ' + m[2] + '<script>window.__xss=1</script><img src=x onerror="window.__xss=1">', 'קטע ב'] }] }, headers: { 'access-control-allow-origin': '*' } });
});
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { if (!sessionStorage.getItem('i')) { sessionStorage.setItem('i', 1); localStorage.setItem('__stub', JSON.stringify({ data: {} })); } });
await p.clock.setFixedTime(new Date(2026, 9, 10, 12));
await p.goto(URL0); await p.waitForTimeout(700);
const chip = await p.textContent('button[aria-label^="דף יומי"]').catch(() => null);
ok(chip && chip.includes('בכורות'), 'daf yomi chip opens reader: ' + chip);
await p.click('button[aria-label^="דף יומי"]'); await p.waitForTimeout(800);
const txt = await p.textContent('[aria-label="טקסט הגמרא"]');
ok(txt.includes('22a'), 'reader opened at 22a (daf yomi)');
ok(await p.evaluate(() => !window.__xss), 'sanitizer strips script/onerror');
const st = await p.textContent('[aria-label="ביאור שטיינזלץ"]');
ok(st.includes('ביאור 22a') && !st.includes('הערה'), 'Steinsaltz shown, footnotes stripped');
const hdr = await p.evaluate(async () => { const c = await caches.open('shas-texts-v1'); const k = await c.keys(); const r = await c.match(k[0]); return [k.length, r.headers.get('x-cached-at')]; });
ok(hdr[0] > 0 && +hdr[1] > 0, 'texts cached with timestamp: ' + hdr);
const n = reqs.length;
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.click('button[aria-label^="דף יומי"]'); await p.waitForTimeout(800);
ok(reqs.length === n, 'second open served entirely from cache: ' + (reqs.length - n) + ' new requests');
ok(!errs.length, 'no page errors ' + errs);
await ctx.close();
}
await browser.close(); srv.close(); fs.rmSync(DIST, { recursive: true, force: true });
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
