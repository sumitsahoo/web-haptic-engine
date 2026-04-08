# HapticEngine

The main class for triggering haptic feedback. It manages platform detection, throttling, audio synthesis, and preset registration.

## Import

```ts
import { HapticEngine, haptic } from "web-haptic-engine";
```

## Constructor

```ts
const engine = new HapticEngine(options?: HapticEngineOptions);
```

### Options

| Option       | Type      | Default | Description                                    |
| ------------ | --------- | ------- | ---------------------------------------------- |
| `throttleMs` | `number`  | `25`    | Minimum milliseconds between `trigger()` calls |
| `audioLayer` | `boolean` | `true`  | Enable the audio impulse layer                 |
| `audioGain`  | `number`  | `0.6`   | Master audio gain (`0` – `1`)                  |

## Static Properties

### `HapticEngine.supportsVibration`

```ts
static readonly supportsVibration: boolean;
```

`true` if the `navigator.vibrate()` API is available (Android browsers).

### `HapticEngine.supportsIOSHaptics`

```ts
static readonly supportsIOSHaptics: boolean;
```

`true` if the iOS Taptic Engine is available via checkbox switch (Safari 17.5+).

### `HapticEngine.isSupported`

```ts
static readonly isSupported: boolean;
```

`true` if any native haptic method (vibration or iOS Taptic) is available.

## Methods

### `trigger()`

```ts
async trigger(input?: HapticInput, options?: TriggerOptions): Promise<void>
```

Fire a haptic pattern. This is the primary method for triggering feedback.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `input` | `HapticInput` | Preset name, duration (ms), pattern array, or preset object |
| `options` | `TriggerOptions` | Optional trigger configuration |

**TriggerOptions:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `intensity` | `number` | `1.0` | Intensity multiplier (`0` – `1`) |

```ts
// Preset name
await engine.trigger("success");

// With intensity
await engine.trigger("heavy", { intensity: 0.8 });

// Raw duration
await engine.trigger(50);

// Pattern array
await engine.trigger([
  { duration: 20, intensity: 0.6 },
  { delay: 30, duration: 40, intensity: 1.0 },
]);
```

### `fireImpulse()`

```ts
fireImpulse(type: ImpulseType, intensity: number, force?: boolean): void
```

Play a single audio impulse directly.

| Name        | Type          | Description            |
| ----------- | ------------- | ---------------------- |
| `type`      | `ImpulseType` | One of 8 impulse types |
| `intensity` | `number`      | Volume `0` – `1`       |
| `force`     | `boolean`     | Bypass throttle check  |

```ts
engine.fireImpulse("tick", 0.8);
engine.fireImpulse("thud", 1.0, true); // bypass throttle
```

### `fireHapticTick()`

```ts
fireHapticTick(intensity: number): void
```

Fire a single platform haptic tick (vibration on Android, Taptic on iOS).

### `fireDragTick()`

```ts
fireDragTick(intensity: number, velocity: number): void
```

Optimized haptic tick for drag interactions. Adjusts the audio impulse based on velocity.

### `sequence()`

```ts
async sequence(steps: SequenceStep[], options?: SequenceOptions): Promise<void>
```

Play a multi-step sequence of presets.

**SequenceStep:**
| Field | Type | Description |
|-------|------|-------------|
| `preset` | `string` | Preset name to trigger |
| `delay` | `number` | Delay before this step (ms) |

**SequenceOptions:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `repeat` | `number` | `1` | Number of times to repeat |
| `repeatGap` | `number` | `0` | Gap between repetitions (ms) |

```ts
await engine.sequence([{ preset: "rampUp" }, { preset: "confirm", delay: 200 }], {
  repeat: 2,
  repeatGap: 300,
});
```

### `drag()`

```ts
drag(options?: DragHapticsOptions): DragHaptics
```

Create a [`DragHaptics`](/api/drag-haptics) instance bound to this engine.

### `cancel()`

```ts
cancel(): void
```

Cancel any active haptic sequences. Audio sources are stopped with a short gain ramp-down (~5 ms) to prevent click/pop artifacts. Both single-fire impulses (from `fire()` / iOS drag ticks) and pre-scheduled sequences are cancelled.

### `setEnabled()`

```ts
setEnabled(enabled: boolean): void
```

Enable or disable the engine globally. When disabled, all `trigger()` calls are no-ops.

### `setAudioLayer()`

```ts
setAudioLayer(enabled: boolean): void
```

Toggle the audio impulse layer on or off.

### `setAudioGain()`

```ts
setAudioGain(gain: number): void
```

Set the master audio gain (`0` – `1`).

### `setThrottle()`

```ts
setThrottle(ms: number): void
```

Set the minimum interval between `trigger()` calls.

### `registerPreset()`

```ts
registerPreset(name: string, preset: HapticPreset): void
```

Register a custom preset that can be triggered by name.

### `destroy()`

```ts
destroy(): void
```

Clean up all resources (audio context, iOS switch pool, active sequences).

## Convenience Function

### `haptic()`

```ts
import { haptic } from "web-haptic-engine";

async haptic(input?: HapticInput, options?: TriggerOptions): Promise<void>
```

A shortcut that uses a shared singleton `HapticEngine`. Equivalent to:

```ts
getDefaultEngine().trigger(input, options);
```

### `getDefaultEngine()`

```ts
import { getDefaultEngine } from "web-haptic-engine";

const engine: HapticEngine = getDefaultEngine();
```

Returns the shared singleton engine used by `haptic()`.
