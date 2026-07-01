// Tiny WebAudio SFX. No assets — everything is synthesized. The AudioContext is
// created lazily on the first user gesture (the Start button) to satisfy browser
// autoplay policies.
export class Audio {
  constructor() { this.ctx = null; this.muted = false; }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _tone(freq, dur, type = 'sine', gain = 0.15, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  blip()      { this._tone(520, 0.06, 'square', 0.05); }
  progress()  { this._tone(300, 0.05, 'sine', 0.04); }
  success()   { this._tone(523, 0.12, 'triangle', 0.16); setTimeout(() => this._tone(784, 0.16, 'triangle', 0.16), 90); }
  fish()      { this._tone(880, 0.08, 'sine', 0.12, 1320); }
  sabotage()  { this._tone(160, 0.25, 'sawtooth', 0.16, 70); }
  alarm()     { this._tone(440, 0.3, 'square', 0.12, 220); }
  win()       { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.18, 'triangle', 0.16), i * 130)); }
  lose()      { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this._tone(f, 0.22, 'sawtooth', 0.14), i * 150)); }
}
