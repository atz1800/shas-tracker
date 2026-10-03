// בנייה לפרסום: מקמפל מראש את קוד ה-JSX שב-index.html (במקום Babel בדפדפן) ומעתיק את קבצי האתר ל-dist/.
// index.html נשאר קובץ המקור — עורכים אותו כרגיל, והוא עובד גם בלי בנייה.
import { transform } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';

const OUT = 'dist';
const STATIC = ['privacy.html', 'sw.js', 'manifest.json', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'og-image.png'];

const html = readFileSync('index.html', 'utf8');
const BABEL_TAG = /<script src="[^"]*babel-standalone[^"]*"><\/script>\n?/;
const JSX_BLOCK = /<script type="text\/babel">([\s\S]*?)<\/script>/;
if (!BABEL_TAG.test(html)) throw new Error('babel-standalone <script> not found in index.html');
const m = html.match(JSX_BLOCK);
if (!m) throw new Error('<script type="text/babel"> not found in index.html');

const { code } = await transform(m[1], { loader: 'jsx', minify: true, target: 'es2020', charset: 'utf8' });

// type="module" — רץ אחרי סקריפט ה-Firebase (גם הוא module), בדיוק כמו Babel שרץ אחרי טעינת הדף
const out = html
  .replace(BABEL_TAG, '')
  .replace(JSX_BLOCK, () => '<script type="module">\n' + code + '</script>');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
writeFileSync(OUT + '/index.html', out);
for (const f of STATIC) copyFileSync(f, OUT + '/' + f);
writeFileSync(OUT + '/.nojekyll', '');
console.log(`built ${OUT}/index.html: ${(html.length / 1024).toFixed(0)}KB → ${(out.length / 1024).toFixed(0)}KB, babel-standalone removed`);
