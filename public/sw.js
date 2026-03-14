const CACHE = 'party-games-v2';
const PRECACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/assets.js',
  '/assets/characters/imp-crew.png',
  '/assets/characters/imp-evil.png',
  '/assets/characters/trivia.png',
  '/assets/characters/hottake-a.png',
  '/assets/characters/mafia.png',
  '/assets/characters/millionaire.png',
  '/assets/characters/feud.png',
  '/assets/characters/wavelength.png',
  '/assets/characters/alias.png',
  '/assets/characters/drawing.png',
  '/assets/characters/win.png',
  '/assets/characters/lose.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Skip non-GET and socket.io requests
  if (e.request.method !== 'GET' || e.request.url.includes('/socket.io/')) return;
  // Skip API calls — always fetch fresh
  if (e.request.url.includes('/api/')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // Return cached version, and update cache in background
      const fetchPromise = fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
