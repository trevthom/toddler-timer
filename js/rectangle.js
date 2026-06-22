// rectangle.js
// ---------------------------------------------------------------------------
// The big visual bar — the "juice tank" that drains as time runs out.
//
// Orientation rule (matches the brief):
//   * Desktop                -> horizontal bar (wider than tall)
//   * Mobile, held landscape -> horizontal bar
//   * Mobile, held portrait  -> vertical bar (taller than wide)
//
// Drain direction:
//   * Horizontal -> empties RIGHT to LEFT (fill is pinned to the left edge,
//                   its right side recedes leftward).
//   * Vertical   -> empties TOP to BOTTOM (fill is pinned to the bottom edge,
//                   like a liquid level dropping).
//
// We decide "mobile" with the (hover: none) + (pointer: coarse) media query,
// which is true for touch devices and false for desktops. That keeps a desktop
// horizontal even if its window happens to be taller than it is wide.
// ---------------------------------------------------------------------------

const mqMobile = window.matchMedia('(hover: none) and (pointer: coarse)');
const mqPortrait = window.matchMedia('(orientation: portrait)');

export function isVerticalLayout() {
  return mqMobile.matches && mqPortrait.matches;
}

export class Rectangle {
  /**
   * @param {HTMLElement} frameEl  the bordered container
   * @param {HTMLElement} fillEl   the coloured fill inside it
   */
  constructor(frameEl, fillEl) {
    this.frameEl = frameEl;
    this.fillEl = fillEl;
    this.fraction = 1;          // 1 = full, 0 = empty
    this._vertical = isVerticalLayout();
    this._applyOrientation();

    // Re-evaluate whenever the device is rotated or the window resized.
    const onChange = () => this.refreshOrientation();
    mqMobile.addEventListener('change', onChange);
    mqPortrait.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
  }

  /** Set how full the bar is. fraction: 1 = full, 0 = empty. */
  setFraction(fraction) {
    this.fraction = Math.max(0, Math.min(1, fraction));
    this._render();
  }

  /** Re-check orientation; re-render the fill to match if it changed. */
  refreshOrientation() {
    const next = isVerticalLayout();
    if (next !== this._vertical) {
      this._vertical = next;
      this._applyOrientation();
    }
    this._render();
  }

  _applyOrientation() {
    this.frameEl.classList.toggle('vertical', this._vertical);
    this.frameEl.classList.toggle('horizontal', !this._vertical);
  }

  _render() {
    const pct = this.fraction * 100;
    if (this._vertical) {
      // pinned to the bottom (see CSS); height shrinks => top empties first
      this.fillEl.style.width = '100%';
      this.fillEl.style.height = pct + '%';
    } else {
      // pinned to the left (see CSS); width shrinks => right empties first
      this.fillEl.style.height = '100%';
      this.fillEl.style.width = pct + '%';
    }
  }
}
