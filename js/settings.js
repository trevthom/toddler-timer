// settings.js
// ---------------------------------------------------------------------------
// Small store for user preferences. Saves to localStorage so choices stick
// between sessions (works in the served PWA and inside the native app). If
// storage is unavailable for any reason, it falls back to in-memory only and
// never throws.
//
//   settings.get('hideNumbersWhileRunning')   -> boolean
//   settings.set('hideNumbersWhileRunning', true)
//
// Add a new preference by giving it a default in DEFAULTS below.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'toddler-timer-settings';

export const DEFAULTS = {
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

export const settings = {
  get(key) { return state[key]; },
  set(key, value) {
    state[key] = value;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  },
  all() { return { ...state }; },
};
