// timer.js
// ---------------------------------------------------------------------------
// A small, self-contained countdown clock. It knows nothing about the DOM —
// it just counts down and calls you back. That separation is what makes the
// rest of the app easy to change.
//
//   const t = new TT.Timer({
//     onTick:     (remainingMs, fraction) => { ... },  // ~60x/sec while running
//     onComplete: () => { ... },                       // fired once at zero
//   });
//   t.setDuration(5 * 60 * 1000);  // 5 minutes
//   t.start();   t.stop();   t.reset();
//
// "fraction" is remaining / total (1 = full, 0 = empty) — handy for the bar.
// We drive the loop from timestamps (not by counting intervals) so the timer
// stays accurate even if the browser throttles background tabs.
// ---------------------------------------------------------------------------

(function (TT) {
  'use strict';

  const STATE = Object.freeze({
    SETUP: 'setup',     // time is editable, nothing running
    RUNNING: 'running', // counting down
    PAUSED: 'paused',   // stopped part-way through
    DONE: 'done',       // reached zero
  });

  class Timer {
    constructor({ onTick, onComplete } = {}) {
      this.onTick = onTick || (() => {});
      this.onComplete = onComplete || (() => {});

      this.totalMs = 0;       // the full duration that was set
      this.remainingMs = 0;   // time left right now
      this.endTime = 0;       // performance.now() value when we hit zero
      this.state = STATE.SETUP;
      this._rafId = null;
    }

    /** Set a fresh duration. Puts the timer back into SETUP, full bar. */
    setDuration(ms) {
      this._cancelLoop();
      this.totalMs = Math.max(0, Math.round(ms));
      this.remainingMs = this.totalMs;
      this.state = STATE.SETUP;
      this._emitTick();
    }

    /** Begin (or resume) counting down. */
    start() {
      if (this.state === STATE.RUNNING) return;
      if (this.remainingMs <= 0) return; // nothing to count
      this.endTime = performance.now() + this.remainingMs;
      this.state = STATE.RUNNING;
      this._loop();
    }

    /** Pause where we are. Can be resumed with start(). */
    stop() {
      if (this.state !== STATE.RUNNING) return;
      this._cancelLoop();
      this.remainingMs = Math.max(0, this.endTime - performance.now());
      this.state = STATE.PAUSED;
      this._emitTick();
    }

    /** Stop and refill back to the full set duration. */
    reset() {
      this._cancelLoop();
      this.remainingMs = this.totalMs;
      this.state = STATE.SETUP;
      this._emitTick();
    }

    get fraction() {
      if (this.totalMs <= 0) return 0;
      return Math.max(0, Math.min(1, this.remainingMs / this.totalMs));
    }

    // --- internals --------------------------------------------------------

    _loop() {
      const tick = () => {
        this.remainingMs = Math.max(0, this.endTime - performance.now());
        this._emitTick();
        if (this.remainingMs <= 0) {
          this._cancelLoop();
          this.state = STATE.DONE;
          this.onComplete();
          return;
        }
        this._rafId = requestAnimationFrame(tick);
      };
      this._rafId = requestAnimationFrame(tick);
    }

    _emitTick() {
      this.onTick(this.remainingMs, this.fraction);
    }

    _cancelLoop() {
      if (this._rafId !== null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
    }
  }

  TT.STATE = STATE;
  TT.Timer = Timer;
})(window.TT = window.TT || {});
