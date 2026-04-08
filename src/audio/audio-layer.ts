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
  /** Active AudioBufferSourceNodes from the current sequence, for cancellation. */
  private activeSources: AudioBufferSourceNode[] = [];

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

  /**
   * Play a sequence of impulses matching a Vibration[] pattern.
   *
   * Short segments (≤ 1.5× impulse length) fire a single impulse.
   * Long segments use a single looping AudioBufferSourceNode with precise
   * start/stop times — one node per segment instead of dozens, reliable
   * on iOS Safari.
   */
  fireSequence(vibs: Vibration[], type: ImpulseType, intensity: number, ef?: EasingFn): void {
    try {
      const ctx = this.ensureCtx();
      if (!this.lib) return;
      const buf = this.lib.get(type);
      if (!buf) return;

      // Cancel any previously scheduled sequence
      this.stopSequence();

      const now = ctx.currentTime;
      const impulseSec = buf.length / buf.sampleRate;

      let elapsedSec = 0;
      const count = vibs.length;

      for (let i = 0; i < count; i++) {
        const v = vibs[i];
        const segStartSec = elapsedSec + (v.delay ?? 0) / 1000;
        const segDurSec = v.duration / 1000;
        const si = v.intensity ?? intensity;
        const pr = count > 1 ? i / (count - 1) : 1;
        const ei = ef ? si * Math.max(0.1, ef(pr)) : si;

        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer = buf;
        gain.gain.value = ei * this.mg;
        src.connect(gain);
        gain.connect(ctx.destination);

        const startAt = now + segStartSec;
        const stopAt = now + segStartSec + segDurSec;

        if (segDurSec > impulseSec * 1.5) {
          // Long segment: loop the impulse buffer for the full duration
          src.loop = true;
          src.loopEnd = impulseSec;
        }

        src.start(startAt);
        src.stop(stopAt);

        src.onended = () => {
          const idx = this.activeSources.indexOf(src);
          if (idx !== -1) this.activeSources.splice(idx, 1);
          try {
            src.disconnect();
            gain.disconnect();
          } catch {}
        };
        this.activeSources.push(src);

        elapsedSec = segStartSec + segDurSec;
      }
    } catch {}
  }

  /** Stop all active sources from the current sequence. */
  stopSequence(): void {
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    }
    this.activeSources = [];
  }

  setGain(g: number): void {
    this.mg = Math.max(0, Math.min(1, g));
  }
  destroy(): void {
    this.stopSequence();
    void this.ctx?.close();
    this.ctx = null;
    this.lib = null;
  }
}
