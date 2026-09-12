// audio.js — short beeps for timer transitions, using the Web Audio API.
// No sound files needed. If audio fails for any reason (unsupported
// browser, autoplay restrictions), we just silently skip it — a missed
// beep should never break a timer.

const AudioCue = {
  ctx: null,

  ensureContext() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  },

  beep(frequency = 880, durationMs = 150, volume = 0.35) {
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      osc.start(now);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
      osc.stop(now + durationMs / 1000 + 0.02);
    } catch (e) {
      // ignore — audio is a nice-to-have, never block the workout on it
    }
  },

  // A single cue tone (used for "work starting", per-minute EMOM cues, etc).
  cue() {
    this.beep(880, 150);
  },

  // A lower, softer tone for "rest starting".
  restCue() {
    this.beep(440, 150);
  },

  // A two-tone cue for "this whole block/segment is done".
  doneCue() {
    this.beep(880, 120);
    setTimeout(() => this.beep(1180, 200), 160);
  }
};
