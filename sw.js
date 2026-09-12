// sw.js — makes the app work offline once it's been loaded at least once.
//
// Two caches:
//  - SHELL_CACHE: the fixed app files (html/css/js/manifest/icons). Listed
//    explicitly below and pre-cached on install.
//  - RUNTIME_CACHE: everything else, including programs/manifest.json and
//    every programs/*.json file. These are cached the first time they're
//    fetched (i.e. the first time you open a program while online), so a
//    brand-new program file works offline too WITHOUT ever needing to edit
//    this file. That's what keeps "add a program" a zero-code-change step.
//
// Bump SHELL_CACHE's version suffix only when you change the app's own
// html/css/js files, so returning visitors pick up the update.

const SHELL_CACHE = 'stt-shell-v1';
const RUNTIME_CACHE = 'stt-runtime-v1';

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
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names
        .filter((name) => name !== SHELL_CACHE && name !== RUNTIME_CACHE)
        .map((name) => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isShellFile = SHELL_FILES.some((f) => url.pathname.endsWith(f.replace('./', '/')) || (f === './' && url.pathname === '/'));

  if (isShellFile) {
    // App shell: cache-first, so the app still opens instantly offline.
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    );
    return;
  }

  // Everything else (program data files, etc.): try the network first so
  // edits show up immediately, but fall back to cache when offline, and
  // always store a fresh copy for next time.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
