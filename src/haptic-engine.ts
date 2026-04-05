// ============================================================================
// Haptic Engine
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Vibration {
  duration: number;
  intensity?: number;
  delay?: number;
}

export type HapticPattern = number[] | Vibration[];
export type EasingFn = (t: number) => number;
export type ImpulseType = 'tick' | 'tap' | 'thud' | 'click' | 'snap' | 'buzz' | 'confirm' | 'harsh';

export interface HapticPreset {
  pattern: Vibration[];
  description?: string;
  /** Number of iOS switch-checkbox toggles to fire for this preset. */
  iosTicks?: number;
  /** Milliseconds between iOS ticks. Defaults to IOS_GAP (55 ms). */
  iosTickGap?: number;
  /** Audio impulse type to play alongside the haptic. */
  impulse?: ImpulseType;
  /** Easing curve applied to multi-step patterns. */
  easing?: keyof typeof easings;
}

export type HapticInput = number | string | HapticPattern | HapticPreset;
export interface TriggerOptions { intensity?: number; audio?: boolean; }
export interface HapticEngineOptions {
  debug?: boolean;
  /** Minimum ms between trigger() calls. Default 25. */
  throttleMs?: number;
  /** Enable audio impulse layer. Default true. */
  audioLayer?: boolean;
  /** Master gain for audio impulses (0-1). Default 0.6. */
  audioGain?: number;
}

// ---------------------------------------------------------------------------
// Easing functions
// ---------------------------------------------------------------------------

export const easings = {
  linear:    (t: number) => t,
  easeIn:    (t: number) => t * t,
  easeOut:   (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  bounce:    (t: number) => {
    if (t < 1/2.75) return 7.5625 * t * t;
    if (t < 2/2.75) return 7.5625 * (t -= 1.5/2.75) * t + 0.75;
    if (t < 2.5/2.75) return 7.5625 * (t -= 2.25/2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625/2.75) * t + 0.984375;
  },
  spring: (t: number) => 1 - Math.cos(t * 4.5 * Math.PI) * Math.exp(-t * 6),
} as const;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum duration for a single vibration segment (ms). */
const MAX_SEG_MS = 1000;
/** Default intensity when none is specified. */
const DEF_INTENSITY = 0.5;
/** Default throttle between trigger() calls (ms). */
const DEF_THROTTLE = 25;
/** Default gap between iOS switch toggles (ms). */
const IOS_GAP = 55;
/** Minimum intensity for an iOS tick to be considered audible. */
const IOS_MIN = 0.12;
/** Minimum px moved since last drag haptic fire to trigger the next one. */
const DRAG_FIRE_DIST = 18;

// ---------------------------------------------------------------------------
// Impulse Buffer Synthesizer
//
// Generates short AudioBuffers for each impulse type. Each waveform is a
// combination of exponentially-decayed sine waves designed to mimic the
// feel of physical haptic feedback through speakers/headphones.
// ---------------------------------------------------------------------------

class ImpulseLibrary {
  private buffers: Map<string, AudioBuffer> = new Map();
  constructor(private ctx: AudioContext) { this.build(); }

  private build(): void {
    const sr = this.ctx.sampleRate;
    this.mk('tick', sr, 0.008, t => { const e = Math.exp(-t * 600); return Math.sin(2 * Math.PI * 320 * t) * e + Math.sin(2 * Math.PI * 800 * t) * e * 0.15; });
    this.mk('tap', sr, 0.020, t => { const e = Math.exp(-t * 250); return Math.sin(2 * Math.PI * 220 * t) * e + (t < 0.001 ? Math.sin(2 * Math.PI * 800 * t) * (1 - t / 0.001) * 0.4 : 0) + Math.sin(2 * Math.PI * 110 * t) * e * 0.3; });
    this.mk('thud', sr, 0.035, t => { const e = Math.exp(-t * 150); return Math.sin(2 * Math.PI * 160 * t) * e + Math.sin(2 * Math.PI * 80 * t) * e * 0.5 + (t < 0.002 ? Math.sin(2 * Math.PI * 600 * t) * (1 - t / 0.002) * 0.3 : 0); });
    this.mk('click', sr, 0.005, t => { const e = Math.exp(-t * 1200); return Math.sin(2 * Math.PI * 400 * t) * e + Math.sin(2 * Math.PI * 1200 * t) * e * 0.1; });
    this.mk('snap', sr, 0.010, t => { const e = Math.exp(-t * 500); return Math.sin(2 * Math.PI * 500 * t) * e + Math.sin(2 * Math.PI * 1380 * t) * e * 0.2; });
    this.mk('buzz', sr, 0.060, t => { const e = Math.exp(-t * 40); let s = 0; for (let h = 1; h <= 5; h++) s += Math.sin(2 * Math.PI * 200 * h * t) / h; return s * e * 0.4; });
    this.mk('confirm', sr, 0.025, t => { const e = Math.exp(-t * 200); return (Math.sin(2 * Math.PI * 280 * t) * 0.6 + Math.sin(2 * Math.PI * 420 * t) * 0.4) * e; });
    this.mk('harsh', sr, 0.030, t => { const f = 180, e = Math.exp(-t * 160); let s = 0; for (let h = 1; h <= 6; h++) s += Math.sin(2 * Math.PI * f * h * t) * (h % 2 === 0 ? 0.8 : 1) / h; return (s + Math.sin(2 * Math.PI * f * 1.07 * t) * e * 0.3) * e * 0.35; });
  }

  /** Synthesize a named impulse buffer: peak-normalize samples from fn(t). */
  private mk(name: string, sr: number, dur: number, fn: (t: number) => number): void {
    const len = Math.ceil(sr * dur), buf = this.ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    let pk = 0;
    for (let i = 0; i < len; i++) { d[i] = fn(i / sr); pk = Math.max(pk, Math.abs(d[i])); }
    if (pk > 0) for (let i = 0; i < len; i++) d[i] /= pk;
    this.buffers.set(name, buf);
  }

  get(name: string): AudioBuffer | undefined { return this.buffers.get(name); }
}

// ---------------------------------------------------------------------------
// Audio Impulse Layer
//
// Manages a shared AudioContext and plays impulse buffers on demand.
// Must be unlock()'d from a user gesture before audio can play on iOS.
// ---------------------------------------------------------------------------

class AudioImpulseLayer {
  private ctx: AudioContext | null = null;
  private lib: ImpulseLibrary | null = null;
  private mg: number;
  private unlocked = false;

  constructor(gain: number = 0.6) { this.mg = gain; }

  /** Play a silent buffer to unlock the AudioContext (call from user gesture). */
  unlock(): void {
    if (this.unlocked) return;
    try {
      const ctx = this.ensureCtx();
      const b = ctx.createBuffer(1, 1, ctx.sampleRate);
      const s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
      if (ctx.state === 'suspended') ctx.resume();
      this.unlocked = true;
    } catch {}
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) { this.ctx = new AudioContext(); this.lib = new ImpulseLibrary(this.ctx); }
    if (this.ctx.state === 'suspended') this.ctx.resume();
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
      src.connect(gain); gain.connect(ctx.destination);
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

  setGain(g: number): void { this.mg = Math.max(0, Math.min(1, g)); }
  destroy(): void { this.ctx?.close(); this.ctx = null; this.lib = null; }
}

// ---------------------------------------------------------------------------
// Presets
//
// Each preset defines:
//   pattern     — Vibration[] for Android (navigator.vibrate)
//   iosTicks    — Number of switch-checkbox toggles for iOS
//   iosTickGap  — Delay between iOS toggles (ms)
//   impulse     — Audio impulse type to accompany the haptic
//   easing      — Optional easing for multi-step patterns
// ---------------------------------------------------------------------------

export const presets: Record<string, HapticPreset> = {
  // Notification
  success:   { description: 'Ascending double-tap', pattern: [{ duration: 30, intensity: .5 },{ delay: 65, duration: 45, intensity: 1 }], iosTicks: 2, iosTickGap: 80, impulse: 'confirm' },
  warning:   { description: 'Two hesitant taps', pattern: [{ duration: 40, intensity: .7 },{ delay: 120, duration: 35, intensity: .5 }], iosTicks: 2, iosTickGap: 140, impulse: 'harsh' },
  error:     { description: 'Three rapid harsh taps', pattern: [{ duration: 45, intensity: .9 },{ delay: 50, duration: 45, intensity: .9 },{ delay: 50, duration: 45, intensity: .9 }], iosTicks: 3, iosTickGap: 65, impulse: 'harsh' },
  confirm:   { description: 'Strong double-tap confirm', pattern: [{ duration: 35, intensity: .9 },{ delay: 100, duration: 50, intensity: 1 }], iosTicks: 2, iosTickGap: 110, impulse: 'confirm' },
  reject:    { description: 'Harsh staccato triple', pattern: [{ duration: 30, intensity: 1 },{ delay: 30, duration: 30, intensity: 1 },{ delay: 30, duration: 50, intensity: 1 }], iosTicks: 3, iosTickGap: 45, impulse: 'harsh' },
  // Impact
  light:     { description: 'Single light tap', pattern: [{ duration: 12, intensity: .35 }], iosTicks: 1, impulse: 'tick' },
  medium:    { description: 'Moderate tap', pattern: [{ duration: 28, intensity: .65 }], iosTicks: 1, impulse: 'tap' },
  heavy:     { description: 'Strong tap', pattern: [{ duration: 40, intensity: 1 }], iosTicks: 2, iosTickGap: 30, impulse: 'thud' },
  soft:      { description: 'Cushioned tap', pattern: [{ duration: 45, intensity: .45 }], iosTicks: 1, impulse: 'tap' },
  rigid:     { description: 'Hard crisp snap', pattern: [{ duration: 8, intensity: 1 }], iosTicks: 1, impulse: 'snap' },
  // Selection
  selection: { description: 'Subtle tick', pattern: [{ duration: 6, intensity: .25 }], iosTicks: 1, impulse: 'tick' },
  // Custom
  tick:      { description: 'Crisp tick', pattern: [{ duration: 10, intensity: .5 }], iosTicks: 1, impulse: 'click' },
  click:     { description: 'Ultra-short click', pattern: [{ duration: 5, intensity: .8 }], iosTicks: 1, impulse: 'click' },
  snap:      { description: 'Sharp snap', pattern: [{ duration: 6, intensity: 1 }], iosTicks: 1, impulse: 'snap' },
  nudge:     { description: 'Two quick taps', pattern: [{ duration: 60, intensity: .7 },{ delay: 70, duration: 40, intensity: .3 }], iosTicks: 2, iosTickGap: 90, impulse: 'tap' },
  buzz:      { description: 'Sustained vibration', pattern: [{ duration: 800, intensity: 1 }], iosTicks: 8, iosTickGap: 50, impulse: 'buzz' },
  heartbeat: { description: 'Heartbeat rhythm', pattern: [{ duration: 35, intensity: .8 },{ delay: 80, duration: 25, intensity: .5 },{ delay: 300, duration: 35, intensity: .8 },{ delay: 80, duration: 25, intensity: .5 }], iosTicks: 4, iosTickGap: 0, impulse: 'thud' },
  spring:    { description: 'Bouncy pulses', pattern: [{ duration: 40, intensity: 1 },{ delay: 50, duration: 30, intensity: .7 },{ delay: 45, duration: 20, intensity: .45 },{ delay: 40, duration: 12, intensity: .25 }], iosTicks: 4, iosTickGap: 55, impulse: 'tap', easing: 'bounce' },
  rampUp:    { description: 'Escalating', pattern: [{ duration: 12, intensity: .2 },{ delay: 50, duration: 18, intensity: .4 },{ delay: 45, duration: 25, intensity: .65 },{ delay: 40, duration: 35, intensity: 1 }], iosTicks: 4, iosTickGap: 60, impulse: 'tap', easing: 'easeIn' },
  rampDown:  { description: 'Decreasing', pattern: [{ duration: 35, intensity: 1 },{ delay: 45, duration: 25, intensity: .6 },{ delay: 50, duration: 15, intensity: .3 },{ delay: 55, duration: 8, intensity: .15 }], iosTicks: 3, iosTickGap: 65, impulse: 'tap', easing: 'easeOut' },
  thud:      { description: 'Heavy impact', pattern: [{ duration: 50, intensity: 1 },{ delay: 40, duration: 25, intensity: .35 }], iosTicks: 2, iosTickGap: 50, impulse: 'thud' },
  trill:     { description: 'Rapid flutter', pattern: [{ duration: 15, intensity: .8 },{ delay: 25, duration: 15, intensity: .8 },{ delay: 25, duration: 15, intensity: .8 },{ delay: 25, duration: 15, intensity: .8 },{ delay: 25, duration: 15, intensity: .8 }], iosTicks: 5, iosTickGap: 35, impulse: 'click' },
  pulse:     { description: 'Rhythmic pulse', pattern: [{ duration: 30, intensity: .6 },{ delay: 150, duration: 30, intensity: .6 },{ delay: 150, duration: 30, intensity: .6 }], iosTicks: 3, iosTickGap: 180, impulse: 'tap' },
};

// ---------------------------------------------------------------------------
// Platform Detection
//
// Three modes:
//   'vibration'  — Android / browsers with navigator.vibrate()
//   'ios-switch' — iOS Safari (no vibrate, touch-capable, switch attr supported)
//   'none'       — SSR or desktop without haptic support
// ---------------------------------------------------------------------------

type Platform = 'vibration' | 'ios-switch' | 'none';
const hasVib = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const isIOS = (): boolean => {
  if (typeof document === 'undefined') return false;
  if (hasVib()) return false;
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return false;
  try { const el = document.createElement('input'); el.type = 'checkbox'; el.setAttribute('switch', ''); return el.getAttribute('switch') !== null; } catch { return false; }
};
const detectPlatform = (): Platform => {
  if (typeof window === 'undefined') return 'none';
  if (hasVib()) return 'vibration';
  if (isIOS()) return 'ios-switch';
  return 'none';
};

// ---------------------------------------------------------------------------
// Android Vibration Pattern Builder
//
// Converts Vibration[] into a flat number[] for navigator.vibrate().
// Applies intensity scaling and optional easing to each segment.
// ---------------------------------------------------------------------------

function buildAndroidPattern(vibs: Vibration[], di: number, ef?: EasingFn): number[] {
  const flat: number[] = [];
  const count = vibs.length;
  for (let idx = 0; idx < count; idx++) {
    const v = vibs[idx];
    let intensity = Math.max(0, Math.min(1, v.intensity ?? di));
    if (ef && count > 1) intensity *= Math.max(0.1, ef(idx / (count - 1)));
    const sc = Math.max(1, Math.round(Math.min(v.duration, MAX_SEG_MS) * Math.max(0.15, intensity)));
    if (v.delay && v.delay > 0) {
      if (!flat.length) flat.push(0, v.delay);
      else if (flat.length % 2 === 0) flat[flat.length - 1] += v.delay;
      else flat.push(v.delay);
    }
    if (flat.length > 0 && flat.length % 2 === 1) flat.push(0);
    flat.push(sc);
  }
  return flat;
}

// ---------------------------------------------------------------------------
// iOS Switch Checkbox Pool
//
// Creates hidden <input type="checkbox" switch> elements whose label.click()
// toggles trigger the iOS Taptic Engine. A pool of 6 pairs avoids toggling
// the same checkbox in rapid succession. Elements use opacity:0.01 at 1x1px
// (kept in the render tree; display:none may cause iOS to skip the haptic).
// ---------------------------------------------------------------------------

class IOSSwitchPool {
  private labels: HTMLLabelElement[] = [];
  private nextIndex = 0;

  constructor() {
    for (let i = 0; i < 6; i++) {
      const id = `__hp${i}_${Date.now()}`;

      const label = document.createElement('label');
      label.setAttribute('for', id);
      label.style.position = 'fixed';
      label.style.top = '0';
      label.style.left = '0';
      label.style.width = '1px';
      label.style.height = '1px';
      label.style.overflow = 'hidden';
      label.style.opacity = '0.01';
      label.style.pointerEvents = 'none';
      label.style.userSelect = 'none';
      label.setAttribute('aria-hidden', 'true');

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.id = id;
      input.tabIndex = -1;
      // Reset styles and ensure native switch appearance for Taptic integration
      input.style.all = 'initial';
      input.style.appearance = 'auto';

      label.appendChild(input);
      document.body.appendChild(label);
      this.labels.push(label);
    }
  }

  /** Toggle the next switch in the pool to fire a single Taptic tick. */
  fire(): void {
    const label = this.labels[this.nextIndex];
    this.nextIndex = (this.nextIndex + 1) % this.labels.length;
    label.click();
  }

  destroy(): void {
    for (const l of this.labels) l.remove();
    this.labels = [];
  }
}

// ---------------------------------------------------------------------------
// iOS Tick Planner
//
// Determines how many switch toggles and at what intervals to fire for a
// given preset on iOS. If the preset defines iosTicks/iosTickGap those are
// used directly; otherwise ticks are inferred from the Vibration[] pattern.
// ---------------------------------------------------------------------------

function iosPlan(vibs: Vibration[], pr: HapticPreset | null, di: number): { ticks: number; gaps: number[] } {
  if (pr?.iosTicks !== undefined) {
    const bt = pr.iosTicks, sc = Math.max(1, Math.round(bt * Math.max(0.25, di)));
    const gap = pr.iosTickGap ?? IOS_GAP;
    if (gap === 0 && vibs.length > 1) {
      const gs: number[] = [];
      for (let i = 1; i < vibs.length && gs.length < sc - 1; i++) gs.push((vibs[i].delay ?? 0) + vibs[i - 1].duration);
      return { ticks: Math.min(sc, gs.length + 1), gaps: gs };
    }
    return { ticks: sc, gaps: Array(Math.max(0, sc - 1)).fill(gap) };
  }
  let t = 0; const gs: number[] = [];
  for (const v of vibs) {
    if ((v.intensity ?? di) >= IOS_MIN) { if (t > 0) gs.push((v.delay ?? 0) + (vibs[t - 1]?.duration ?? 0)); t++; }
  }
  const sc = Math.max(1, Math.round(t * Math.max(0.25, di)));
  return { ticks: sc, gaps: gs.slice(0, Math.max(0, sc - 1)) };
}

// ---------------------------------------------------------------------------
// Drag Haptics
//
// Binds touch events to an element and fires haptic/audio feedback as the
// user drags. Feedback fires when the finger moves past a distance threshold
// (fireDist, default 18px) or a time-based fallback (80ms with 2px min
// movement) to ensure slow drags still feel responsive.
//
// Platform behaviour:
//   Android — Full haptic (navigator.vibrate) + audio on every tick.
//   iOS     — Audio ticks during the drag. Taptic fires on clean taps via
//             touchend (iOS Safari only grants switch-checkbox activation
//             from click/clean-tap touchend, not during continuous drags).
// ---------------------------------------------------------------------------

export interface DragHapticsOptions {
  /** Minimum px moved since last fire to trigger next haptic (default: 18). */
  fireDist?: number;
  /** Audio impulse type for drag ticks (default: 'tick'). */
  impulse?: ImpulseType;
  /** Haptic/audio intensity 0-1 (default: 0.6). */
  intensity?: number;
  /** Callback fired on each drag tick with current velocity and tick count. */
  onTick?: (velocity: number, ticks: number) => void;
}

export class DragHaptics {
  private engine: HapticEngine;
  private opts: Required<Omit<DragHapticsOptions, 'onTick'>> & { onTick?: DragHapticsOptions['onTick'] };
  curX = 0;
  curY = 0;
  private lastFireX = 0;
  private lastFireY = 0;
  private lastFireT = 0;
  private active = false;
  private tickCount = 0;
  private cleanup: (() => void)[] = [];

  constructor(engine: HapticEngine, options: DragHapticsOptions = {}) {
    this.engine = engine;
    this.opts = {
      fireDist: options.fireDist ?? DRAG_FIRE_DIST,
      impulse: options.impulse ?? 'tick',
      intensity: options.intensity ?? 0.6,
      onTick: options.onTick,
    };
  }

  /** Attach drag-haptic listeners to an element. Returns an unbind function. */
  bind(element: HTMLElement): () => void {
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      this.curX = this.lastFireX = t.clientX;
      this.curY = this.lastFireY = t.clientY;
      this.lastFireT = performance.now();
      this.active = true;
      this.tickCount = 0;

      // Android: vibration API works from any event context
      this.engine.fireDragTickIfVibration(this.opts.intensity, 0);
      // Audio on all platforms
      this.engine.fireImpulse(this.opts.impulse, this.opts.intensity);
      this.tickCount++;
      this.opts.onTick?.(0, this.tickCount);
    };

    const onMove = (e: TouchEvent) => {
      if (!this.active) return;
      const t = e.touches[0];
      this.curX = t.clientX;
      this.curY = t.clientY;

      const dist = this.distFromLastFire();
      const now = performance.now();
      const elapsed = now - this.lastFireT;

      // Fire on distance threshold (fast drags) or time fallback (slow drags)
      const SLOW_DRAG_INTERVAL = 80;
      const JITTER_THRESHOLD = 2;

      if (dist >= this.opts.fireDist || (dist >= JITTER_THRESHOLD && elapsed >= SLOW_DRAG_INTERVAL)) {
        const dt = elapsed / 1000;
        const velocity = dt > 0.001 ? dist / dt : 0;

        this.engine.fireDragTickIfVibration(this.opts.intensity, velocity);
        this.engine.fireImpulse(this.opts.impulse, this.opts.intensity);

        this.lastFireX = this.curX;
        this.lastFireY = this.curY;
        this.lastFireT = performance.now();

        this.tickCount++;
        this.opts.onTick?.(velocity, this.tickCount);
      }
    };

    const onEnd = () => {
      if (!this.active) return;
      this.active = false;
      // On iOS clean taps, touchend grants activation so Taptic fires.
      // On drag-end touchend, iOS withholds activation — only audio plays.
      this.engine.trigger('selection', { intensity: this.opts.intensity });
    };

    const onCancel = () => { this.active = false; };

    element.addEventListener('touchstart', onStart, { passive: true });
    element.addEventListener('touchmove', onMove, { passive: true });
    element.addEventListener('touchend', onEnd, { passive: true });
    element.addEventListener('touchcancel', onCancel, { passive: true });

    const unbind = () => {
      element.removeEventListener('touchstart', onStart);
      element.removeEventListener('touchmove', onMove);
      element.removeEventListener('touchend', onEnd);
      element.removeEventListener('touchcancel', onCancel);
      this.active = false;
    };
    this.cleanup.push(unbind);
    return unbind;
  }

  private distFromLastFire(): number {
    const dx = this.curX - this.lastFireX;
    const dy = this.curY - this.lastFireY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Unbind all elements and stop tracking. */
  destroyAll(): void {
    this.active = false;
    this.cleanup.forEach(fn => fn());
    this.cleanup = [];
  }
}

// ---------------------------------------------------------------------------
// Sequence types
// ---------------------------------------------------------------------------

export interface SequenceStep { preset: string; delay?: number; intensity?: number; }
export interface SequenceOptions { repeat?: number; repeatGap?: number; }

// ---------------------------------------------------------------------------
// HapticEngine — Main API
//
// Orchestrates platform-specific haptic feedback (Android vibration or iOS
// switch-checkbox toggles) alongside synthesized audio impulses.
// ---------------------------------------------------------------------------

export class HapticEngine {
  private platform: Platform;
  private iosPool: IOSSwitchPool | null = null;
  private audio: AudioImpulseLayer | null = null;
  private useAudio: boolean;
  private throttleMs: number;
  private enabled = true;
  private lastTriggerTime = 0;
  private activeAbort: AbortController | null = null;

  /** True if the device supports Android-style navigator.vibrate(). */
  static readonly supportsVibration: boolean = hasVib();
  /** True if the device supports iOS switch-checkbox haptics. */
  static readonly supportsIOSHaptics: boolean = typeof document !== 'undefined' ? isIOS() : false;
  /** True if any form of haptic feedback is available. */
  static readonly isSupported: boolean = HapticEngine.supportsVibration || HapticEngine.supportsIOSHaptics;

  constructor(options: HapticEngineOptions = {}) {
    this.throttleMs = options.throttleMs ?? DEF_THROTTLE;
    this.useAudio = options.audioLayer ?? true;
    this.platform = detectPlatform();
    if (this.platform === 'ios-switch') this.iosPool = new IOSSwitchPool();
    this.audio = new AudioImpulseLayer(options.audioGain ?? 0.6);

    // Unlock AudioContext on first user gesture
    if (typeof document !== 'undefined') {
      const unlock = () => { this.audio?.unlock(); };
      document.addEventListener('touchstart', unlock, { once: true, passive: true, capture: true });
      document.addEventListener('click', unlock, { once: true, capture: true });
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
    if (sa && this.audio && r.preset?.impulse) this.audio.fireSequence(r.vibrations, r.preset.impulse, di, ef);
    switch (this.platform) {
      case 'vibration': await this.fireAndroid(r.vibrations, di, ef); break;
      case 'ios-switch': await this.fireIOS(r.vibrations, r.preset, di); break;
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
    if (this.platform === 'vibration') {
      try { navigator.vibrate(Math.max(1, Math.round(10 * intensity))); } catch {}
    } else if (this.platform === 'ios-switch' && this.iosPool) {
      try { this.iosPool.fire(); } catch {}
    }
  }

  /**
   * Fire a drag-optimized haptic tick. Skips cancel()/vibrate(0) overhead.
   * Android: velocity scales pulse duration (12-25ms) and count (1-3 taps).
   * iOS: single switch toggle (requires user activation to produce Taptic).
   */
  fireDragTick(intensity: number, velocity: number): void {
    const taps = Math.max(1, Math.min(3, Math.ceil(velocity / 400)));
    if (this.platform === 'vibration') {
      const dur = Math.max(12, Math.min(25, Math.round(15 * intensity + velocity / 200)));
      if (taps === 1) {
        try { navigator.vibrate(dur); } catch {}
      } else {
        const pat: number[] = [];
        for (let i = 0; i < taps; i++) { if (i > 0) pat.push(6); pat.push(dur); }
        try { navigator.vibrate(pat); } catch {}
      }
    } else if (this.platform === 'ios-switch' && this.iosPool) {
      try { this.iosPool.fire(); } catch {}
    }
  }

  /** Fire a drag tick only on Android (vibration platform). No-op on iOS. */
  fireDragTickIfVibration(intensity: number, velocity: number): void {
    if (this.platform !== 'vibration') return;
    this.fireDragTick(intensity, velocity);
  }

  /** Play a sequence of preset steps with optional delays and repeats. */
  async sequence(steps: SequenceStep[], options?: SequenceOptions): Promise<void> {
    const repeat = options?.repeat ?? 1, repeatGap = options?.repeatGap ?? 200;
    const ac = new AbortController(); this.activeAbort = ac;
    for (let rep = 0; rep < repeat; rep++) {
      if (ac.signal.aborted) return;
      for (const step of steps) {
        if (ac.signal.aborted) return;
        if (step.delay && step.delay > 0) { await this.sleep(step.delay, ac.signal); if (ac.signal.aborted) return; }
        this.lastTriggerTime = 0;
        await this.trigger(step.preset, { intensity: step.intensity });
      }
      if (rep < repeat - 1 && repeatGap > 0) await this.sleep(repeatGap, ac.signal);
    }
  }

  /** Create a DragHaptics instance bound to this engine. */
  drag(options?: DragHapticsOptions): DragHaptics { return new DragHaptics(this, options); }

  /** Cancel any in-progress pattern or vibration. */
  cancel(): void { this.activeAbort?.abort(); this.activeAbort = null; if (this.platform === 'vibration' && hasVib()) navigator.vibrate(0); }

  setEnabled(e: boolean): void { this.enabled = e; if (!e) this.cancel(); }
  get isEnabled(): boolean { return this.enabled; }
  setAudioLayer(e: boolean): void { this.useAudio = e; }
  setAudioGain(g: number): void { this.audio?.setGain(g); }
  setThrottle(ms: number): void { this.throttleMs = Math.max(0, ms); }
  registerPreset(name: string, preset: HapticPreset): void { presets[name] = preset; }

  /** Clean up all resources (audio context, iOS DOM elements). */
  destroy(): void { this.cancel(); this.iosPool?.destroy(); this.iosPool = null; this.audio?.destroy(); this.audio = null; }

  /** Resolve any HapticInput into a Vibration[] and optional preset metadata. */
  private resolveInput(input?: HapticInput): { vibrations: Vibration[]; preset: HapticPreset | null } {
    if (input == null) return { vibrations: presets.medium.pattern, preset: presets.medium };
    if (typeof input === 'string') { const p = presets[input]; if (!p) { console.warn(`[haptics] Unknown: "${input}"`); return { vibrations: [], preset: null }; } return { vibrations: p.pattern, preset: p }; }
    if (typeof input === 'number') return { vibrations: [{ duration: input }], preset: null };
    if (typeof input === 'object' && !Array.isArray(input) && 'pattern' in input) return { vibrations: (input as HapticPreset).pattern, preset: input as HapticPreset };
    if (Array.isArray(input)) {
      if (!input.length) return { vibrations: [], preset: null };
      if (typeof input[0] === 'number') { const r: Vibration[] = []; let pd = 0; for (let i = 0; i < input.length; i++) { if (i % 2 === 0) { r.push({ duration: input[i] as number, ...(pd > 0 ? { delay: pd } : {}) }); pd = 0; } else pd = input[i] as number; } return { vibrations: r, preset: null }; }
      return { vibrations: input as Vibration[], preset: null };
    }
    return { vibrations: [], preset: null };
  }

  /** Android: convert Vibration[] to flat pattern and vibrate for its duration. */
  private async fireAndroid(vibs: Vibration[], di: number, ef?: EasingFn): Promise<void> {
    const pat = buildAndroidPattern(vibs, di, ef); if (!pat.length) return;
    navigator.vibrate(pat);
    const total = pat.reduce((s, v) => s + v, 0);
    if (total > 0) { const ac = new AbortController(); this.activeAbort = ac; await this.sleep(total, ac.signal); }
  }

  /** iOS: fire switch-checkbox toggles with gaps between them. */
  private async fireIOS(vibs: Vibration[], pr: HapticPreset | null, di: number): Promise<void> {
    if (!this.iosPool) return;
    const plan = iosPlan(vibs, pr, di); if (plan.ticks <= 0) return;
    const ac = new AbortController(); this.activeAbort = ac;
    for (let i = 0; i < plan.ticks; i++) {
      if (ac.signal.aborted) return;
      this.iosPool.fire();
      if (i < plan.ticks - 1) { const gap = plan.gaps[i] ?? IOS_GAP; if (gap > 0) { await this.sleep(gap, ac.signal); if (ac.signal.aborted) return; } }
    }
  }

  /** Cancellable setTimeout wrapped in a Promise. */
  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise(resolve => {
      if (signal.aborted) { resolve(); return; }
      const t = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

let _default: HapticEngine | null = null;

/** Get or create the shared default engine instance. */
export function getDefaultEngine(opts?: HapticEngineOptions): HapticEngine { if (!_default) _default = new HapticEngine(opts); return _default; }

/** Fire a one-shot haptic using the default engine. */
export async function haptic(input?: HapticInput, options?: TriggerOptions): Promise<void> { return getDefaultEngine().trigger(input, options); }
