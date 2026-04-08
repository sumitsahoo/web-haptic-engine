# DragHaptics

Provides distance-based, velocity-responsive haptic feedback for drag interactions. Automatically handles touch and mouse events.

## Import

```ts
import { DragHaptics, HapticEngine } from "web-haptic-engine";
```

## Constructor

```ts
const drag = new DragHaptics(engine: HapticEngine, options?: DragHapticsOptions);
```

### Options

| Option      | Type                                        | Default  | Description                                      |
| ----------- | ------------------------------------------- | -------- | ------------------------------------------------ |
| `fireDist`  | `number`                                    | `18`     | Minimum pixels moved to trigger each haptic tick |
| `impulse`   | `ImpulseType`                               | `"tick"` | Audio impulse type for drag ticks                |
| `intensity` | `number`                                    | `0.6`    | Haptic/audio intensity (`0` – `1`)               |
| `onTick`    | `(velocity: number, ticks: number) => void` | —        | Callback fired on each haptic tick               |

## Methods

### `bind()`

```ts
bind(element: HTMLElement): () => void
```

Attach drag haptics to a DOM element. Returns an unbind function.

```ts
const unbind = drag.bind(document.getElementById("slider")!);

// Later, to remove listeners:
unbind();
```

### `destroyAll()`

```ts
destroyAll(): void
```

Remove all event listeners and clean up resources.

## Properties

### `curX` / `curY`

```ts
readonly curX: number;
readonly curY: number;
```

Current drag position (updated during drag).

## Usage Example

```ts
import { HapticEngine, DragHaptics } from "web-haptic-engine";

const engine = new HapticEngine();

const drag = new DragHaptics(engine, {
  fireDist: 18,
  impulse: "tick",
  intensity: 0.6,
  onTick: (velocity, ticks) => {
    console.log(`Tick #${ticks} at ${Math.round(velocity)}px/s`);
  },
});

const el = document.getElementById("drag-area")!;
const unbind = drag.bind(el);
```

## How It Works

1. On `pointerdown` / `touchstart`, DragHaptics starts tracking the pointer position
2. On each `pointermove` / `touchmove`, it calculates the distance moved since the last tick
3. When the distance exceeds `fireDist` pixels, it fires a haptic tick via the engine
4. The `onTick` callback receives the current velocity (px/s) and total tick count
5. A time-based fallback triggers ticks after 80ms even with minimal movement (2px)

::: tip
On iOS, Taptic feedback requires a `click` event. During continuous drag, only audio impulses fire. The experience is still smooth thanks to the audio layer.
:::

## Shortcut via Engine

You can also create DragHaptics via the engine directly:

```ts
const drag = engine.drag({
  fireDist: 18,
  impulse: "tick",
  onTick: (vel, ticks) => {
    /* ... */
  },
});
```
