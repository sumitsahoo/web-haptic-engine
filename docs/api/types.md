# Types

All types are exported from the main package entry point.

```ts
import type {
  HapticInput,
  HapticPreset,
  HapticPattern,
  HapticEngineOptions,
  TriggerOptions,
  Vibration,
  ImpulseType,
  EasingFn,
  SequenceStep,
  SequenceOptions,
  DragHapticsOptions,
} from "web-haptic-engine";
```

## HapticInput

The flexible input type accepted by `trigger()` and `haptic()`.

```ts
type HapticInput =
  | number          // Duration in ms
  | string          // Preset name
  | HapticPattern   // Array of numbers or Vibration objects
  | HapticPreset;   // Full preset object
```

## HapticPreset

Defines a complete haptic pattern with platform-specific configuration.

```ts
interface HapticPreset {
  pattern: Vibration[];
  description?: string;
  iosTicks?: number;
  iosTickGap?: number;
  impulse?: ImpulseType;
  easing?: keyof typeof easings;
}
```

## Vibration

A single vibration segment within a pattern.

```ts
interface Vibration {
  duration: number;    // Vibration duration (ms)
  intensity?: number;  // Intensity multiplier (0-1)
  delay?: number;      // Delay before this segment (ms)
}
```

## HapticPattern

```ts
type HapticPattern = number[] | Vibration[];
```

## ImpulseType

The 8 available audio impulse types.

```ts
type ImpulseType =
  | "tick"      // 320Hz bright click
  | "tap"       // 220Hz softer tap
  | "thud"      // 160Hz heavy impact
  | "click"     // 400Hz ultra-short
  | "snap"      // 500Hz sharp snap
  | "buzz"      // 200Hz sustained
  | "confirm"   // 280Hz dual-tone
  | "harsh";    // 180Hz multi-harmonic
```

## HapticEngineOptions

```ts
interface HapticEngineOptions {
  throttleMs?: number;   // Min ms between triggers (default: 25)
  audioLayer?: boolean;  // Enable audio layer (default: true)
  audioGain?: number;    // Master audio gain 0-1 (default: 0.6)
}
```

## TriggerOptions

```ts
interface TriggerOptions {
  intensity?: number;    // Intensity multiplier 0-1
}
```

## SequenceStep

```ts
interface SequenceStep {
  preset: string;        // Preset name
  delay?: number;        // Delay before this step (ms)
}
```

## SequenceOptions

```ts
interface SequenceOptions {
  repeat?: number;       // Number of repetitions (default: 1)
  repeatGap?: number;    // Gap between repetitions (ms)
}
```

## DragHapticsOptions

```ts
interface DragHapticsOptions {
  fireDist?: number;                              // Pixels between ticks (default: 18)
  impulse?: ImpulseType;                          // Audio impulse type (default: "tick")
  intensity?: number;                             // Intensity 0-1 (default: 0.6)
  onTick?: (velocity: number, ticks: number) => void;  // Tick callback
}
```

## EasingFn

```ts
type EasingFn = (t: number) => number;
```

## Easings

The `easings` object provides 6 built-in easing functions:

```ts
import { easings } from "web-haptic-engine";

easings.linear;    // y = x
easings.easeIn;    // Quadratic ease-in
easings.easeOut;   // Quadratic ease-out
easings.easeInOut; // Quadratic ease-in-out
easings.bounce;    // Bouncy elastic
easings.spring;    // Spring overshoot
```
