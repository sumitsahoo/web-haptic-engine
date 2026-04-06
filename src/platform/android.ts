// ---------------------------------------------------------------------------
// Android Vibration Pattern Builder
//
// Converts Vibration[] into a flat number[] for navigator.vibrate().
// Applies intensity scaling and optional easing to each segment.
// ---------------------------------------------------------------------------

import { MAX_SEG_MS } from "../core";
import type { EasingFn, Vibration } from "../core";

export function buildAndroidPattern(vibs: Vibration[], di: number, ef?: EasingFn): number[] {
  const flat: number[] = [];
  const count = vibs.length;
  for (let idx = 0; idx < count; idx++) {
    const v = vibs[idx];
    let intensity = Math.max(0, Math.min(1, v.intensity ?? di));
    if (ef && count > 1) intensity *= Math.max(0.1, ef(idx / (count - 1)));
    const sc = Math.max(
      1,
      Math.round(Math.min(v.duration, MAX_SEG_MS) * Math.max(0.15, intensity)),
    );
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
