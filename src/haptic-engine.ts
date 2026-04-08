// ============================================================================
// Haptic Engine — Main API
//
// Cross-platform haptic feedback for the web.
//
// Platform strategy:
//   Android  — navigator.vibrate() works from any event context.
//   iOS      — No Vibration API. Uses a hidden <input type="checkbox" switch>
//              toggled via label.click() to trigger the Taptic Engine. This
//              requires user activation (only granted by `click` / clean-tap
//              `touchend` on iOS Safari). During continuous drag gestures no
//              activation event fires, so drag haptics on iOS are audio-only.
//   Other    — Falls back to audio impulses when no haptic API is available.
//
// Audio layer:
//   A Web Audio synthesizer generates short impulse waveforms (tick, tap,
//   thud, click, snap, buzz, confirm, harsh) that accompany or substitute
//   for hardware haptics. Enabled by default, controllable per-trigger.
// ============================================================================

import { AudioImpulseLayer } from "./audio";
import { DEF_INTENSITY, DEF_THROTTLE, easings, presets } from "./core";
import type {
  DragHapticsOptions,
  EasingFn,
  HapticEngineOptions,
  HapticInput,
  HapticPreset,
  ImpulseType,
  SequenceOptions,
  SequenceStep,
  TriggerOptions,
  Vibration,
} from "./core";
import { DragHaptics } from "./interactions";
import {
  buildAndroidPattern,
  detectPlatform,
  hasVib,
  IOSSwitchPool,
  iosRafDrive,
  supportsIOSHaptics,
  type Platform,
} from "./platform";

export class HapticEngine {
  private platform: Platform;
  private iosPool: IOSSwitchPool | null = null;
  private audio: AudioImpulseLayer | null = null;
  private useAudio: boolean;
  private throttleMs: number;
  private enabled = true;
  private lastTriggerTime = 0;
  private activeAbort: AbortController | null = null;
  private iosCancel: (() => void) | null = null;

  /** True if the device supports Android-style navigator.vibrate(). */
  static readonly supportsVibration: boolean = hasVib();
  /** True if the device supports iOS switch-checkbox haptics. */
  static readonly supportsIOSHaptics: boolean = supportsIOSHaptics;
  /** True if any form of haptic feedback is available. */
  static readonly isSupported: boolean =
    HapticEngine.supportsVibration || HapticEngine.supportsIOSHaptics;

  constructor(options: HapticEngineOptions = {}) {
    this.throttleMs = options.throttleMs ?? DEF_THROTTLE;
    this.useAudio = options.audioLayer ?? true;
    this.platform = detectPlatform();
    if (this.platform === "ios-switch") this.iosPool = new IOSSwitchPool();
    this.audio = new AudioImpulseLayer(options.audioGain ?? 0.6);

    // Unlock AudioContext on first user gesture
    if (typeof document !== "undefined") {
      const unlock = () => {
        this.audio?.unlock();
      };
      document.addEventListener("touchstart", unlock, { once: true, passive: true, capture: true });
      document.addEventListener("click", unlock, { once: true, capture: true });
    }
  }

  /**
   * Fire a haptic + audio pattern. Input can be a preset name, duration (ms),
   * Vibration[], number[] (alternating on/off), or a HapticPreset object.
   */
  async trigger(input?: HapticInput, options?: TriggerOptions): Promise<void> {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastTriggerTime < this.throttleMs) return;
    this.lastTriggerTime = now;
    this.cancel();
    const r = this.resolveInput(input);
    if (r.vibrations.length === 0) return;
    const di = options?.intensity ?? DEF_INTENSITY;
    const ef = r.preset?.easing ? easings[r.preset.easing] : undefined;
    const sa = options?.audio ?? this.useAudio;
    this.audio?.unlock();
    switch (this.platform) {
      case "vibration":
        if (sa && this.audio && r.preset?.impulse)
          this.audio.fireSequence(r.vibrations, r.preset.impulse, di, ef);
        await this.fireAndroid(r.vibrations, di, ef);
        break;
      case "ios-switch":
        // On iOS, audio is driven by the rAF loop (not pre-scheduled) so
        // haptics and audio share the exact same timing source.
        await this.fireIOS(r.vibrations, r.preset, di, sa);
        break;
      default:
        // Desktop/fallback: audio only
        if (sa && this.audio && r.preset?.impulse)
          this.audio.fireSequence(r.vibrations, r.preset.impulse, di, ef);
        break;
    }
  }

  /** Play an audio impulse. Set force=true to bypass the audio-enabled toggle. */
  fireImpulse(type: ImpulseType, intensity: number, force?: boolean): void {
    if ((force || this.useAudio) && this.audio) {
      this.audio.unlock();
      this.audio.fire(type, intensity);
    }
  }

  /** Fire a single platform haptic tick (short vibrate or single iOS switch toggle). */
  fireHapticTick(intensity: number): void {
    if (this.platform === "vibration") {
      try {
        navigator.vibrate(Math.max(1, Math.round(10 * intensity)));
      } catch {}
    } else if (this.platform === "ios-switch" && this.iosPool) {
      try {
        this.iosPool.fire();
      } catch {}
    }
  }

  /**
   * Fire a drag-optimized haptic tick. Skips cancel()/vibrate(0) overhead.
   * Android: velocity scales pulse duration (12-25ms) and count (1-3 taps).
   * iOS: single switch toggle (requires user activation to produce Taptic).
   */
  fireDragTick(intensity: number, velocity: number): void {
    const taps = Math.max(1, Math.min(3, Math.ceil(velocity / 400)));
    if (this.platform === "vibration") {
      const dur = Math.max(12, Math.min(25, Math.round(15 * intensity + velocity / 200)));
      if (taps === 1) {
        try {
          navigator.vibrate(dur);
        } catch {}
      } else {
        const pat: number[] = [];
        for (let i = 0; i < taps; i++) {
          if (i > 0) pat.push(6);
          pat.push(dur);
        }
        try {
          navigator.vibrate(pat);
        } catch {}
      }
    } else if (this.platform === "ios-switch" && this.iosPool) {
      try {
        this.iosPool.fire();
      } catch {}
    }
  }

  /** Fire a drag tick only on Android (vibration platform). No-op on iOS. */
  fireDragTickIfVibration(intensity: number, velocity: number): void {
    if (this.platform !== "vibration") return;
    this.fireDragTick(intensity, velocity);
  }

  /** Play a sequence of preset steps with optional delays and repeats. */
  async sequence(steps: SequenceStep[], options?: SequenceOptions): Promise<void> {
    const repeat = options?.repeat ?? 1,
      repeatGap = options?.repeatGap ?? 200;
    const ac = new AbortController();
    this.activeAbort = ac;
    for (let rep = 0; rep < repeat; rep++) {
      if (ac.signal.aborted) return;
      for (const step of steps) {
        if (ac.signal.aborted) return;
        if (step.delay && step.delay > 0) {
          await this.sleep(step.delay, ac.signal);
          if (ac.signal.aborted) return;
        }
        this.lastTriggerTime = 0;
        await this.trigger(step.preset, { intensity: step.intensity });
      }
      if (rep < repeat - 1 && repeatGap > 0) await this.sleep(repeatGap, ac.signal);
    }
  }

  /** Create a DragHaptics instance bound to this engine. */
  drag(options?: DragHapticsOptions): DragHaptics {
    return new DragHaptics(this, options);
  }

  /** Cancel any in-progress pattern or vibration. */
  cancel(): void {
    this.activeAbort?.abort();
    this.activeAbort = null;
    this.iosCancel?.();
    this.iosCancel = null;
    this.audio?.stopSequence();
    if (this.platform === "vibration" && hasVib()) navigator.vibrate(0);
  }

  setEnabled(e: boolean): void {
    this.enabled = e;
    if (!e) this.cancel();
  }
  get isEnabled(): boolean {
    return this.enabled;
  }
  setAudioLayer(e: boolean): void {
    this.useAudio = e;
  }
  setAudioGain(g: number): void {
    this.audio?.setGain(g);
  }
  setThrottle(ms: number): void {
    this.throttleMs = Math.max(0, ms);
  }
  registerPreset(name: string, preset: HapticPreset): void {
    presets[name] = preset;
  }

  /** Clean up all resources (audio context, iOS DOM elements). */
  destroy(): void {
    this.cancel();
    this.iosPool?.destroy();
    this.iosPool = null;
    this.audio?.destroy();
    this.audio = null;
  }

  /** Resolve any HapticInput into a Vibration[] and optional preset metadata. */
  private resolveInput(input?: HapticInput): {
    vibrations: Vibration[];
    preset: HapticPreset | null;
  } {
    if (input == null) return { vibrations: presets.medium.pattern, preset: presets.medium };
    if (typeof input === "string") {
      const p = presets[input];
      if (!p) {
        console.warn(`[haptics] Unknown: "${input}"`);
        return { vibrations: [], preset: null };
      }
      return { vibrations: p.pattern, preset: p };
    }
    if (typeof input === "number") return { vibrations: [{ duration: input }], preset: null };
    if (typeof input === "object" && !Array.isArray(input) && "pattern" in input)
      return { vibrations: (input as HapticPreset).pattern, preset: input as HapticPreset };
    if (Array.isArray(input)) {
      if (!input.length) return { vibrations: [], preset: null };
      if (typeof input[0] === "number") {
        const r: Vibration[] = [];
        let pd = 0;
        for (let i = 0; i < input.length; i++) {
          if (i % 2 === 0) {
            r.push({ duration: input[i] as number, ...(pd > 0 ? { delay: pd } : {}) });
            pd = 0;
          } else pd = input[i] as number;
        }
        return { vibrations: r, preset: null };
      }
      return { vibrations: input as Vibration[], preset: null };
    }
    return { vibrations: [], preset: null };
  }

  /** Android: convert Vibration[] to flat pattern and vibrate for its duration. */
  private async fireAndroid(vibs: Vibration[], di: number, ef?: EasingFn): Promise<void> {
    const pat = buildAndroidPattern(vibs, di, ef);
    if (!pat.length) return;
    navigator.vibrate(pat);
    const total = pat.reduce((s, v) => s + v, 0);
    if (total > 0) {
      const ac = new AbortController();
      this.activeAbort = ac;
      await this.sleep(total, ac.signal);
    }
  }

  /** iOS: fire switch-checkbox toggles via rAF loop with intensity-based intervals. */
  private async fireIOS(
    vibs: Vibration[],
    pr: HapticPreset | null,
    di: number,
    playAudio?: boolean,
  ): Promise<void> {
    if (!this.iosPool) return;
    this.iosCancel?.();
    const impulseType = pr?.impulse;
    const audio = playAudio && this.audio && impulseType ? this.audio : null;
    const { promise, cancel } = iosRafDrive(this.iosPool, vibs, di, (tickIntensity) => {
      if (audio && impulseType) audio.fire(impulseType, tickIntensity);
    });
    this.iosCancel = cancel;
    await promise;
    this.iosCancel = null;
  }

  /** Cancellable setTimeout wrapped in a Promise. */
  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const t = setTimeout(resolve, ms);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          resolve();
        },
        { once: true },
      );
    });
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

let _default: HapticEngine | null = null;

/** Get or create the shared default engine instance. */
export function getDefaultEngine(opts?: HapticEngineOptions): HapticEngine {
  if (!_default) _default = new HapticEngine(opts);
  return _default;
}

/** Fire a one-shot haptic using the default engine. */
export async function haptic(input?: HapticInput, options?: TriggerOptions): Promise<void> {
  return getDefaultEngine().trigger(input, options);
}
