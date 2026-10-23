// ============================================================================
// THE LAST EXORCISM - Procedural audio (WebAudio). No external assets needed.
// All sounds are synthesised: drones, heartbeats, footsteps, stingers, whispers.
// Voice lines are spoken via SpeechSynthesis with AUTHORED in-game text only
// (never real players' microphones).
// ============================================================================

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private droneNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  volumes = { master: 0.8, sfx: 0.9, music: 0.7 };

  /** Must be called from a user gesture (click/tap). */
  init() {
    if (this.started) return;
    try {
      this.ctx = new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyVolumes();
      this.started = true;
      this.startAmbientDrone();
    } catch (e) {
      console.warn('audio unavailable', e);
    }
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.sfxBus.gain.value = this.volumes.sfx;
    this.musicBus.gain.value = this.volumes.music * 0.5;
  }

  resume() {
    this.ctx?.resume();
  }

  private noiseBuffer(seconds = 1): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---- ambience: low detuned drone + wind-like filtered noise ----
  private startAmbientDrone() {
    if (!this.ctx) return;
    const freqs = [36.7, 55, 73.4];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.detune.value = (Math.random() - 0.5) * 22;
      const g = this.ctx.createGain();
      g.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.07 + Math.random() * 0.05;
      const lg = this.ctx.createGain();
      lg.gain.value = 0.02;
      lfo.connect(lg).connect(g.gain);
      osc.connect(g).connect(this.musicBus);
      osc.start();
      lfo.start();
      this.droneNodes.push({ osc, gain: g });
    }
    // wind
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(3);
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 300;
    filt.Q.value = 0.5;
    const g = this.ctx.createGain();
    g.gain.value = 0.018;
    src.connect(filt).connect(g).connect(this.musicBus);
    src.start();
  }

  setTension(t: number) {
    // t 0..1 -> raise drone dissonance & volume
    if (!this.ctx) return;
    this.droneNodes.forEach((d, i) => {
      d.gain.gain.setTargetAtTime(0.04 + t * 0.05, this.ctx!.currentTime, 0.5);
      d.osc.detune.setTargetAtTime((i % 2 ? 1 : -1) * t * 35, this.ctx!.currentTime, 0.5);
    });
  }

  // ---- one-shots ----
  footstep(crouch = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.1);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = crouch ? 240 : 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(crouch ? 0.05 : 0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start();
  }

  knifeDrag() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(900, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.7);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400;
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(f).connect(g).connect(this.sfxBus);
    osc.start();
    osc.stop(ctx.currentTime + 0.85);
  }

  door(creaky = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = creaky ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(creaky ? 220 : 70, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(creaky ? 90 : 40, ctx.currentTime + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(g).connect(this.sfxBus);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  }

  pickup() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(g).connect(this.sfxBus);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  page() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.2);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start();
  }

  stinger() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200 + i * 350 + Math.random() * 200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.09, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
      osc.connect(g).connect(this.sfxBus);
      osc.start();
      osc.stop(ctx.currentTime + 1.05);
    }
  }

  radioStatic(seconds = 1.2) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(seconds);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07, ctx.currentTime);
    g.gain.setValueAtTime(0.07, ctx.currentTime + seconds - 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start();
  }

  sealChime() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    [523, 784, 1046].forEach((fr, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = fr;
      const g = ctx.createGain();
      const t0 = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.8);
      osc.connect(g).connect(this.sfxBus);
      osc.start(t0);
      osc.stop(t0 + 0.9);
    });
  }

  whisper() {
    // breathy filtered noise "voice" - no real speech content
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(1.4);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(900, ctx.currentTime);
    f.frequency.linearRampToValueAtTime(1600, ctx.currentTime + 0.7);
    f.frequency.linearRampToValueAtTime(700, ctx.currentTime + 1.3);
    f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 0.3);
    g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.35);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start();
  }

  heartbeat(rate: number) {
    // rate bpm; 0 stops
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (rate <= 0 || !this.ctx) return;
    const beat = () => {
      const ctx = this.ctx!;
      const thump = (t: number, v: number) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(55, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.14);
        const g = ctx.createGain();
        g.gain.setValueAtTime(v, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(g).connect(this.sfxBus);
        osc.start(t);
        osc.stop(t + 0.2);
      };
      const t0 = ctx.currentTime;
      thump(t0, 0.22);
      thump(t0 + 0.22, 0.14);
    };
    this.heartbeatTimer = setInterval(beat, 60000 / rate);
    beat();
  }

  /** Speak authored in-game lines using the browser's TTS (licensed system voices). */
  speak(line: string, opts: { rate?: number; pitch?: number; pan?: number } = {}) {
    if (!('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(line);
      u.rate = opts.rate ?? 0.85;
      u.pitch = opts.pitch ?? 0.4;
      u.volume = Math.min(1, this.volumes.master * this.volumes.sfx);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      /* TTS optional */
    }
  }
}

export const audio = new AudioEngine();
