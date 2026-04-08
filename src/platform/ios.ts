// ---------------------------------------------------------------------------
// iOS Switch Checkbox Pool
//
// Creates hidden <input type="checkbox" switch> elements whose label.click()
// toggles trigger the iOS Taptic Engine. A pool of 6 pairs avoids toggling
// the same checkbox in rapid succession. Elements use opacity:0.01 at 1x1px
// (kept in the render tree; display:none may cause iOS to skip the haptic).
// ---------------------------------------------------------------------------

import type { Vibration } from "../core";

/** Minimum toggle interval at intensity 1 (ms) — roughly every frame. */
const TOGGLE_MIN = 16;
/** Toggle interval range above min (ms). At intensity 0.5: ~108ms gap. */
const TOGGLE_RANGE = 184;

export class IOSSwitchPool {
  private labels: HTMLLabelElement[] = [];
  private nextIndex = 0;

  constructor() {
    for (let i = 0; i < 6; i++) {
      const id = `__hp${i}_${Date.now()}`;

      const label = document.createElement("label");
      label.setAttribute("for", id);
      label.style.position = "fixed";
      label.style.top = "0";
      label.style.left = "0";
      label.style.width = "1px";
      label.style.height = "1px";
      label.style.overflow = "hidden";
      label.style.opacity = "0.01";
      label.style.pointerEvents = "none";
      label.style.userSelect = "none";
      label.setAttribute("aria-hidden", "true");

      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      input.id = id;
      input.tabIndex = -1;
      // Reset styles and ensure native switch appearance for Taptic integration
      input.style.all = "initial";
      input.style.appearance = "auto";

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
// iOS rAF-based haptic driver
//
// Uses requestAnimationFrame to fire switch toggles at intensity-dependent
// intervals. This avoids setTimeout drift over long patterns and produces
// tighter, more continuous haptic feedback. Phase boundaries from the
// Vibration[] pattern are respected — toggles only fire during "on" phases.
// ---------------------------------------------------------------------------

interface Phase {
  end: number;
  isOn: boolean;
  intensity: number;
}

/** Build phase boundaries from a Vibration[] pattern with a default intensity. */
export function buildPhases(vibs: Vibration[], di: number): { phases: Phase[]; total: number } {
  const phases: Phase[] = [];
  let cumulative = 0;
  for (const vib of vibs) {
    const intensity = Math.max(0, Math.min(1, vib.intensity ?? di));
    const delay = vib.delay ?? 0;
    if (delay > 0) {
      cumulative += delay;
      phases.push({ end: cumulative, isOn: false, intensity: 0 });
    }
    cumulative += vib.duration;
    phases.push({ end: cumulative, isOn: true, intensity });
  }
  return { phases, total: cumulative };
}

/** Calculate the toggle interval for a given intensity. */
function toggleInterval(intensity: number): number {
  return TOGGLE_MIN + (1 - intensity) * TOGGLE_RANGE;
}

/**
 * Drive iOS haptics via a rAF loop. Fires the first toggle synchronously
 * (required for user-gesture context on iOS Safari), then continues via
 * requestAnimationFrame with intensity-dependent toggle intervals.
 *
 * Returns an object with a cancel() method to abort early.
 */
export function iosRafDrive(
  pool: IOSSwitchPool,
  vibs: Vibration[],
  di: number,
  onTick?: (intensity: number) => void,
): { promise: Promise<void>; cancel: () => void } {
  const { phases, total } = buildPhases(vibs, di);
  if (phases.length === 0 || total <= 0) {
    return { promise: Promise.resolve(), cancel: () => {} };
  }

  let cancelled = false;
  let rafId: number | null = null;

  const cancel = () => {
    cancelled = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const promise = new Promise<void>((resolve) => {
    // Fire first toggle synchronously for user-gesture context
    const firstPhase = phases[0];
    let firstFired = false;
    if (firstPhase.isOn) {
      pool.fire();
      onTick?.(firstPhase.intensity);
      firstFired = true;
    }

    let startTime = 0;
    let lastToggleTime = -1;

    const loop = (time: number) => {
      if (cancelled) {
        resolve();
        return;
      }

      if (startTime === 0) {
        startTime = time;
        if (firstFired) lastToggleTime = time;
      }
      const elapsed = time - startTime;

      if (elapsed >= total) {
        rafId = null;
        resolve();
        return;
      }

      // Find current phase
      let phase = phases[0];
      for (const p of phases) {
        if (elapsed < p.end) {
          phase = p;
          break;
        }
      }

      if (phase.isOn) {
        const interval = toggleInterval(phase.intensity);
        if (lastToggleTime === -1) {
          // First toggle in a new on-phase
          pool.fire();
          onTick?.(phase.intensity);
          lastToggleTime = time;
        } else if (time - lastToggleTime >= interval) {
          pool.fire();
          onTick?.(phase.intensity);
          lastToggleTime = time;
        }
      } else {
        // Reset so next on-phase fires immediately
        lastToggleTime = -1;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
  });

  return { promise, cancel };
}
