// settings.js
// ---------------------------------------------------------------------------
// Small store for user preferences. Tries to save to localStorage so choices
// stick between sessions. If storage is unavailable (some browsers restrict it
// when the page is opened directly from a file), it falls back to in-memory
// only and never throws — the setting still works for the current session.
//
//   TT.settings.get('hideNumbersWhileRunning')   -> boolean
//   TT.settings.set('hideNumbersWhileRunning', true)
//
// Add a new preference by giving it a default in DEFAULTS below.
// ---------------------------------------------------------------------------

(function (TT) {
  'use strict';

  const STORAGE_KEY = 'toddler-timer-settings';

  const DEFAULTS = {
    // When on, the mm:ss readout is hidden once the timer is started, so only
    // the draining bar is visible.
    hideNumbersWhileRunning: false,
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...DEFAULTS, ...saved };
    } catch {
      return { ...DEFAULTS };
    }
  }

  let state = load();

  TT.DEFAULTS = DEFAULTS;
  TT.settings = {
    get(key) { return state[key]; },
    set(key, value) {
      state[key] = value;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
    },
    all() { return { ...state }; },
  };
})(window.TT = window.TT || {});
