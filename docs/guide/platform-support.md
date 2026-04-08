# Platform Support

Web Haptic Engine automatically detects the best available haptic method on each platform and falls back gracefully.

## How It Works

```
┌─────────────────────────┐
│   engine.trigger("success") │
└────────────┬────────────┘
             │
     ┌───────▼───────┐
     │ Platform Check │
     └───┬───┬───┬───┘
         │   │   │
    ┌────▼┐ ┌▼──┐ ┌▼────────┐
    │ Android │ │ iOS │ │ Desktop  │
    │ vibrate │ │Taptic│ │ (fallback)│
    └────┬┘ └┬──┘ └┬────────┘
         │   │     │
         └───▼─────┘
         Audio Layer
      (all platforms)
```

## Android

- **Method:** `navigator.vibrate()` API
- **Capabilities:** Full vibration patterns with intensity and timing control
- **Audio:** Audio impulse layer reinforces each haptic event
- **Drag:** Full haptic + audio on touch events

```ts
// Check at runtime
HapticEngine.supportsVibration; // true on Android Chrome
```

## iOS (Safari 17.5+)

- **Method:** iOS Taptic Engine via hidden checkbox switch toggle
- **Capabilities:** Crisp Taptic ticks (no pattern granularity)
- **Audio:** Audio layer augments the Taptic feedback
- **Drag limitation:** During continuous drag (`touchmove`), only audio fires — Taptic requires user activation (`click` events)

::: warning iOS Taptic Requirements
iOS Taptic feedback requires Safari 17.5+ and only fires on user-initiated `click` events. During drag interactions, the audio layer provides the feedback instead.
:::

```ts
// Check at runtime
HapticEngine.supportsIOSHaptics; // true on iOS Safari 17.5+
```

## Desktop

- **Method:** Web Audio impulse synthesis only (no vibration API)
- **Capabilities:** 8 synthesized impulse types with gain control
- **Use case:** Provides auditory feedback where physical haptics aren't available

```ts
// Audio works everywhere with Web Audio support
const engine = new HapticEngine({ audioLayer: true });
```

## Audio Impulse Types

All platforms support the audio layer. These 8 impulse types are synthesized at runtime using Web Audio. The audio layer tracks all active sources (both single-fire and sequenced) for proper cancellation with a short gain ramp-down to prevent click/pop artifacts:

| Impulse   | Frequency | Character              |
| --------- | --------- | ---------------------- |
| `tick`    | 320 Hz    | Bright, crisp click    |
| `tap`     | 220 Hz    | Warm, soft tap         |
| `thud`    | 160 Hz    | Deep, heavy impact     |
| `click`   | 400 Hz    | Sharp, ultra-short     |
| `snap`    | 500 Hz    | Crisp, snappy          |
| `buzz`    | 200 Hz    | Sustained vibration    |
| `confirm` | 280 Hz    | Dual-tone affirming    |
| `harsh`   | 180 Hz    | Gritty, multi-harmonic |

## Feature Detection

```ts
import { HapticEngine } from "web-haptic-engine";

// Static checks (no instantiation needed)
HapticEngine.supportsVibration; // Android vibration API
HapticEngine.supportsIOSHaptics; // iOS Taptic Engine
HapticEngine.isSupported; // Any native haptic method

// The engine gracefully degrades — audio always works
const engine = new HapticEngine();
await engine.trigger("success"); // Works on all platforms
```

## Browser Compatibility

| Feature       | Chrome | Safari | Firefox | Edge |
| ------------- | ------ | ------ | ------- | ---- |
| Vibration API | 32+    | No     | 16+     | 79+  |
| iOS Taptic    | No     | 17.5+  | No      | No   |
| Web Audio     | 35+    | 14.1+  | 25+     | 79+  |

::: tip
The library always works — on platforms without native haptics, the audio layer provides feedback. No conditional code needed in your app.
:::
