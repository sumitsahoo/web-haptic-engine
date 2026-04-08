// ---------------------------------------------------------------------------
// Android Vibration Pattern Builder
//
// Converts Vibration[] into a flat number[] for navigator.vibrate().
// Uses PWM (Pulse Width Modulation) for intensity: rapid on/off cycles
// within the full duration so perceived strength varies while total
// vibration time stays correct.
// ---------------------------------------------------------------------------

import { MAX_SEG_MS, PWM_CYCLE } from "../core";
import type { EasingFn, Vibration } from "../core";

/**
 * Apply PWM modulation to a single vibration duration at a given intensity.
 * At intensity 1 the full duration is on. At lower intensities, rapid on/off
 * cycles fill the duration so the motor runs for the correct wall-clock time.
 */
function modulateVibration(duration: number, intensity: number): number[] {
  if (intensity >= 1) return [duration];
  if (intensity <= 0) return [];

  const onTime = Math.max(1, Math.round(PWM_CYCLE * intensity));
  const offTime = PWM_CYCLE - onTime;
  const result: number[] = [];

  let remaining = duration;
  while (remaining >= PWM_CYCLE) {
    result.push(onTime);
    result.push(offTime);
    remaining -= PWM_CYCLE;
  }
  if (remaining > 0) {
    const remOn = Math.max(1, Math.round(remaining * intensity));
    result.push(remOn);
    const remOff = remaining - remOn;
    if (remOff > 0) result.push(remOff);
  }

  return result;
}

export function buildAndroidPattern(vibs: Vibration[], di: number, ef?: EasingFn): number[] {
  const flat: number[] = [];
  const count = vibs.length;
  for (let idx = 0; idx < count; idx++) {
    const v = vibs[idx];
    let intensity = Math.max(0, Math.min(1, v.intensity ?? di));
    if (ef && count > 1) intensity *= Math.max(0.1, ef(idx / (count - 1)));

    const dur = Math.min(v.duration, MAX_SEG_MS);

    // Prepend delay: merge into trailing off-time or add new gap
    if (v.delay && v.delay > 0) {
      if (flat.length > 0 && flat.length % 2 === 0) {
        flat[flat.length - 1] += v.delay;
      } else {
        if (!flat.length) flat.push(0);
        flat.push(v.delay);
      }
    }

    const modulated = modulateVibration(dur, intensity);

    if (modulated.length === 0) {
      // Zero intensity — treat as silence
      if (flat.length > 0 && flat.length % 2 === 0) {
        flat[flat.length - 1] += dur;
      } else if (dur > 0) {
        flat.push(0);
        flat.push(dur);
      }
      continue;
    }

    // Ensure we're at an even index (on-time position) before appending
    if (flat.length > 0 && flat.length % 2 === 1) flat.push(0);

    for (const seg of modulated) {
      flat.push(seg);
    }
  }
  return flat;
}
