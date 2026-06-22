// app.js
// ---------------------------------------------------------------------------
// The conductor. It owns the small state machine and connects the timer,
// the draining rectangle, the alarm and the confetti to the buttons and
// display. Each piece it talks to lives in its own file, so this stays short.
//
// States (from timer.js): SETUP -> RUNNING <-> PAUSED -> DONE -> (reset) SETUP
//
// Which buttons show in each state:
//   SETUP    editor + Start
//   RUNNING  Stop, Edit, Reset
//   PAUSED   Start (resume), Edit, Reset
//   DONE     Reset only   (+ "All done!" + confetti + chime)
// ---------------------------------------------------------------------------

import { CONFIG } from './config.js';
import { Timer, STATE } from './timer.js';
import { Rectangle } from './rectangle.js';
import { Alarm } from './alarm.js';
import { Confetti } from './confetti.js';
import { settings } from './settings.js';

// --- grab the elements -------------------------------------------------------
const el = (id) => document.getElementById(id);

const rectangleEl = el('rectangle');
const fillEl = el('fill');
const editorEl = el('editor');
const readoutEl = el('readout');
const minutesInput = el('minutesInput');
const secondsInput = el('secondsInput');
const controlsEl = el('controls');
const startBtn = el('startBtn');
const stopBtn = el('stopBtn');
const editBtn = el('editBtn');
const resetBtn = el('resetBtn');
const doneEl = el('done');
const confettiCanvas = el('confetti');

// Settings UI
const gearBtn = el('gearBtn');
const settingsEl = el('settings');
const settingsClose = el('settingsClose');
const hideNumbersToggle = el('hideNumbersToggle');

// --- build the pieces --------------------------------------------------------
const rectangle = new Rectangle(rectangleEl, fillEl);
const alarm = new Alarm(CONFIG.alarm);
const confetti = new Confetti(confettiCanvas);

const timer = new Timer({
  onTick: (remainingMs, fraction) => {
    rectangle.setFraction(fraction);
    readoutEl.textContent = formatTime(remainingMs);
  },
  onComplete: handleComplete,
});

// --- screen wake lock (optional, fails quietly) ------------------------------
let wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch { /* not supported / denied — that's fine */ }
}
function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

// --- helpers -----------------------------------------------------------------
function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function readEditor() {
  const m = clamp(parseInt(minutesInput.value, 10) || 0, 0, CONFIG.maxMinutes);
  const s = clamp(parseInt(secondsInput.value, 10) || 0, 0, CONFIG.maxSeconds);
  return (m * 60 + s) * 1000;
}

function writeEditor(ms) {
  const totalSeconds = Math.round(ms / 1000);
  minutesInput.value = Math.floor(totalSeconds / 60);
  secondsInput.value = String(totalSeconds % 60).padStart(2, '0');
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// --- the one function that makes the UI match the state ----------------------
function render() {
  const s = timer.state;

  // Editor vs big readout.
  const editing = s === STATE.SETUP;
  const started = s === STATE.RUNNING || s === STATE.PAUSED || s === STATE.DONE;
  const hideNumbers = settings.get('hideNumbersWhileRunning') && started;
  editorEl.hidden = !editing;
  readoutEl.hidden = editing || hideNumbers;
  if (!editing && !hideNumbers) readoutEl.textContent = formatTime(timer.remainingMs);

  // Button visibility.
  show(startBtn, s === STATE.SETUP || s === STATE.PAUSED);
  show(stopBtn, s === STATE.RUNNING);
  show(editBtn, s === STATE.RUNNING || s === STATE.PAUSED);
  show(resetBtn, s !== STATE.SETUP); // hidden only on the first setup screen
  startBtn.textContent = s === STATE.PAUSED ? 'Resume' : 'Start';

  // Celebration layer.
  const done = s === STATE.DONE;
  doneEl.hidden = !done;
  controlsEl.classList.toggle('controls--done', done);

  if (done) resetBtn.focus();
}

function show(node, visible) { node.hidden = !visible; }

// --- button actions ----------------------------------------------------------
function onStart() {
  alarm.unlock(); // we have a user gesture, so audio is allowed later
  if (timer.state === STATE.SETUP) {
    const ms = readEditor();
    if (ms <= 0) { nudgeEditor(); return; }
    timer.setDuration(ms);
  }
  timer.start();
  requestWakeLock();
  render();
}

function onStop() {
  timer.stop();
  releaseWakeLock();
  render();
}

function onEdit() {
  alarm.unlock();
  timer.stop();              // stop if running (no-op otherwise)
  releaseWakeLock();
  writeEditor(timer.totalMs); // prefill with the time that was set
  timer.setDuration(timer.totalMs); // back to SETUP, full bar
  rectangle.setFraction(1);
  render();
  minutesInput.focus();
  minutesInput.select();
}

function onReset() {
  alarm.stop();
  confetti.stop();
  releaseWakeLock();
  timer.reset();             // refill to the full set duration, SETUP
  rectangle.setFraction(1);
  writeEditor(timer.totalMs);
  render();
  startBtn.focus();
}

function handleComplete() {
  rectangle.setFraction(0);
  readoutEl.textContent = formatTime(0);
  releaseWakeLock();
  render();
  alarm.play();
  confetti.launch(CONFIG.confetti);
}

function nudgeEditor() {
  editorEl.classList.remove('editor--nudge');
  // force reflow so the animation can replay
  void editorEl.offsetWidth;
  editorEl.classList.add('editor--nudge');
  minutesInput.focus();
}

// --- settings dialog ---------------------------------------------------------
function openSettings() {
  hideNumbersToggle.checked = settings.get('hideNumbersWhileRunning');
  settingsEl.hidden = false;
  settingsClose.focus();
}

function closeSettings() {
  settingsEl.hidden = true;
  gearBtn.focus();
}

// --- listeners ---------------------------------------------------------------
startBtn.addEventListener('click', onStart);
stopBtn.addEventListener('click', onStop);
editBtn.addEventListener('click', onEdit);
resetBtn.addEventListener('click', onReset);

// Enter inside an input starts the timer (handy on desktop).
[minutesInput, secondsInput].forEach((input) => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onStart(); }
  });
  // Tidy up the value when the field loses focus.
  input.addEventListener('blur', () => writeEditor(readEditor()));
});

// Re-release the wake lock if the tab is hidden, re-acquire when visible+running.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && timer.state === STATE.RUNNING) {
    requestWakeLock();
  }
});

// Settings.
gearBtn.addEventListener('click', openSettings);
settingsClose.addEventListener('click', closeSettings);
// Tapping the dark backdrop (but not the panel) closes the dialog.
settingsEl.addEventListener('click', (e) => {
  if (e.target === settingsEl) closeSettings();
});
hideNumbersToggle.addEventListener('change', () => {
  settings.set('hideNumbersWhileRunning', hideNumbersToggle.checked);
  render();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !settingsEl.hidden) closeSettings();
});

// --- start it up -------------------------------------------------------------
timer.setDuration((CONFIG.defaultMinutes * 60 + CONFIG.defaultSeconds) * 1000);
writeEditor(timer.totalMs);
rectangle.setFraction(1);
hideNumbersToggle.checked = settings.get('hideNumbersWhileRunning');
render();
