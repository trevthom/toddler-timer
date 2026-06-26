// confetti.js
// ---------------------------------------------------------------------------
// A small, dependency-free confetti burst drawn on a <canvas>. Call launch()
// when the timer finishes and stop() on reset.
//
// If the user prefers reduced motion, we show a single calm puff instead of a
// long animated shower.
// ---------------------------------------------------------------------------

(function (TT) {
  'use strict';

  const COLORS = ['#FF7A59', '#FFC93C', '#2FBF71', '#4C9AFF', '#8B7BE8', '#FF4D8D'];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  class Confetti {
    /** @param {HTMLCanvasElement} canvas */
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.pieces = [];
      this._rafId = null;
      this._stopAt = 0;
      window.addEventListener('resize', () => this._resize());
    }

    launch({ pieceCount = 140, durationMs = 4500 } = {}) {
      this._resize();
      // Use CSS pixels — the context is already scaled by devicePixelRatio.
      const width = this.canvas.clientWidth;
      const height = this.canvas.clientHeight;
      const count = reduceMotion ? Math.min(40, pieceCount) : pieceCount;

      this.pieces = Array.from({ length: count }, () => ({
        x: width / 2 + (Math.random() - 0.5) * width * 0.3,
        y: height / 2 + (Math.random() - 0.5) * height * 0.2,
        vx: (Math.random() - 0.5) * 14,
        vy: Math.random() * -12 - 4,        // shoot upward, then gravity pulls down
        size: 6 + Math.random() * 8,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.3,
        spin: 0.94 + Math.random() * 0.06,  // wobble factor
      }));

      this._stopAt = performance.now() + (reduceMotion ? 1200 : durationMs);
      if (!this._rafId) this._animate();
    }

    stop() {
      if (this._rafId) cancelAnimationFrame(this._rafId);
      this._rafId = null;
      this.pieces = [];
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // --- internals --------------------------------------------------------

    _resize() {
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = this.canvas.clientWidth * dpr;
      this.canvas.height = this.canvas.clientHeight * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    _animate() {
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      const gravity = 0.32;

      const frame = () => {
        this.ctx.clearRect(0, 0, w, h);
        const settling = performance.now() > this._stopAt;

        for (const p of this.pieces) {
          p.vy += gravity;
          p.x += p.vx * (reduceMotion ? 0.4 : 1);
          p.y += p.vy * (reduceMotion ? 0.4 : 1);
          p.vx *= p.spin;
          p.rot += p.vrot;

          this.ctx.save();
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate(p.rot);
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          this.ctx.restore();
        }

        // Keep going until everything has fallen past the bottom after stop time.
        const allGone = this.pieces.every((p) => p.y > h + 40);
        if (settling && allGone) {
          this.stop();
          return;
        }
        this._rafId = requestAnimationFrame(frame);
      };
      this._rafId = requestAnimationFrame(frame);
    }
  }

  TT.Confetti = Confetti;
})(window.TT = window.TT || {});
