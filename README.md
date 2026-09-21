# Swing Theory Tracker

A personal kettlebell workout tracker: program picker, warm-up timer,
workout screen (straight sets / circuits / EMOMs), session stopwatch, and
history log. Plain HTML/CSS/JS, no build step, no framework, no backend —
everything is stored in your browser's local storage on your own phone.

## Running it

This is a static site — a folder of files — so it needs to be *served* by
a web server rather than opened directly as a `file://` path (the browser's
fetch of `programs/manifest.json` and the PWA install/offline features
both require that).

**Quickest way (Windows, no installs):** double-click [`serve.ps1`](serve.ps1)
or run it from a terminal:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Then open `http://localhost:8080` in a browser on this computer, or
`http://<this-computer's-LAN-IP>:8080` from your phone if it's on the same
wifi network. This is enough to run workouts from your phone.

**For real "install to home screen" + offline support on your phone:**
browsers only allow installable/offline PWAs over HTTPS (or `localhost`
on the same device). A plain `http://192.168.x.x:8080` link from
`serve.ps1` won't offer an install prompt on your phone. To get that,
host the folder somewhere with free HTTPS and no account needed by the
app itself — e.g. GitHub Pages, Netlify, or Cloudflare Pages. Upload/push
this whole folder as-is; nothing needs to change. Then visit that HTTPS
URL on your phone once (while online) and use "Add to Home Screen".
After that first load, it works offline.

## Deploying a code change (important — do this every time)

Whenever you (or a future Claude Code session) change any of `index.html`,
`css/styles.css`, any `js/*.js` file, `manifest.webmanifest`, or the icons,
**bump `CACHE_VERSION` at the top of [`sw.js`](sw.js)** before pushing —
just increment it (`'v3'` → `'v4'`, or a date, anything unique).

This is what makes an update actually reach your phone automatically. The
service worker caches the app's files by that version string; bumping it
gives the new deploy a fresh cache, and the old one gets deleted
automatically the next time you open the app — no manual "clear site
data" needed, and your saved progress/history (which lives in
`localStorage`, never in that cache) is untouched by any of this.

One thing no service worker can avoid: a tab that's *already open* when
you deploy keeps running the old code until it's reloaded — the update
installs quietly in the background first. The next time you open the app
after that, you get the new version. Also, on GitHub Pages specifically,
a push can take a few minutes to actually go live (its CDN needs to catch
up), so don't expect it instantly.

If you ever forget to bump it and a change doesn't seem to show up, bump
`CACHE_VERSION` and push again — that alone forces every open tab to pick
up the latest files on its next reload.

## Adding a new program

See [`programs/README.md`](programs/README.md) — in short: drop a new
program JSON file into `/programs`, add its filename to
`programs/manifest.json`, and reload. No other file ever needs to change.

## How data is stored

Everything lives in `localStorage` in your browser, scoped to wherever you
host this app:

- which program is active, and your current week/day position in each
  program you've used
- your workout history (date, program, week/day, duration)

There's no account, no sync, and no server component — if you clear your
browser's site data (or switch browsers/devices), that history is gone.

## File layout

```
index.html            the single page
css/styles.css         all styling
js/storage.js          localStorage read/write helpers
js/audio.js             beep sounds (Web Audio API, no sound files)
js/wakelock.js         keeps the screen on during a workout
js/timer-engine.js     countdown/stopwatch timer helpers
js/programs.js         loads programs/manifest.json + program files
js/app.js               screens, navigation, rendering — start here to read the app
manifest.webmanifest   PWA manifest (installability)
sw.js                   service worker (offline caching)
icons/                  app icons
programs/               workout program data — see programs/README.md
serve.ps1               a tiny local static file server (no installs needed)
```
