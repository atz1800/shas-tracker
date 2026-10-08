const CACHE = 'shas-v27';
const RUNTIME = 'shas-runtime-v1';
const TEXTS = 'shas-texts-v1'; // טקסטים מספריא שנשמרים ממסך העיון
const ASSETS = ['./', './index.html', './privacy.html', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './manifest.json'];
// ספריות חיצוניות בגרסאות קבועות — שומרים במטמון כדי שהאפליקציה תיפתח גם בלי אינטרנט
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
  // דף ראשי: רשת קודם (תמיד גרסה עדכנית), מטמון רק כשאין אינטרנט
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./')))
    );
    return;
  }
  // ספריות CDN: מטמון קודם, ושמירה בפעם הראשונה
  if (isCdn(url)) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(RUNTIME).then(c => c.put(e.request, copy)); }
        return res;
      }))
    );
    return;
  }
  // קבצי האתר: מטמון קודם. כל השאר (Firebase/Firestore וכו׳) — ישירות לרשת
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
