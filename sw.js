// שם המטמון מתעדכן אוטומטית בכל בנייה (scripts/build.mjs) — אין צורך לעדכן ידנית
const CACHE = 'shas-dev';
const RUNTIME = 'shas-runtime-v2';
const TEXTS = 'shas-texts-v1'; // טקסטים מספריא שנשמרים ממסך העיון
const ASSETS = ['./', './index.html', './privacy.html', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './manifest.json' /*BUILD_ASSETS*/];
// ספריות חיצוניות בגרסאות קבועות (רק בעבודה מקומית על קובץ המקור; באתר הבנוי הכל נארז מקומית) — וגופנים
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const isCdn = url => CDN_HOSTS.includes(url.hostname) || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== RUNTIME && k !== TEXTS).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // דף ראשי: רשת קודם (תמיד גרסה עדכנית), מטמון רק כשאין אינטרנט. שומרים רק תשובה תקינה — לא דף שגיאה
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(url.origin + url.pathname, copy)); }
        return r;
      }).catch(() => caches.match(url.origin + url.pathname).then(r => r || caches.match('./')))
    );
    return;
  }
  // ספריות CDN וגופנים: מטמון קודם, ושמירה בפעם הראשונה (רק תשובות תקינות — לא opaque, שתופסות מקום רב במכסה)
  if (isCdn(url)) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then(c => c.put(e.request, copy)); }
        return res;
      }))
    );
    return;
  }
  // קבצי האתר: מטמון קודם. כל השאר (Firebase/Firestore, ספריא וכו׳) — ישירות לרשת
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
