// ============================================================================
// haptic-engine.ts  v5.2
//
// DRAG HAPTICS — TOUCHMOVE-DRIVEN:
//
// v5.0 used velocity-gated setTimeout intervals for drag haptics. On iOS,
// setTimeout callbacks lose Safari's user activation context, so the iOS
// switch checkbox toggle (Taptic feedback) stopped firing after the first tick.
//
// v5.1 tried a constant 50ms setTimeout chain (like buzz), but setTimeout
// callbacks still lack user activation on iOS — only the first tick worked.
//
// v5.2 fix: fire haptics directly from touchmove events. Every touchmove
// IS a user gesture, so iOS Taptic (switch toggle) and audio both work
// reliably on every fire. Distance threshold (18px) controls density:
// fast drag = frequent ticks, slow drag = sparse ticks.
//
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
  iosTicks?: number;
  iosTickGap?: number;
  impulse?: ImpulseType;
  easing?: keyof typeof easings;
}

export type HapticInput = number | string | HapticPattern | HapticPreset;
export interface TriggerOptions { intensity?: number; audio?: boolean; }
export interface HapticsEngineOptions {
  debug?: boolean;
  throttleMs?: number;
  audioLayer?: boolean;
  audioGain?: number;
}

// ---------------------------------------------------------------------------
// Easing
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

const MAX_SEG_MS = 1000;
const DEF_INTENSITY = 0.5;
const DEF_THROTTLE = 25;
const IOS_GAP = 55;
const IOS_MIN = 0.12;

// Minimum px moved since last haptic fire to trigger the next one
const DRAG_FIRE_DIST = 18;

// ---------------------------------------------------------------------------
// Impulse Buffer Synthesizer
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
// ---------------------------------------------------------------------------

class AudioImpulseLayer {
  private ctx: AudioContext | null = null;
  private lib: ImpulseLibrary | null = null;
  private mg: number;
  private unlocked = false;

  constructor(gain: number = 0.6) { this.mg = gain; }

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
// ---------------------------------------------------------------------------

export const presets: Record<string, HapticPreset> = {
  success:   { description: 'Ascending double-tap', pattern: [{ duration: 30, intensity: .5 },{ delay: 65, duration: 45, intensity: 1 }], iosTicks: 2, iosTickGap: 80, impulse: 'confirm' },
  warning:   { description: 'Two hesitant taps', pattern: [{ duration: 40, intensity: .7 },{ delay: 120, duration: 35, intensity: .5 }], iosTicks: 2, iosTickGap: 140, impulse: 'harsh' },
  error:     { description: 'Three rapid harsh taps', pattern: [{ duration: 45, intensity: .9 },{ delay: 50, duration: 45, intensity: .9 },{ delay: 50, duration: 45, intensity: .9 }], iosTicks: 3, iosTickGap: 65, impulse: 'harsh' },
  confirm:   { description: 'Strong double-tap confirm', pattern: [{ duration: 35, intensity: .9 },{ delay: 100, duration: 50, intensity: 1 }], iosTicks: 2, iosTickGap: 110, impulse: 'confirm' },
  reject:    { description: 'Harsh staccato triple', pattern: [{ duration: 30, intensity: 1 },{ delay: 30, duration: 30, intensity: 1 },{ delay: 30, duration: 50, intensity: 1 }], iosTicks: 3, iosTickGap: 45, impulse: 'harsh' },
  light:     { description: 'Single light tap', pattern: [{ duration: 12, intensity: .35 }], iosTicks: 1, impulse: 'tick' },
  medium:    { description: 'Moderate tap', pattern: [{ duration: 28, intensity: .65 }], iosTicks: 1, impulse: 'tap' },
  heavy:     { description: 'Strong tap', pattern: [{ duration: 40, intensity: 1 }], iosTicks: 2, iosTickGap: 30, impulse: 'thud' },
  soft:      { description: 'Cushioned tap', pattern: [{ duration: 45, intensity: .45 }], iosTicks: 1, impulse: 'tap' },
  rigid:     { description: 'Hard crisp snap', pattern: [{ duration: 8, intensity: 1 }], iosTicks: 1, impulse: 'snap' },
  selection: { description: 'Subtle tick', pattern: [{ duration: 6, intensity: .25 }], iosTicks: 1, impulse: 'tick' },
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
// Platform detection
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
// Android vibration
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
// iOS switch pool
// ---------------------------------------------------------------------------

class IOSSwitchPool {
  private container: HTMLDivElement;
  private pairs: Array<{ input: HTMLInputElement; label: HTMLLabelElement }> = [];
  private nextIndex = 0;

  constructor() {
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed', top: '-9999px', left: '-9999px',
      width: '1px', height: '1px', overflow: 'hidden',
      opacity: '0', pointerEvents: 'none', contain: 'strict',
    } satisfies Partial<CSSStyleDeclaration>);
    this.container.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.container);
    for (let i = 0; i < 6; i++) {
      const id = `__hp${i}_${Date.now()}`;
      const input = document.createElement('input');
      input.type = 'checkbox'; input.setAttribute('switch', ''); input.id = id; input.tabIndex = -1;
      const label = document.createElement('label'); label.htmlFor = id;
      this.container.appendChild(input); this.container.appendChild(label);
      this.pairs.push({ input, label });
    }
  }

  fire(): void {
    const p = this.pairs[this.nextIndex];
    this.nextIndex = (this.nextIndex + 1) % this.pairs.length;
    p.label.click();
  }

  destroy(): void { this.container.remove(); this.pairs = []; }
}

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
// Drag Haptics — touchmove-driven (user activation on every fire)
// ---------------------------------------------------------------------------

export interface DragHapticsOptions {
  /** Minimum px moved since last fire to trigger next haptic (default: 18). */
  fireDist?: number;
  /** Impulse type for audio (default: 'tick'). */
  impulse?: ImpulseType;
  /** Intensity (default: 0.6). */
  intensity?: number;
  /** Callback on each haptic fire. */
  onTick?: (velocity: number, ticks: number) => void;
}

export class DragHaptics {
  private engine: HapticsEngine;
  private opts: Required<Omit<DragHapticsOptions, 'onTick'>> & { onTick?: DragHapticsOptions['onTick'] };
  curX = 0;
  curY = 0;
  private lastFireX = 0;
  private lastFireY = 0;
  private lastFireT = 0;
  private active = false;
  private tickCount = 0;
  private cleanup: (() => void)[] = [];

  constructor(engine: HapticsEngine, options: DragHapticsOptions = {}) {
    this.engine = engine;
    this.opts = {
      fireDist: options.fireDist ?? DRAG_FIRE_DIST,
      impulse: options.impulse ?? 'tick',
      intensity: options.intensity ?? 0.6,
      onTick: options.onTick,
    };
  }

  bind(element: HTMLElement): () => void {
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      this.curX = this.lastFireX = t.clientX;
      this.curY = this.lastFireY = t.clientY;
      this.lastFireT = performance.now();
      this.active = true;
      this.tickCount = 0;
      this.fireTick(0);
    };

    const onMove = (e: TouchEvent) => {
      if (!this.active) return;
      const t = e.touches[0];
      this.curX = t.clientX;
      this.curY = t.clientY;

      if (this.distFromLastFire() >= this.opts.fireDist) {
        // Compute velocity from distance and time since last fire
        const now = performance.now();
        const dt = (now - this.lastFireT) / 1000;
        const dist = this.distFromLastFire();
        const velocity = dt > 0.001 ? dist / dt : 0;
        this.fireTick(velocity);
      }
    };

    const onEnd = () => { this.active = false; };

    element.addEventListener('touchstart', onStart, { passive: true });
    element.addEventListener('touchmove', onMove, { passive: true });
    element.addEventListener('touchend', onEnd, { passive: true });
    element.addEventListener('touchcancel', onEnd, { passive: true });

    const unbind = () => {
      element.removeEventListener('touchstart', onStart);
      element.removeEventListener('touchmove', onMove);
      element.removeEventListener('touchend', onEnd);
      element.removeEventListener('touchcancel', onEnd);
      onEnd();
    };
    this.cleanup.push(unbind);
    return unbind;
  }

  private distFromLastFire(): number {
    const dx = this.curX - this.lastFireX;
    const dy = this.curY - this.lastFireY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private fireTick(velocity: number): void {
    // Fire haptic motor directly — no cancel(), no vibrate(0) overhead.
    // Velocity scales pulse count so faster drag = stronger feel.
    this.engine.fireDragTick(this.opts.intensity, velocity);

    // Audio — respects the engine's audio toggle
    this.engine.fireImpulse(this.opts.impulse, this.opts.intensity);

    this.lastFireX = this.curX;
    this.lastFireY = this.curY;
    this.lastFireT = performance.now();

    this.tickCount++;
    this.opts.onTick?.(velocity, this.tickCount);
  }

  destroyAll(): void {
    this.active = false;
    this.cleanup.forEach(fn => fn());
    this.cleanup = [];
  }
}

// ---------------------------------------------------------------------------
// Sequence
// ---------------------------------------------------------------------------

export interface SequenceStep { preset: string; delay?: number; intensity?: number; }
export interface SequenceOptions { repeat?: number; repeatGap?: number; }

// ---------------------------------------------------------------------------
// Main Engine
// ---------------------------------------------------------------------------

export class HapticsEngine {
  private platform: Platform;
  private iosPool: IOSSwitchPool | null = null;
  private audio: AudioImpulseLayer | null = null;
  private useAudio: boolean;
  private throttleMs: number;
  private enabled = true;
  private lastTriggerTime = 0;
  private activeAbort: AbortController | null = null;

  static readonly supportsVibration: boolean = hasVib();
  static readonly supportsIOSHaptics: boolean = typeof document !== 'undefined' ? isIOS() : false;
  static readonly isSupported: boolean = HapticsEngine.supportsVibration || HapticsEngine.supportsIOSHaptics;

  constructor(options: HapticsEngineOptions = {}) {
    this.throttleMs = options.throttleMs ?? DEF_THROTTLE;
    this.useAudio = options.audioLayer ?? true;
    this.platform = detectPlatform();
    if (this.platform === 'ios-switch') this.iosPool = new IOSSwitchPool();
    // Always create audio — DragHaptics needs it even when preset audio is off
    this.audio = new AudioImpulseLayer(options.audioGain ?? 0.6);

    if (typeof document !== 'undefined') {
      const unlock = () => { this.audio?.unlock(); };
      document.addEventListener('touchstart', unlock, { once: true, passive: true, capture: true });
      document.addEventListener('click', unlock, { once: true, capture: true });
    }
  }

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

  /** Fire audio impulse. force=true bypasses the audio toggle. */
  fireImpulse(type: ImpulseType, intensity: number, force?: boolean): void {
    if ((force || this.useAudio) && this.audio) {
      this.audio.unlock();
      this.audio.fire(type, intensity);
    }
  }

  /** Fire one platform haptic tick. */
  fireHapticTick(intensity: number): void {
    if (this.platform === 'vibration') {
      try { navigator.vibrate(Math.max(1, Math.round(10 * intensity))); } catch {}
    } else if (this.platform === 'ios-switch' && this.iosPool) {
      try { this.iosPool.fire(); } catch {}
    }
  }

  /**
   * Fire haptic for drag — no cancel()/vibrate(0), so the motor isn't killed
   * between rapid touchmove fires. Velocity scales pulse count (1–3):
   * faster drag = more taps per fire = stronger tactile feel.
   */
  fireDragTick(intensity: number, velocity: number): void {
    const taps = Math.max(1, Math.min(3, Math.ceil(velocity / 400)));
    if (this.platform === 'vibration') {
      // Single pulse scaled by intensity + velocity, long enough to feel (12–25ms)
      const dur = Math.max(12, Math.min(25, Math.round(15 * intensity + velocity / 200)));
      if (taps === 1) {
        try { navigator.vibrate(dur); } catch {}
      } else {
        // Multi-pulse: [on, gap, on, gap, on] — rapid burst
        const pat: number[] = [];
        for (let i = 0; i < taps; i++) { if (i > 0) pat.push(6); pat.push(dur); }
        try { navigator.vibrate(pat); } catch {}
      }
    } else if (this.platform === 'ios-switch' && this.iosPool) {
      try { for (let i = 0; i < taps; i++) this.iosPool.fire(); } catch {}
    }
  }

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

  drag(options?: DragHapticsOptions): DragHaptics { return new DragHaptics(this, options); }
  cancel(): void { this.activeAbort?.abort(); this.activeAbort = null; if (this.platform === 'vibration' && hasVib()) navigator.vibrate(0); }
  setEnabled(e: boolean): void { this.enabled = e; if (!e) this.cancel(); }
  get isEnabled(): boolean { return this.enabled; }
  setAudioLayer(e: boolean): void { this.useAudio = e; }
  setAudioGain(g: number): void { this.audio?.setGain(g); }
  setThrottle(ms: number): void { this.throttleMs = Math.max(0, ms); }
  registerPreset(name: string, preset: HapticPreset): void { presets[name] = preset; }
  destroy(): void { this.cancel(); this.iosPool?.destroy(); this.iosPool = null; this.audio?.destroy(); this.audio = null; }

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

  private async fireAndroid(vibs: Vibration[], di: number, ef?: EasingFn): Promise<void> {
    const pat = buildAndroidPattern(vibs, di, ef); if (!pat.length) return;
    navigator.vibrate(pat);
    const total = pat.reduce((s, v) => s + v, 0);
    if (total > 0) { const ac = new AbortController(); this.activeAbort = ac; await this.sleep(total, ac.signal); }
  }

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

  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise(resolve => {
      if (signal.aborted) { resolve(); return; }
      const t = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }
}

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

let _default: HapticsEngine | null = null;
export function getDefaultEngine(opts?: HapticsEngineOptions): HapticsEngine { if (!_default) _default = new HapticsEngine(opts); return _default; }
export async function haptic(input?: HapticInput, options?: TriggerOptions): Promise<void> { return getDefaultEngine().trigger(input, options); }
