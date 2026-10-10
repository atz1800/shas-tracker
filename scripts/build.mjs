// בנייה לפרסום: index.html נשאר קובץ המקור (עובד גם בלי בנייה, עם ספריות מ-CDN ו-Babel בדפדפן).
// הבנייה אורזת את הכל — React, hebcal, Firebase והקוד של האפליקציה — לקובץ JS אחד מ-npm (בלי CDN, בלי Babel),
// מזריקה מזהה גרסה ל-APP_VERSION ולשם המטמון ב-sw.js, ומעתיקה את קבצי האתר ל-dist/.
//
// FIREBASE_STUB=<dir> (לבדיקות בלבד): מחליף את Firebase במודולים מדומים מהתיקייה (app.js/auth.js/firestore.js)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const OUT = process.env.OUT_DIR || 'dist';
const STATIC = ['privacy.html', 'manifest.json', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'og-image.png', 'screenshot-mobile.png', 'screenshot-wide.png'];

const html = readFileSync('index.html', 'utf8');
const CDN_TAGS = /<script src="https:\/\/(cdnjs\.cloudflare\.com|unpkg\.com)\/[^"]*"[^>]*><\/script>\n?/g;
const CDN_COMMENT = /<!-- ספריות מ-CDN[^>]*-->\n?/;
const FB_BLOCK = /<script type="module" id="fb-init">([\s\S]*?)<\/script>\n?/;
const JSX_BLOCK = /<script type="text\/babel">([\s\S]*?)<\/script>/;

const cdn = html.match(CDN_TAGS) || [];
if (cdn.length !== 4) throw new Error('expected 4 CDN <script> tags (react, hebcal, react-dom, babel), found ' + cdn.length);
const fb = html.match(FB_BLOCK);
if (!fb) throw new Error('<script type="module" id="fb-init"> not found in index.html');
const jsx = html.match(JSX_BLOCK);
if (!jsx) throw new Error('<script type="text/babel"> not found in index.html');

// Firebase: אותו קוד, עם ייבוא מ-npm במקום מ-gstatic. הייבוא עולה לראש הקובץ, והשאר בבלוק משלו (בלי התנגשות שמות)
const fbImports = [], fbBody = [];
for (const line of fb[1].split('\n')) {
  if (/^\s*import /.test(line)) fbImports.push(line.trim().replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-(\w+)\.js/, 'firebase/$1'));
  else fbBody.push(line);
}
// מזהה גרסה — מתוכן קבצי המקור והתלויות (אותו קלט → אותו מזהה)
const hash = createHash('sha256').update(html).update(readFileSync('sw.js')).update(readFileSync('package-lock.json')).update(readFileSync('scripts/build.mjs')).digest('hex').slice(0, 8);
const appFile = `app-${hash}.js`;
const jsxCode = jsx[1].replace(/const APP_VERSION = '([^']+)'/, (m, v) => `const APP_VERSION = '${v}·${hash.slice(0, 6)}'`);
if (jsxCode === jsx[1]) throw new Error('APP_VERSION not found in index.html');

const entry = `import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { HDate } from '@hebcal/core';
${fbImports.join('\n')}
window.React = React;
window.hebcal = { HDate };
{
${fbBody.join('\n')}
}
${jsxCode}`;

const stub = process.env.FIREBASE_STUB && resolve(process.env.FIREBASE_STUB);
const result = await build({
  stdin: { contents: entry, loader: 'jsx', resolveDir: process.cwd(), sourcefile: 'index.html' },
  bundle: true, minify: true, format: 'esm', target: 'es2020', charset: 'utf8', write: false, legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: stub ? { 'firebase/app': stub + '/app.js', 'firebase/auth': stub + '/auth.js', 'firebase/firestore': stub + '/firestore.js' } : {},
});
const js = result.outputFiles[0].text;

const out = html
  .replace(CDN_COMMENT, '')
  .replace(CDN_TAGS, '')
  .replace(FB_BLOCK, '')
  .replace(JSX_BLOCK, () => `<script type="module" src="${appFile}"></script>`);

const sw = readFileSync('sw.js', 'utf8');
const swOut = sw.replace(/const CACHE = '[^']*';/, `const CACHE = 'shas-${hash}';`).replace('/*BUILD_ASSETS*/', `, './${appFile}'`);
if (swOut === sw || !swOut.includes(appFile)) throw new Error('sw.js CACHE / BUILD_ASSETS markers not found');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
writeFileSync(`${OUT}/index.html`, out);
writeFileSync(`${OUT}/${appFile}`, js);
writeFileSync(`${OUT}/sw.js`, swOut);
for (const f of STATIC) copyFileSync(f, `${OUT}/${f}`);
writeFileSync(`${OUT}/.nojekyll`, '');
console.log(`built ${OUT}/: index.html ${(out.length / 1024).toFixed(0)}KB + ${appFile} ${(js.length / 1024).toFixed(0)}KB (React, hebcal, Firebase bundled — no CDN, no Babel)`);
