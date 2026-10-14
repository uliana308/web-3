class Sfx {
  constructor(muted) {
    this.muted = muted;
    this.ctx = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null, delay = 0) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise(dur, vol = 0.2) {
    const c = this.ctx;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource();
    const gain = c.createGain();
    gain.gain.value = vol;
    src.buffer = buf;
    src.connect(gain).connect(c.destination);
    src.start();
  }

  play(name) {
    if (this.muted || !this.ctx) return;
    switch (name) {
      case 'jump':    this.tone(360, 0.16, 'square', 0.05, 720); break;
      case 'lane':    this.tone(520, 0.05, 'triangle', 0.05); break;
      case 'coin':    this.tone(988, 0.08, 'square', 0.04); this.tone(1319, 0.14, 'square', 0.04, null, 0.06); break;
      case 'tick':    this.tone(660, 0.12, 'sine', 0.12); break;
      case 'go':      this.tone(990, 0.3, 'sine', 0.14); break;
      case 'correct': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.1, null, i * 0.07)); break;
      case 'wrong':   this.tone(300, 0.35, 'sawtooth', 0.07, 110); break;
      case 'hit':     this.noise(0.25, 0.25); this.tone(140, 0.25, 'sine', 0.2, 60); break;
      case 'over':    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.1, null, i * 0.16)); break;
    }
  }
}
