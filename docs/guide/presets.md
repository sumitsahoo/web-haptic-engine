# Presets

Web Haptic Engine ships with **23 built-in presets** organized into four categories. Each preset defines a vibration pattern, an audio impulse type, and iOS Taptic configuration.

## Using Presets

```ts
import { haptic, presets } from "web-haptic-engine";

// By name
await haptic("success");

// Access preset data
console.log(presets.success);
// { pattern: [...], impulse: "confirm", iosTicks: 2, ... }
```

## Notification

For user-facing alerts and confirmations.

| Preset | Description | Impulse | iOS Ticks |
|--------|------------|---------|-----------|
| `success` | Ascending double-tap | `confirm` | 2 |
| `warning` | Two hesitant taps | `harsh` | 2 |
| `error` | Three rapid harsh taps | `harsh` | 3 |
| `confirm` | Strong double-tap | `confirm` | 2 |
| `reject` | Harsh staccato triple | `harsh` | 3 |

```ts
await haptic("success"); // Task completed
await haptic("error");   // Validation failed
await haptic("warning"); // Caution needed
```

## Impact

For direct interaction feedback like button presses.

| Preset | Description | Impulse | iOS Ticks |
|--------|------------|---------|-----------|
| `light` | Single light tap | `tick` | 1 |
| `medium` | Moderate tap | `tap` | 1 |
| `heavy` | Strong tap | `thud` | 2 |
| `soft` | Cushioned tap | `tap` | 1 |
| `rigid` | Hard crisp snap | `snap` | 1 |

```ts
await haptic("light");  // Subtle button press
await haptic("heavy");  // Impactful action
await haptic("rigid");  // Crisp toggle
```

## Selection

For UI navigation and selection changes.

| Preset | Description | Impulse | iOS Ticks |
|--------|------------|---------|-----------|
| `selection` | Subtle tick | `tick` | 1 |
| `tick` | Crisp tick | `click` | 1 |
| `click` | Ultra-short click | `click` | 1 |
| `snap` | Sharp snap | `snap` | 1 |

```ts
await haptic("selection"); // List item selected
await haptic("tick");      // Picker value changed
await haptic("click");     // Toggle switch
```

## Expressive

For rich, characterful interactions.

| Preset | Description | Impulse | iOS Ticks |
|--------|------------|---------|-----------|
| `nudge` | Two quick taps | `tap` | 2 |
| `buzz` | Sustained vibration | `buzz` | 8 |
| `heartbeat` | Heartbeat rhythm | `thud` | 4 |
| `spring` | Bouncy pulses | `tap` | 4 |
| `rampUp` | Escalating intensity | `tap` | 3 |
| `rampDown` | Decreasing intensity | `tap` | 3 |
| `thud` | Heavy impact | `thud` | 2 |
| `trill` | Rapid flutter | `click` | 5 |
| `pulse` | Rhythmic pulse | `tap` | 3 |

```ts
await haptic("heartbeat"); // Favorite/like animation
await haptic("spring");    // Bounce-in transition
await haptic("buzz");      // Long press feedback
```

## Custom Presets

Register your own presets with `registerPreset`:

```ts
import { HapticEngine } from "web-haptic-engine";

const engine = new HapticEngine();

engine.registerPreset("doubleSnap", {
  pattern: [
    { duration: 8, intensity: 1.0 },
    { delay: 40, duration: 8, intensity: 1.0 },
  ],
  impulse: "snap",
  iosTicks: 2,
  iosTickGap: 50,
  easing: "easeOut",
});

await engine.trigger("doubleSnap");
```

### Preset Structure

```ts
interface HapticPreset {
  pattern: Vibration[];      // Vibration segments
  description?: string;      // Human-readable description
  iosTicks?: number;         // Number of iOS Taptic ticks
  iosTickGap?: number;       // Gap between iOS ticks (ms)
  impulse?: ImpulseType;     // Audio impulse type
  easing?: string;           // Easing function name
}

interface Vibration {
  duration: number;          // Vibration duration (ms)
  intensity?: number;        // Intensity 0-1
  delay?: number;            // Delay before this segment (ms)
}
```
