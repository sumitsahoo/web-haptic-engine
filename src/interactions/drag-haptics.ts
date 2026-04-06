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

import { DRAG_FIRE_DIST } from "../core";
import type { DragHapticsOptions, ImpulseType } from "../core";
import type { HapticEngine } from "../haptic-engine";

export class DragHaptics {
  private engine: HapticEngine;
  private opts: Required<Omit<DragHapticsOptions, "onTick">> & {
    onTick?: DragHapticsOptions["onTick"];
  };
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
      impulse: options.impulse ?? ("tick" as ImpulseType),
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

      if (
        dist >= this.opts.fireDist ||
        (dist >= JITTER_THRESHOLD && elapsed >= SLOW_DRAG_INTERVAL)
      ) {
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
      this.engine.trigger("selection", { intensity: this.opts.intensity });
    };

    const onCancel = () => {
      this.active = false;
    };

    element.addEventListener("touchstart", onStart, { passive: true });
    element.addEventListener("touchmove", onMove, { passive: true });
    element.addEventListener("touchend", onEnd, { passive: true });
    element.addEventListener("touchcancel", onCancel, { passive: true });

    const unbind = () => {
      element.removeEventListener("touchstart", onStart);
      element.removeEventListener("touchmove", onMove);
      element.removeEventListener("touchend", onEnd);
      element.removeEventListener("touchcancel", onCancel);
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
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
  }
}
