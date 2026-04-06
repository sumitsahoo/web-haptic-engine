// ---------------------------------------------------------------------------
// Impulse Buffer Synthesizer
//
// Generates short AudioBuffers for each impulse type. Each waveform is a
// combination of exponentially-decayed sine waves designed to mimic the
// feel of physical haptic feedback through speakers/headphones.
// ---------------------------------------------------------------------------

export class ImpulseLibrary {
  private buffers: Map<string, AudioBuffer> = new Map();
  constructor(private ctx: AudioContext) {
    this.build();
  }

  private build(): void {
    const sr = this.ctx.sampleRate;
    this.mk("tick", sr, 0.008, (t) => {
      const e = Math.exp(-t * 600);
      return Math.sin(2 * Math.PI * 320 * t) * e + Math.sin(2 * Math.PI * 800 * t) * e * 0.15;
    });
    this.mk("tap", sr, 0.02, (t) => {
      const e = Math.exp(-t * 250);
      return (
        Math.sin(2 * Math.PI * 220 * t) * e +
        (t < 0.001 ? Math.sin(2 * Math.PI * 800 * t) * (1 - t / 0.001) * 0.4 : 0) +
        Math.sin(2 * Math.PI * 110 * t) * e * 0.3
      );
    });
    this.mk("thud", sr, 0.035, (t) => {
      const e = Math.exp(-t * 150);
      return (
        Math.sin(2 * Math.PI * 160 * t) * e +
        Math.sin(2 * Math.PI * 80 * t) * e * 0.5 +
        (t < 0.002 ? Math.sin(2 * Math.PI * 600 * t) * (1 - t / 0.002) * 0.3 : 0)
      );
    });
    this.mk("click", sr, 0.005, (t) => {
      const e = Math.exp(-t * 1200);
      return Math.sin(2 * Math.PI * 400 * t) * e + Math.sin(2 * Math.PI * 1200 * t) * e * 0.1;
    });
    this.mk("snap", sr, 0.01, (t) => {
      const e = Math.exp(-t * 500);
      return Math.sin(2 * Math.PI * 500 * t) * e + Math.sin(2 * Math.PI * 1380 * t) * e * 0.2;
    });
    this.mk("buzz", sr, 0.06, (t) => {
      const e = Math.exp(-t * 40);
      let s = 0;
      for (let h = 1; h <= 5; h++) s += Math.sin(2 * Math.PI * 200 * h * t) / h;
      return s * e * 0.4;
    });
    this.mk("confirm", sr, 0.025, (t) => {
      const e = Math.exp(-t * 200);
      return (Math.sin(2 * Math.PI * 280 * t) * 0.6 + Math.sin(2 * Math.PI * 420 * t) * 0.4) * e;
    });
    this.mk("harsh", sr, 0.03, (t) => {
      const f = 180,
        e = Math.exp(-t * 160);
      let s = 0;
      for (let h = 1; h <= 6; h++)
        s += (Math.sin(2 * Math.PI * f * h * t) * (h % 2 === 0 ? 0.8 : 1)) / h;
      return (s + Math.sin(2 * Math.PI * f * 1.07 * t) * e * 0.3) * e * 0.35;
    });
  }

  /** Synthesize a named impulse buffer: peak-normalize samples from fn(t). */
  private mk(name: string, sr: number, dur: number, fn: (t: number) => number): void {
    const len = Math.ceil(sr * dur),
      buf = this.ctx.createBuffer(1, len, sr),
      d = buf.getChannelData(0);
    let pk = 0;
    for (let i = 0; i < len; i++) {
      d[i] = fn(i / sr);
      pk = Math.max(pk, Math.abs(d[i]));
    }
    if (pk > 0) for (let i = 0; i < len; i++) d[i] /= pk;
    this.buffers.set(name, buf);
  }

  get(name: string): AudioBuffer | undefined {
    return this.buffers.get(name);
  }
}
