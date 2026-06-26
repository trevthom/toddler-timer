# CLAUDE.md — Toddler Timer

A guide for anyone (human or Claude) picking this project up to change it.
Read this first; it explains where everything lives and how to make the most
common edits without breaking things.

---

## 1. What this is

**Toddler Timer** is an installable Progressive Web App (PWA): a big, friendly
visual countdown for little kids. A large bar ("the tank") starts full and
drains as time runs out, with a plain mm:ss readout below it. When time's up,
a gentle chime plays and confetti rains down with the words **"All done!"** —
which stays put until a grown-up taps **Reset**.

**Design goals:** big touch targets, no reading required to understand it, works
offline, and the code is split into small files so it's easy to change.

---

## 2. Running and installing it

**Just open `index.html`.** Double-click it (or drag it into a browser) on a
computer, or open the file in a mobile browser. No server is required — the
scripts load as plain `<script>` files, which browsers allow straight from the
`file://` protocol.

Everything the child uses works this way: setting the time, the draining bar,
the countdown, the chime, the confetti and "All done!", and the eye toggle
that shows/hides the numbers.

You only need to *serve* the folder if you want the two extras that browsers
restrict to a secure context (HTTPS or `localhost`):

- **Installing it as an app** ("Add to Home Screen" / "Install app").
- **Offline caching via the service worker** (irrelevant when you've opened a
  local file — those files are already on the device).

To serve it for those cases, from the project folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, `php -S`, VS Code "Live Server", etc.).
The "Hide numbers" preference also persists most reliably when served (some
browsers limit storage for pages opened directly from a file; the app falls
back to remembering it for the current session).

---

## 3. File map

```
toddler-timer/
├── index.html          App shell + PWA <meta> tags + service-worker registration
├── manifest.json       PWA metadata (name, icons, colours, display mode)
├── service-worker.js   Offline caching of the app shell
├── CLAUDE.md           This file
├── css/
│   └── styles.css      ALL styling. Design tokens live in the :root block at top
├── js/
│   ├── config.js       Tunable defaults: start time, alarm sound, confetti
│   ├── timer.js        The countdown clock (no DOM) — the "engine"
│   ├── rectangle.js    The draining bar: orientation + fill direction
│   ├── alarm.js        Gentle chime, generated with the Web Audio API
│   ├── confetti.js     Canvas confetti burst
│   ├── settings.js     User preferences, saved to localStorage
│   └── app.js          The conductor: state machine + wires everything to the UI
└── icons/
    ├── icon-192.png    App icon (any)
    ├── icon-512.png    App icon (any + maskable)
    └── make_icons.py   Regenerates the icons (run: python3 icons/make_icons.py)
```

**Each JS file has one job and talks to the others through small interfaces.**
`app.js` is the only file that touches both the DOM and the other modules; the
rest know nothing about each other. If you keep that boundary, changes stay
local and safe.

---

## 4. How it works (data flow)

```
  buttons ──► app.js (state machine)
                 │  reads editor inputs, decides what to show
                 ├──► timer.js   .start()/.stop()/.reset()/.setDuration()
                 │        │ onTick(remainingMs, fraction)  ~60x/sec
                 │        │ onComplete()                   once, at zero
                 │        ▼
                 ├──► rectangle.js .setFraction(fraction)  → bar height/width
                 ├──► alarm.js     .play()/.stop()         → chime
                 └──► confetti.js  .launch()/.stop()       → canvas burst
```

`timer.js` counts down from a target timestamp (not by counting ticks), so it
stays accurate even if the tab is backgrounded. On every animation frame it
reports `remainingMs` and a `fraction` (1 = full, 0 = empty). `app.js` feeds the
fraction to the bar and the formatted time to the readout.

---

## 5. The state machine (in `app.js`)

States are defined in `timer.js` as `STATE`:

| State     | What's happening            | Editor? | Buttons shown            |
|-----------|-----------------------------|---------|--------------------------|
| `SETUP`   | time is editable, idle      | yes     | Start                    |
| `RUNNING` | counting down               | no      | Stop, Edit, Reset        |
| `PAUSED`  | stopped part-way            | no      | Start (Resume), Edit, Reset |
| `DONE`    | reached zero, celebrating   | no      | Reset only               |

Transitions:
- **Start** (SETUP) reads the editor, sets the duration, begins counting.
- **Start** (PAUSED) resumes from where it stopped.
- **Stop** pauses.
- **Edit** stops the timer and returns to SETUP with the inputs pre-filled, so a
  grown-up can set a new time.
- **Reset** stops everything and refills the bar to the full set duration
  (SETUP). From DONE it also silences the chime and clears the confetti.

The single function `render()` in `app.js` makes the screen match the current
state — change button visibility rules there, in one place.

---

## 6. Orientation & drain direction (in `rectangle.js` + `css/styles.css`)

The brief's rule:

| Device / orientation        | Bar shape   | Drains          |
|-----------------------------|-------------|-----------------|
| Desktop                     | horizontal  | right → left    |
| Mobile, landscape           | horizontal  | right → left    |
| Mobile, portrait            | vertical    | top → bottom    |

"Mobile" is detected with `(hover: none) and (pointer: coarse)` — true for
touch devices, false for desktops — so a desktop stays horizontal even if its
window is taller than wide. The bar becomes **vertical only on a touch device
held in portrait**.

The fill is a `<div>` pinned to one edge; JS sets its size:
- **horizontal:** pinned to the **left**, its `width` shrinks → the right empties first.
- **vertical:** pinned to the **bottom**, its `height` shrinks → the top empties first.

The pinning is done in CSS (`.rectangle.horizontal .fill` /
`.rectangle.vertical .fill`); the live size is set in `rectangle.js` `_render()`.

---

## 7. Common edits — where to go

- **Change the default start time** → `js/config.js` → `defaultMinutes` /
  `defaultSeconds` (also update the `value="..."` attributes in `index.html`
  if you want the very first paint to match before JS runs).
- **Change colours / the juice gradient / roundness** → `css/styles.css`, the
  `:root` token block at the very top (`--juice-1/2/3`, `--start`, `--stop`, etc.).
- **Change the bar's size / proportions** → `css/styles.css`,
  `.rectangle.horizontal` and `.rectangle.vertical`.
- **Change the chime** (notes, length, volume, how often it repeats) →
  `js/config.js` → `alarm`. The sound itself is synthesised in `js/alarm.js`.
- **Change the confetti** (count, duration) → `js/config.js` → `confetti`;
  colours/physics are in `js/confetti.js`.
- **Change the celebration text** → `index.html`, the `.done__text` element
  (and its style/animation in `css/styles.css`).
- **Change button labels or which buttons appear when** → labels in
  `index.html`; visibility logic in `render()` in `js/app.js`.
- **Show/hide numbers (the eye toggle)** → the button (`#eyeToggle`, with two
  inline SVGs) sits in the time row in `index.html`; styling is `.eye` in
  `css/styles.css`; the click handler and `updateEyeToggle()` are in `js/app.js`.
  The preference is stored in `js/settings.js` (`hideNumbersWhileRunning`), and
  the actual hiding is the `hideNumbers` check in `render()`.
- **Bar size** → `.rectangle.horizontal` / `.rectangle.vertical` in
  `css/styles.css`. **Edge spacing** → the `.app` `padding`.
- **Redraw the app icon** → edit colours/shape in `icons/make_icons.py`, then
  `python3 icons/make_icons.py`.

---

## 8. Conventions & gotchas

- **Opens directly — no server needed.** The JS files are plain `<script>`s
  (not ES modules), so the app runs from `file://`. They share a tiny global
  namespace, `window.TT`, and **load order matters**: `index.html` loads
  `config → timer → rectangle → alarm → confetti → settings → app`, with
  `app.js` last because it uses the rest. If you add a new file, add a
  `<script>` for it before `app.js`.
- **Bump the cache version when you edit files.** In `service-worker.js`,
  change `CACHE_VERSION` (e.g. `...-v1` → `...-v2`) whenever you change a cached
  file, and add any *new* file to the `APP_SHELL` list. Otherwise the browser
  may keep serving the old cached version.
- **Audio needs a user gesture.** Browsers block sound until the user interacts.
  We call `alarm.unlock()` on Start/Edit (which are taps) so the chime is
  allowed to play later when the timer ends. Keep that call on at least one
  button if you rework the controls.
- **The bar is driven by JS each frame, not by CSS transitions.** Don't add a
  CSS `transition` to `.fill`'s width/height — it would fight the per-frame
  updates and look laggy.
- **Reduced motion is respected.** Confetti and the bouncing text tone down
  under `prefers-reduced-motion: reduce`. Keep new animations behind that query.
- **Wake lock** keeps the screen awake while running (`navigator.wakeLock`);
  it fails quietly where unsupported. See `requestWakeLock()` in `app.js`.

---

## 9. Ideas / backlog (not built yet)

- Remember the last-used *time* between sessions (settings already persist via
  `js/settings.js` + localStorage; the countdown time could too).
- A few preset buttons (1, 2, 5 min) for one-tap setup.
- Optional picture/emoji theme picker (animals, vehicles) for the bar.
- A choice of chime sounds.

If you add any of these, update sections 3–8 above so this file stays accurate.
