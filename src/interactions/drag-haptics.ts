// ---------------------------------------------------------------------------
// Drag Haptics
//
// Binds touch and mouse events to an element and fires haptic/audio feedback
// as the user drags. Feedback fires when the pointer moves past a distance
// threshold (fireDist, default 18px) or a time-based fallback (80ms with
// 2px min movement) to ensure slow drags still feel responsive.
//
// Input handling:
//   Touch events are used on touch-capable devices (iOS, Android) to
//   preserve native haptic integration. Mouse events (mousedown/mousemove/
//   mouseup) handle desktop trackpad and mouse drags. To prevent double-
//   firing on devices that emit both touch and mouse events, mouse handlers
//   are skipped when a touch sequence is active.
//
// Platform behaviour:
//   Android — Full haptic (navigator.vibrate) + audio on every tick.
//   iOS     — Audio ticks during the drag. Taptic fires on clean taps via
//             touchend (iOS Safari only grants switch-checkbox activation
//             from click/clean-tap touchend, not during continuous drags).
//   Desktop — Audio impulses only (no vibration API).
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
  /** Set during a touch sequence to prevent mouse handlers from double-firing. */
  private touchActive = false;

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
    // --- Shared drag logic ---

    const startDrag = (x: number, y: number) => {
      this.curX = this.lastFireX = x;
      this.curY = this.lastFireY = y;
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

    const moveDrag = (x: number, y: number) => {
      if (!this.active) return;
      this.curX = x;
      this.curY = y;

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

    const endDrag = () => {
      if (!this.active) return;
      this.active = false;
      // On iOS clean taps, touchend grants activation so Taptic fires.
      // On drag-end touchend, iOS withholds activation — only audio plays.
      this.engine.trigger("selection", { intensity: this.opts.intensity });
    };

    // --- Touch events (iOS / Android) ---

    const onTouchStart = (e: TouchEvent) => {
      this.touchActive = true;
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      moveDrag(t.clientX, t.clientY);
    };

    const onTouchEnd = () => {
      endDrag();
      // Delay clearing touchActive so that the synthetic mousedown
      // fired after touchend is still suppressed.
      setTimeout(() => {
        this.touchActive = false;
      }, 400);
    };

    const onTouchCancel = () => {
      this.active = false;
      this.touchActive = false;
    };

    // --- Mouse events (desktop trackpad / mouse) ---

    const onMouseDown = (e: MouseEvent) => {
      // Skip if this is a touch-originated mouse event
      if (this.touchActive) return;
      // Only primary button
      if (e.button !== 0) return;
      startDrag(e.clientX, e.clientY);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (this.touchActive) return;
      moveDrag(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      if (this.touchActive) return;
      endDrag();
    };

    // Touch listeners on the element
    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: true });
    element.addEventListener("touchend", onTouchEnd, { passive: true });
    element.addEventListener("touchcancel", onTouchCancel, { passive: true });

    // Mouse listeners: mousedown on element, move/up on window to track
    // drags that leave the element bounds (matches trackpad UX expectations).
    element.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    const unbind = () => {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
      element.removeEventListener("touchcancel", onTouchCancel);
      element.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
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
