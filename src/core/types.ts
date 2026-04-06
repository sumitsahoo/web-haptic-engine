import type { easings } from "./easings";

export interface Vibration {
  duration: number;
  intensity?: number;
  delay?: number;
}

export type HapticPattern = number[] | Vibration[];
export type EasingFn = (t: number) => number;
export type ImpulseType = "tick" | "tap" | "thud" | "click" | "snap" | "buzz" | "confirm" | "harsh";

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
export interface TriggerOptions {
  intensity?: number;
  audio?: boolean;
}
export interface HapticEngineOptions {
  debug?: boolean;
  /** Minimum ms between trigger() calls. Default 25. */
  throttleMs?: number;
  /** Enable audio impulse layer. Default true. */
  audioLayer?: boolean;
  /** Master gain for audio impulses (0-1). Default 0.6. */
  audioGain?: number;
}

export interface SequenceStep {
  preset: string;
  delay?: number;
  intensity?: number;
}
export interface SequenceOptions {
  repeat?: number;
  repeatGap?: number;
}

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
