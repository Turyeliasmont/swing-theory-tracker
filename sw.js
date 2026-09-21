// sw.js — makes the app work offline once it's been loaded at least once,
// and makes sure a new deploy actually reaches your phone automatically.
//
// Two caches, both tagged with CACHE_VERSION below:
//  - SHELL_CACHE: the fixed app files (html/css/js/manifest/icons). Listed
//    explicitly below and pre-cached on install.
//  - RUNTIME_CACHE: everything else, including programs/manifest.json and
//    every programs/*.json file. These are cached the first time they're
//    fetched (i.e. the first time you open a program while online), so a
//    brand-new program file works offline too WITHOUT ever needing to edit
//    this file. That's what keeps "add a program" a zero-code-change step.
//
// HOW UPDATES WORK: bump CACHE_VERSION below every time you change any of
// index.html/css/js/manifest/icons and deploy. That gives this deploy a
// brand-new cache name, so:
//   - install fetches every shell file fresh from the network (bypassing
//     any HTTP cache) into the NEW cache, never reusing old bytes.
//   - activate deletes every cache that isn't this version's, then takes
//     control of already-open tabs immediately (skipWaiting + clients.claim).
// Cache Storage is the only thing this file ever touches — localStorage
// and IndexedDB (your saved program position, current week/day, and
// history) are never read, written, or cleared here.
//
// One real-world wrinkle you can't avoid with any service worker: a tab
// that's already open when a new version deploys keeps running the OLD
// code until it's reloaded/reopened (the update installs in the background
// first). The very next time you open the app after that, you get the new
// version — no manual cache-clearing or reinstalling needed.

const CACHE_VERSION = 'v3';
const SHELL_CACHE = 'stt-shell-' + CACHE_VERSION;
const RUNTIME_CACHE = 'stt-runtime-' + CACHE_VERSION;

const SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/storage.js',
  './js/audio.js',
  './js/wakelock.js',
  './js/timer-engine.js',
  './js/programs.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-maskable.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => {
        // { cache: 'reload' } forces a real network fetch for every shell
        // file, bypassing the browser's own HTTP cache. Without this, a
        // "new" service worker could re-cache the exact same stale bytes
        // the browser already had sitting in its HTTP cache.
        const requests = SHELL_FILES.map((url) => new Request(url, { cache: 'reload' }));
        return cache.addAll(requests);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name !== SHELL_CACHE && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isShellFile = SHELL_FILES.some((f) => url.pathname.endsWith(f.replace('./', '/')) || (f === './' && url.pathname === '/'));

  if (isShellFile) {
    // App shell: cache-first from THIS version's cache specifically, so
    // the app still opens instantly offline. Deliberately scoped to
    // SHELL_CACHE (via cache.match, not the global caches.match) — the
    // global lookup searches every cache in storage and could return a
    // stale hit from an old version's cache if cleanup hasn't finished.
    event.respondWith(
      caches.open(SHELL_CACHE).then((cache) => cache.match(req).then((cached) => cached || fetch(req)))
    );
    return;
  }

  // Everything else (program data files, etc.): try the network first so
  // edits show up immediately, but fall back to cache when offline, and
  // always store a fresh copy for next time. Also scoped to this version's
  // RUNTIME_CACHE, same reasoning as above.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() => caches.open(RUNTIME_CACHE).then((cache) => cache.match(req)))
  );
});
