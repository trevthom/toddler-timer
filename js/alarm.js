// alarm.js
// ---------------------------------------------------------------------------
// A gentle chime, generated on the fly with the Web Audio API so there's no
// sound file to ship and it works fully offline.
//
// Browsers only allow audio after a user gesture, so call unlock() from a
// click handler (we do it on Start/Edit). play() then loops a soft chime
// until stop() is called.
// ---------------------------------------------------------------------------

export class Alarm {
  constructor(settings) {
    this.settings = settings;     // CONFIG.alarm
    this.ctx = null;
    this._timeoutId = null;
    this._playing = false;
  }

  /** Create/resume the audio context. Safe to call from a click handler. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;            // no Web Audio support; fail quietly
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** Start the gentle, repeating chime. */
  play() {
    this.unlock();
    if (!this.ctx || this._playing) return;
    this._playing = true;
    this._scheduleChime();
  }

  /** Stop and silence the chime. */
  stop() {
    this._playing = false;
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  }

  // --- internals ----------------------------------------------------------

  _scheduleChime() {
    if (!this._playing || !this.ctx) return;
    const { notes, noteDuration, gapBetweenChimes, volume } = this.settings;
    const now = this.ctx.currentTime;

    notes.forEach((freq, i) => {
      const start = now + i * noteDuration;
      this._playNote(freq, start, noteDuration, volume);
    });

    // Repeat after the chime finishes plus the configured gap.
    const cycleMs = (notes.length * noteDuration + gapBetweenChimes) * 1000;
    this._timeoutId = setTimeout(() => this._scheduleChime(), cycleMs);
  }

  _playNote(freq, startTime, duration, volume) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';               // soft, rounded tone
    osc.frequency.value = freq;

    // Gentle fade in and out so it never sounds harsh.
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.06);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }
}
