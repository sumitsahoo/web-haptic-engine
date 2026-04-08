# Getting Started

## Installation

::: code-group

```sh [npm]
npm install web-haptic-engine
```

```sh [pnpm]
pnpm add web-haptic-engine
```

```sh [yarn]
yarn add web-haptic-engine
```

:::

## Quick Start

The fastest way to add haptic feedback is the `haptic()` convenience function:

```ts
import { haptic } from "web-haptic-engine";

// Fire a built-in preset
await haptic("success");
await haptic("error");
await haptic("light");

// Fire with custom intensity
await haptic("heavy", { intensity: 0.8 });

// Raw duration (ms)
await haptic(50);
```

`haptic()` uses a shared singleton `HapticEngine` under the hood — no setup needed.

## Creating an Engine

For full control, instantiate your own engine:

```ts
import { HapticEngine } from "web-haptic-engine";

const engine = new HapticEngine({
  throttleMs: 25, // min ms between triggers (default: 25)
  audioLayer: true, // enable audio impulse layer (default: true)
  audioGain: 0.6, // master audio volume 0-1 (default: 0.6)
});

await engine.trigger("confirm");
await engine.trigger("heavy", { intensity: 0.8 });

// Cleanup when done
engine.destroy();
```

## Sequences

Chain multiple presets together:

```ts
await engine.sequence([{ preset: "rampUp" }, { preset: "confirm", delay: 200 }], {
  repeat: 2,
  repeatGap: 300,
});
```

## Custom Presets

Register your own patterns:

```ts
engine.registerPreset("myPattern", {
  pattern: [
    { duration: 20, intensity: 0.6 },
    { delay: 50, duration: 40, intensity: 1.0 },
  ],
  impulse: "tap",
  iosTicks: 2,
  iosTickGap: 60,
});

await engine.trigger("myPattern");
```

## Drag Haptics

Add haptic feedback to drag interactions:

```ts
import { HapticEngine, DragHaptics } from "web-haptic-engine";

const engine = new HapticEngine();
const drag = new DragHaptics(engine, {
  fireDist: 18, // px between each haptic tick
  impulse: "tick",
  intensity: 0.6,
  onTick: (velocity, ticks) => {
    console.log(`Tick #${ticks} at ${velocity}px/s`);
  },
});

const unbind = drag.bind(document.getElementById("drag-area")!);

// Later, cleanup:
unbind();
```

## What's Next?

- [Presets](/guide/presets) — browse all 23 built-in presets
- [Platform Support](/guide/platform-support) — how haptics work on each platform
- [React Guide](/frameworks/react) — integrate with React
- [Next.js Guide](/frameworks/nextjs) — integrate with Next.js
- [Vue Guide](/frameworks/vue) — integrate with Vue
- [API Reference](/api/) — full API documentation
