// Service worker: makes Exsy installable and lets it open without a connection.
// Network-first for the app's own files, so a new version on GitHub Pages is picked up on the next load.
// Fonts and the Firebase SDK (versioned URLs) are cached on first use; Firestore traffic is not touched.
const CACHE = 'exsy-v1';
const LIB_CACHE = 'exsy-libs';
const LIB_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];
const SHELL = ['./', './index.html', './app.css', './app.js', './pages.js', './chit.js', './more.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== LIB_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(LIB_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
});
