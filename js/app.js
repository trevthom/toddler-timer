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
//
// This file is loaded LAST (see the <script> order in index.html), so every
// piece it pulls from the shared `TT` namespace is already in place.
// ---------------------------------------------------------------------------

(function (TT) {
  'use strict';

  const { CONFIG, Timer, STATE, Rectangle, Alarm, Confetti, settings } = TT;

  // --- grab the elements -----------------------------------------------------
  const el = (id) => document.getElementById(id);

  const modeSwitchEl = el('modeSwitch');
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

  // Show/hide-numbers toggle (the eye next to the numbers)
  const eyeToggle = el('eyeToggle');

  // Mode switch: count down an amount of time, or to a time of day.
  const modeTimerBtn = el('modeTimer');
  const modeClockBtn = el('modeClock');
  const clockGroup = el('clockGroup');
  const clockInput = el('clockInput');
  const minutesGroup = el('minutesGroup');
  const secondsGroup = el('secondsGroup');
  const colonEl = el('editorColon');
  const clockHint = el('clockHint');

  // --- build the pieces ------------------------------------------------------
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

  // --- screen wake lock (optional, fails quietly) ----------------------------
  let wakeLock = null;
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch { /* not supported / denied — that's fine */ }
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }

  // --- helpers ---------------------------------------------------------------
  function formatTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  // --- mode: 'timer' (count down an amount) or 'clock' (count down TO a time of day)
  function mode() { return settings.get('timerMode'); }

  function setMode(next) {
    settings.set('timerMode', next);
    modeTimerBtn.classList.toggle('is-active', next === 'timer');
    modeClockBtn.classList.toggle('is-active', next === 'clock');
    modeTimerBtn.setAttribute('aria-selected', String(next === 'timer'));
    modeClockBtn.setAttribute('aria-selected', String(next === 'clock'));
    // Timer mode: minutes/seconds fields. Clock mode: ONLY the time picker.
    const isTimer = next === 'timer';
    minutesGroup.hidden = !isTimer;
    colonEl.hidden = !isTimer;
    secondsGroup.hidden = !isTimer;
    clockGroup.hidden = isTimer;
    if (isTimer) minutesInput.disabled = secondsInput.disabled = false;
  }

  // Time of day selected in the clock picker, as minutes since midnight.
  function readClockMinutes() {
    const [h, m] = (clockInput.value || '').split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  function writeClockMinutes(mins) {
    if (mins == null) return;
    clockInput.value =
      String(Math.floor(mins / 60) % 24).padStart(2, '0') + ':' +
      String(mins % 60).padStart(2, '0');
  }

  // Milliseconds from now until the next occurrence of the chosen time of day
  // (wraps past midnight, e.g. 23:50 -> 00:10 counts 20 minutes).
  function msUntilTimeOfDay(minsOfDay) {
    const now = new Date();
    const target = new Date(now);
    target.setHours(Math.floor(minsOfDay / 60), minsOfDay % 60, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1); // already passed today
    return target.getTime() - now.getTime();
  }

  function readEditor() {
    if (mode() === 'clock') {
      const mins = readClockMinutes();
      return mins == null ? 0 : msUntilTimeOfDay(mins);
    }
    const m = clamp(parseInt(minutesInput.value, 10) || 0, 0, CONFIG.maxMinutes);
    const s = clamp(parseInt(secondsInput.value, 10) || 0, 0, CONFIG.maxSeconds);
    return (m * 60 + s) * 1000;
  }

  function writeEditor(ms) {
    if (mode() === 'clock') return; // the clock picker shows a time, not a duration
    const totalSeconds = Math.round(ms / 1000);
    minutesInput.value = Math.floor(totalSeconds / 60);
    secondsInput.value = String(totalSeconds % 60).padStart(2, '0');
  }

  // --- the one function that makes the UI match the state --------------------
  function render() {
    const s = timer.state;

    // Editor vs big readout.
    const editing = s === STATE.SETUP;
    const started = s === STATE.RUNNING || s === STATE.PAUSED || s === STATE.DONE;
    const hideNumbers = settings.get('hideNumbersWhileRunning') && started;
    editorEl.hidden = !editing;
    modeSwitchEl.hidden = !editing;   // the Timer/Clock switch only shows while editing
    readoutEl.hidden = editing || hideNumbers;
    if (!editing && !hideNumbers) readoutEl.textContent = formatTime(timer.remainingMs);
    if (editing) updateClockHint();

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

  // --- button actions --------------------------------------------------------
  function onStart() {
    alarm.unlock(); // we have a user gesture, so audio is allowed later
    if (timer.state === STATE.SETUP) {
      if (mode() === 'clock') {
        const mins = readClockMinutes();
        if (mins == null) { nudgeClock(); return; }
        settings.set('lastClockTime', mins); // remember for next session
        timer.setDuration(msUntilTimeOfDay(mins));
      } else {
        const ms = readEditor();
        if (ms <= 0) { nudgeEditor(); return; }
        timer.setDuration(ms);
      }
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
    timer.setDuration(timer.totalMs); // back to SETUP, full bar
    rectangle.setFraction(1);
    render();
    if (mode() === 'clock') {
      clockInput.focus();
    } else {
      writeEditor(timer.totalMs); // prefill with the time that was set
      minutesInput.focus();
      minutesInput.select();
    }
  }

  function onReset() {
    alarm.stop();
    confetti.stop();
    releaseWakeLock();
    timer.reset();             // refill to the full set duration, SETUP
    rectangle.setFraction(1);
    if (mode() === 'timer') writeEditor(timer.totalMs);
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

  function nudgeClock() {
    editorEl.classList.remove('editor--nudge');
    void editorEl.offsetWidth;
    editorEl.classList.add('editor--nudge');
    clockInput.focus();
  }

  // Live hint under the clock picker: how much time Start will load right now.
  function updateClockHint() {
    if (mode() !== 'clock') { clockHint.hidden = true; return; }
    const mins = readClockMinutes();
    if (mins == null) {
      clockHint.textContent = 'Pick a time of day, then press Start.';
      return;
    }
    clockHint.hidden = false;
    clockHint.textContent = 'Start counts down ' + formatTime(msUntilTimeOfDay(mins)) + ' from now.';
  }

  // Keep the hint live while editing in clock mode.
  setInterval(() => {
    if (timer.state === STATE.SETUP && mode() === 'clock' && !clockHint.hidden) updateClockHint();
  }, 1000);

  // --- show/hide-numbers eye toggle ------------------------------------------
  // Reflects the current setting: eye open = numbers show while running;
  // eye with a slash = numbers hidden while running.
  function updateEyeToggle() {
    const hidden = settings.get('hideNumbersWhileRunning');
    eyeToggle.classList.toggle('is-hidden', hidden);
    eyeToggle.setAttribute('aria-pressed', String(hidden));
    const label = hidden
      ? 'Show the numbers while the timer runs'
      : 'Hide the numbers while the timer runs';
    eyeToggle.setAttribute('aria-label', label);
    eyeToggle.setAttribute('title', label);
  }

  // --- listeners -------------------------------------------------------------
  startBtn.addEventListener('click', onStart);
  stopBtn.addEventListener('click', onStop);
  editBtn.addEventListener('click', onEdit);
  resetBtn.addEventListener('click', onReset);

  // Enter inside an input starts the timer (handy on desktop).
  [minutesInput, secondsInput, clockInput].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onStart(); }
    });
    // Keep entries to digits only, at most two of them (live, also catches paste).
    input.addEventListener('input', () => {
      if (input === clockInput) return; // the time picker keeps its own format
      const capped = input.value.replace(/\D/g, '').slice(0, 2);
      if (capped !== input.value) input.value = capped;
    });
    // Tidy up the value when the field loses focus.
    if (input !== clockInput) {
      input.addEventListener('blur', () => writeEditor(readEditor()));
    }
  });

  // Timer/Clock mode switch.
  modeTimerBtn.addEventListener('click', () => {
    setMode('timer');
    writeEditor(readEditor());
    minutesInput.focus();
  });
  modeClockBtn.addEventListener('click', () => {
    setMode('clock');
    // Restore the last time of day used, if there was one.
    const saved = settings.get('lastClockTime');
    if (saved != null) writeClockMinutes(saved);
    updateClockHint();
    clockInput.focus();
  });

  // Update the hint whenever the chosen time changes.
  clockInput.addEventListener('input', updateClockHint);

  // Re-release the wake lock if the tab is hidden, re-acquire when visible+running.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && timer.state === STATE.RUNNING) {
      requestWakeLock();
    }
  });

  // Show/hide numbers toggle.
  eyeToggle.addEventListener('click', () => {
    const next = !settings.get('hideNumbersWhileRunning');
    settings.set('hideNumbersWhileRunning', next);
    updateEyeToggle();
    render();
  });

  // --- start it up -----------------------------------------------------------
  timer.setDuration((CONFIG.defaultMinutes * 60 + CONFIG.defaultSeconds) * 1000);
  writeEditor(timer.totalMs);
  rectangle.setFraction(1);
  updateEyeToggle();
  setMode(settings.get('timerMode') === 'clock' ? 'clock' : 'timer');
  if (settings.get('timerMode') === 'clock') {
    const saved = settings.get('lastClockTime');
    if (saved != null) writeClockMinutes(saved);
  }
  render();
})(window.TT = window.TT || {});
