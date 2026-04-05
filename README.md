<div align="center">

  <h1>Web Haptic Engine</h1>

  <p>A cross-platform haptic feedback engine for the web.<br>
  Supports Android vibration, iOS Taptic feedback, audio impulse synthesis, drag haptics, and 23 built-in presets.</p>

  <p>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="MIT License" /></a>
    <img src="https://img.shields.io/badge/platform-web-blue" alt="Platform" />
    <img src="https://img.shields.io/badge/typescript-strict-blue" alt="TypeScript" />
  </p>

</div>

---

## Features

| Category | Details |
|---|---|
| **Android Vibration** | Full `navigator.vibrate()` pattern support with intensity-scaled durations |
| **iOS Taptic** | Exploits the `<input type="checkbox" switch>` toggle to trigger native Taptic Engine feedback |
| **Audio Impulse Layer** | 8 synthesized AudioBuffer impulses (`tick`, `tap`, `thud`, `click`, `snap`, `buzz`, `confirm`, `harsh`) |
| **Drag Haptics** | Touchmove-driven haptic feedback with distance threshold — works reliably on iOS |
| **23 Presets** | Ready-to-use patterns: `success`, `warning`, `error`, `heartbeat`, `spring`, `buzz`, and more |
| **Sequences** | Chain presets with delays, repeats, and custom gaps |
| **Easing Functions** | `linear`, `easeIn`, `easeOut`, `easeInOut`, `bounce`, `spring` |
| **Zero Dependencies** | No external runtime dependencies — pure TypeScript |

---

## Installation

```bash
npm install web-haptic-engine
```

```bash
pnpm add web-haptic-engine
```

```bash
yarn add web-haptic-engine
```

---

## Quick Start

### Basic Usage

```ts
import { haptic } from 'web-haptic-engine'

// Fire a preset
await haptic('success')
await haptic('heartbeat')
await haptic('click')

// Fire with custom intensity
await haptic('heavy', { intensity: 0.8 })

// Fire a raw duration (ms)
await haptic(50)
```

### Using the Engine

```ts
import { HapticsEngine } from 'web-haptic-engine'

const engine = new HapticsEngine({
  throttleMs: 25,
  audioLayer: true,
  audioGain: 0.6,
})

// Trigger presets
await engine.trigger('confirm')
await engine.trigger('buzz', { intensity: 1.0 })

// Sequences
await engine.sequence([
  { preset: 'rampUp' },
  { preset: 'confirm', delay: 200 },
], { repeat: 2, repeatGap: 300 })

// Custom presets
engine.registerPreset('myPattern', {
  pattern: [
    { duration: 20, intensity: 0.6 },
    { delay: 50, duration: 40, intensity: 1.0 },
  ],
  impulse: 'tap',
  iosTicks: 2,
  iosTickGap: 60,
})
await engine.trigger('myPattern')

// Cleanup
engine.destroy()
```

### Drag Haptics

```ts
import { HapticsEngine } from 'web-haptic-engine'

const engine = new HapticsEngine()

const drag = engine.drag({
  fireDist: 18,    // px between haptic fires
  impulse: 'tick', // audio impulse type
  intensity: 0.6,
  onTick: (velocity, ticks) => {
    console.log(`Tick #${ticks} at ${velocity}px/s`)
  },
})

// Bind to a DOM element
const unbind = drag.bind(document.getElementById('drag-area')!)

// Later: cleanup
unbind()
drag.destroyAll()
engine.destroy()
```

---

## Presets

| Preset | Description | Impulse |
|---|---|---|
| `success` | Ascending double-tap | `confirm` |
| `warning` | Two hesitant taps | `harsh` |
| `error` | Three rapid harsh taps | `harsh` |
| `confirm` | Strong double-tap confirm | `confirm` |
| `reject` | Harsh staccato triple | `harsh` |
| `light` | Single light tap | `tick` |
| `medium` | Moderate tap | `tap` |
| `heavy` | Strong tap | `thud` |
| `soft` | Cushioned tap | `tap` |
| `rigid` | Hard crisp snap | `snap` |
| `selection` | Subtle tick | `tick` |
| `tick` | Crisp tick | `click` |
| `click` | Ultra-short click | `click` |
| `snap` | Sharp snap | `snap` |
| `nudge` | Two quick taps | `tap` |
| `buzz` | Sustained vibration | `buzz` |
| `heartbeat` | Heartbeat rhythm | `thud` |
| `spring` | Bouncy pulses | `tap` |
| `rampUp` | Escalating | `tap` |
| `rampDown` | Decreasing | `tap` |
| `thud` | Heavy impact | `thud` |
| `trill` | Rapid flutter | `click` |
| `pulse` | Rhythmic pulse | `tap` |

---

## API Reference

### `HapticsEngine`

```ts
const engine = new HapticsEngine(options?: HapticsEngineOptions)
```

| Option | Type | Default | Description |
|---|---|---|---|
| `throttleMs` | `number` | `25` | Minimum ms between triggers |
| `audioLayer` | `boolean` | `true` | Enable audio impulse layer |
| `audioGain` | `number` | `0.6` | Master audio gain (0–1) |

**Methods:**

| Method | Description |
|---|---|
| `trigger(input?, options?)` | Fire a haptic pattern |
| `sequence(steps, options?)` | Play a sequence of presets |
| `drag(options?)` | Create a `DragHaptics` instance |
| `cancel()` | Cancel active haptic playback |
| `setEnabled(enabled)` | Enable/disable the engine |
| `setAudioLayer(enabled)` | Toggle audio layer |
| `setAudioGain(gain)` | Set audio gain (0–1) |
| `setThrottle(ms)` | Set throttle interval |
| `registerPreset(name, preset)` | Register a custom preset |
| `fireHapticTick(intensity)` | Fire a single platform tick |
| `fireImpulse(type, intensity)` | Fire a single audio impulse |
| `destroy()` | Clean up all resources |

**Static Properties:**

| Property | Description |
|---|---|
| `HapticsEngine.supportsVibration` | `true` if `navigator.vibrate` is available |
| `HapticsEngine.supportsIOSHaptics` | `true` if iOS Taptic switch is supported |
| `HapticsEngine.isSupported` | `true` if any haptic method is available |

### `DragHaptics`

```ts
const drag = engine.drag(options?: DragHapticsOptions)
```

| Option | Type | Default | Description |
|---|---|---|---|
| `fireDist` | `number` | `18` | Minimum px moved to trigger next haptic |
| `impulse` | `ImpulseType` | `'tick'` | Audio impulse type |
| `intensity` | `number` | `0.6` | Haptic intensity |
| `onTick` | `function` | — | Callback `(velocity, ticks) => void` |

### `haptic()` (convenience)

```ts
import { haptic } from 'web-haptic-engine'

await haptic('success')              // preset name
await haptic(50)                     // raw duration ms
await haptic([20, 10, 30])           // pattern array
await haptic('heavy', { intensity: 1 }) // with options
```

---

## Platform Support

| Platform | Haptic Method | Audio |
|---|---|---|
| **Android** | `navigator.vibrate()` | AudioContext impulses |
| **iOS Safari** | `<input switch>` Taptic toggle | AudioContext impulses |
| **Desktop** | — | AudioContext impulses (fallback) |

---

## Tech Stack

| Tool | Purpose |
|---|---|
| [TypeScript](https://www.typescriptlang.org/) | Type-safe source code |
| [tsdown](https://tsdown.dev/) | Library bundling |
| [Vitest](https://vitest.dev/) | Unit testing |
| [Vite+](https://vite.dev/) | Unified toolchain |

---

## Development

```bash
# Install dependencies
vp install

# Build the library
vp pack

# Run tests
vp test

# Watch mode (rebuild on changes)
vp pack --watch
```

---

## Demo

An interactive demo is included in the `demo/` directory. It showcases all 23 presets, drag haptics, impulse buffers, sequences, and real-time controls for intensity and audio gain.

```bash
# Install dependencies (if not already done)
vp install

# Start the demo dev server
vp dev --config demo/vite.config.ts
```

This launches a Vite dev server. Open the URL shown in the terminal (typically `http://localhost:5173`) in your browser. For the full haptic experience, open it on a mobile device — Android for vibration, iOS Safari for Taptic feedback. On desktop, audio impulses still play as a fallback.

---

## Project Structure

```
web-haptic-engine/
├── src/
│   ├── index.ts            # Public API exports
│   └── haptic-engine.ts    # Core engine implementation
├── demo/
│   ├── index.html          # Demo page
│   ├── main.ts             # Demo app (imports from library)
│   └── vite.config.ts      # Vite config for demo dev server
├── tests/
│   └── index.test.ts       # Unit tests
├── tsdown.config.ts        # Library build config
├── vite.config.ts          # Vite+ unified config
├── tsconfig.json           # TypeScript config
└── package.json
```

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Built with TypeScript and Web Audio API</sub>
</div>
