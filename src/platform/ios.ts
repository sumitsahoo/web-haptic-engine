// ---------------------------------------------------------------------------
// iOS Switch Checkbox Pool
//
// Creates hidden <input type="checkbox" switch> elements whose label.click()
// toggles trigger the iOS Taptic Engine. A pool of 6 pairs avoids toggling
// the same checkbox in rapid succession. Elements use opacity:0.01 at 1x1px
// (kept in the render tree; display:none may cause iOS to skip the haptic).
// ---------------------------------------------------------------------------

import { IOS_GAP, IOS_MIN } from "../core";
import type { HapticPreset, Vibration } from "../core";

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
// iOS Tick Planner
//
// Determines how many switch toggles and at what intervals to fire for a
// given preset on iOS. If the preset defines iosTicks/iosTickGap those are
// used directly; otherwise ticks are inferred from the Vibration[] pattern.
// ---------------------------------------------------------------------------

export function iosPlan(
  vibs: Vibration[],
  pr: HapticPreset | null,
  di: number,
): { ticks: number; gaps: number[] } {
  if (pr?.iosTicks !== undefined) {
    const bt = pr.iosTicks,
      sc = Math.max(1, Math.round(bt * Math.max(0.25, di)));
    const gap = pr.iosTickGap ?? IOS_GAP;
    if (gap === 0 && vibs.length > 1) {
      const gs: number[] = [];
      for (let i = 1; i < vibs.length && gs.length < sc - 1; i++)
        gs.push((vibs[i].delay ?? 0) + vibs[i - 1].duration);
      return { ticks: Math.min(sc, gs.length + 1), gaps: gs };
    }
    return { ticks: sc, gaps: Array(Math.max(0, sc - 1)).fill(gap) };
  }
  let t = 0;
  const gs: number[] = [];
  for (const v of vibs) {
    if ((v.intensity ?? di) >= IOS_MIN) {
      if (t > 0) gs.push((v.delay ?? 0) + (vibs[t - 1]?.duration ?? 0));
      t++;
    }
  }
  const sc = Math.max(1, Math.round(t * Math.max(0.25, di)));
  return { ticks: sc, gaps: gs.slice(0, Math.max(0, sc - 1)) };
}
