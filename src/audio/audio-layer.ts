// ---------------------------------------------------------------------------
// Audio Impulse Layer
//
// Manages a shared AudioContext and plays impulse buffers on demand.
// Must be unlock()'d from a user gesture before audio can play on iOS.
// ---------------------------------------------------------------------------

import type { EasingFn, ImpulseType, Vibration } from "../core";
import { ImpulseLibrary } from "./impulse-library";

export class AudioImpulseLayer {
  private ctx: AudioContext | null = null;
  private lib: ImpulseLibrary | null = null;
  private mg: number;
  private unlocked = false;

  constructor(gain: number = 0.6) {
    this.mg = gain;
  }

  /** Play a silent buffer to unlock the AudioContext (call from user gesture). */
  unlock(): void {
    if (this.unlocked) return;
    try {
      const ctx = this.ensureCtx();
      const b = ctx.createBuffer(1, 1, ctx.sampleRate);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
      if (ctx.state === "suspended") void ctx.resume();
      this.unlocked = true;
    } catch {}
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.lib = new ImpulseLibrary(this.ctx);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Play a single impulse at the given intensity. */
  fire(type: ImpulseType, intensity: number): void {
    try {
      const ctx = this.ensureCtx();
      if (!this.lib) return;
      const buf = this.lib.get(type);
      if (!buf) return;
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buf;
      gain.gain.value = intensity * this.mg;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
    } catch {}
  }

  /** Play a sequence of impulses matching a Vibration[] pattern. */
  fireSequence(vibs: Vibration[], type: ImpulseType, intensity: number, ef?: EasingFn): void {
    let elapsed = 0;
    const count = vibs.length;
    for (let i = 0; i < count; i++) {
      const v = vibs[i];
      const delay = elapsed + (v.delay ?? 0);
      const si = v.intensity ?? intensity;
      const pr = count > 1 ? i / (count - 1) : 1;
      const ei = ef ? si * Math.max(0.1, ef(pr)) : si;
      if (delay <= 0) this.fire(type, ei);
      else setTimeout(() => this.fire(type, ei), delay);
      elapsed = delay + v.duration;
    }
  }

  setGain(g: number): void {
    this.mg = Math.max(0, Math.min(1, g));
  }
  destroy(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.lib = null;
  }
}
