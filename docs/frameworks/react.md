# React

Web Haptic Engine works out of the box with React. Since the library is pure TypeScript with no DOM framework dependencies, you can use it directly in any React project.

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

## Basic Usage

The simplest approach — use the `haptic()` convenience function in event handlers:

```tsx
import { haptic } from "web-haptic-engine";

function LikeButton() {
  return <button onClick={() => haptic("success")}>Like</button>;
}
```

## `useHaptic` Hook

For more control, create a custom hook that manages a `HapticEngine` instance:

```tsx
import { useEffect, useRef, useCallback } from "react";
import { HapticEngine, type HapticInput, type TriggerOptions } from "web-haptic-engine";

export function useHaptic(options?: {
  throttleMs?: number;
  audioLayer?: boolean;
  audioGain?: number;
}) {
  const engineRef = useRef<HapticEngine | null>(null);

  // Lazily create the engine on first use
  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new HapticEngine(options);
    }
    return engineRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  const trigger = useCallback(
    (input?: HapticInput, triggerOptions?: TriggerOptions) => {
      return getEngine().trigger(input, triggerOptions);
    },
    [getEngine],
  );

  return { trigger, getEngine };
}
```

**Usage:**

```tsx
function MyComponent() {
  const { trigger } = useHaptic({ audioGain: 0.5 });

  return (
    <div>
      <button onClick={() => trigger("success")}>Save</button>
      <button onClick={() => trigger("error")}>Delete</button>
      <button onClick={() => trigger("light")}>Tap</button>
    </div>
  );
}
```

## `useDragHaptics` Hook

For drag interactions, bind haptics to an element ref:

```tsx
import { useEffect, useRef } from "react";
import { HapticEngine, DragHaptics, type DragHapticsOptions } from "web-haptic-engine";

export function useDragHaptics(options?: DragHapticsOptions) {
  const ref = useRef<HTMLElement>(null);
  const engineRef = useRef<HapticEngine | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const engine = new HapticEngine();
    engineRef.current = engine;

    const drag = new DragHaptics(engine, options);
    const unbind = drag.bind(el);

    return () => {
      unbind();
      drag.destroyAll();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  return ref;
}
```

**Usage:**

```tsx
function Slider() {
  const dragRef = useDragHaptics({
    fireDist: 18,
    impulse: "tick",
    intensity: 0.6,
    onTick: (velocity, ticks) => {
      console.log(`Tick #${ticks} at ${Math.round(velocity)}px/s`);
    },
  });

  return (
    <div ref={dragRef} style={{ width: 300, height: 200, background: "#f0f4fa", borderRadius: 12 }}>
      Drag here
    </div>
  );
}
```

## Haptic Button Component

A reusable button component with built-in haptic feedback:

```tsx
import { haptic, type HapticInput } from "web-haptic-engine";

interface HapticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  preset?: HapticInput;
  intensity?: number;
}

function HapticButton({
  preset = "light",
  intensity = 0.6,
  onClick,
  children,
  ...props
}: HapticButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    haptic(preset, { intensity });
    onClick?.(e);
  };

  return (
    <button onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

// Usage
<HapticButton preset="success" intensity={0.8}>
  Submit
</HapticButton>;
```

## Sequences in React

```tsx
import { useCallback } from "react";
import { HapticEngine } from "web-haptic-engine";

function NotificationDemo() {
  const playSequence = useCallback(async () => {
    const engine = new HapticEngine();
    await engine.sequence([{ preset: "rampUp" }, { preset: "confirm", delay: 200 }], { repeat: 1 });
    engine.destroy();
  }, []);

  return <button onClick={playSequence}>Play Sequence</button>;
}
```

## Platform Detection

Show different UI based on haptic capabilities:

```tsx
import { HapticEngine } from "web-haptic-engine";

function HapticStatus() {
  const platform = HapticEngine.supportsVibration
    ? "Android (Vibration)"
    : HapticEngine.supportsIOSHaptics
      ? "iOS (Taptic)"
      : "Desktop (Audio only)";

  return <span>Haptics: {platform}</span>;
}
```

## Tips

- **Event handlers only:** Haptics should be triggered from user interactions (clicks, touches). Browsers block vibration and audio outside of user gestures.
- **Singleton is fine:** The `haptic()` convenience function uses a shared engine — no need to create one per component.
- **Cleanup:** If you create your own `HapticEngine`, call `engine.destroy()` in your cleanup/unmount logic.
- **SSR safe:** The library checks for browser APIs at runtime. It won't throw during server-side rendering — see the [Next.js guide](/frameworks/nextjs) for details.
