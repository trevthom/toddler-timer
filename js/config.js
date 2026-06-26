// config.js
// ---------------------------------------------------------------------------
// All the knobs you're most likely to want to change live here, so you can
// tweak the app without digging through the logic. Colours live in
// css/styles.css (look for the :root block at the top).
//
// Loaded as a plain <script> (not an ES module) so the app can be opened
// straight from index.html with no server. Each file adds what it provides to
// the shared `window.TT` namespace.
// ---------------------------------------------------------------------------

(function (TT) {
  'use strict';

  TT.CONFIG = {
    // The time shown the first time the app opens, and after a fresh Reset
    // when no other time has been set yet.
    defaultMinutes: 5,
    defaultSeconds: 0,

    // Input limits for the editor.
    maxMinutes: 99,
    maxSeconds: 59,

    // Gentle alarm (generated with the Web Audio API, no sound file needed).
    alarm: {
      // The little chime is these notes, played in order, then it pauses and
      // repeats until Reset is pressed. Frequencies are in Hz.
      notes: [523.25, 659.25, 783.99], // C5, E5, G5 — a soft major chord
      noteDuration: 0.45,    // seconds each note rings
      gapBetweenChimes: 1.6, // seconds of quiet before the chime repeats
      volume: 0.18,          // 0..1, kept low so it stays gentle
    },

    // Confetti finale.
    confetti: {
      pieceCount: 140,  // how many confetti pieces in the burst
      durationMs: 4500, // how long pieces keep falling before settling
    },
  };
})(window.TT = window.TT || {});
