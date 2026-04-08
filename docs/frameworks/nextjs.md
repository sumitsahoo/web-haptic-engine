# Next.js

Web Haptic Engine is fully compatible with Next.js (both App Router and Pages Router). Since haptics rely on browser APIs, the key consideration is ensuring the library only runs on the client.

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

## App Router (Recommended)

### Client Components

Haptic code must run in client components. Add the `"use client"` directive:

```tsx
"use client";

import { haptic } from "web-haptic-engine";

export function LikeButton() {
  return <button onClick={() => haptic("success")}>Like</button>;
}
```

### `useHaptic` Hook

```tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { HapticEngine, type HapticInput, type TriggerOptions } from "web-haptic-engine";

export function useHaptic(options?: {
  throttleMs?: number;
  audioLayer?: boolean;
  audioGain?: number;
}) {
  const engineRef = useRef<HapticEngine | null>(null);

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new HapticEngine(options);
    }
    return engineRef.current;
  }, []);

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

### Using in a Page

```tsx
// app/page.tsx — Server Component (default)
import { LikeButton } from "./like-button";

export default function Page() {
  return (
    <main>
      <h1>My App</h1>
      <LikeButton />
    </main>
  );
}
```

```tsx
// app/like-button.tsx — Client Component
"use client";

import { useHaptic } from "./use-haptic";

export function LikeButton() {
  const { trigger } = useHaptic();

  return <button onClick={() => trigger("success", { intensity: 0.8 })}>Like</button>;
}
```

## Pages Router

With the Pages Router, components run on both server and client by default. Use dynamic imports or guard browser API access:

### Dynamic Import (Preferred)

```tsx
import dynamic from "next/dynamic";

const HapticButton = dynamic(() => import("../components/haptic-button"), {
  ssr: false,
});

export default function Page() {
  return <HapticButton />;
}
```

```tsx
// components/haptic-button.tsx
import { haptic } from "web-haptic-engine";

export default function HapticButton() {
  return <button onClick={() => haptic("success")}>Like</button>;
}
```

### Runtime Guard

Alternatively, guard the import in an effect:

```tsx
import { useEffect, useRef } from "react";

export function HapticButton() {
  const hapticRef = useRef<typeof import("web-haptic-engine") | null>(null);

  useEffect(() => {
    import("web-haptic-engine").then((mod) => {
      hapticRef.current = mod;
    });
  }, []);

  const handleClick = () => {
    hapticRef.current?.haptic("success");
  };

  return <button onClick={handleClick}>Like</button>;
}
```

## Drag Haptics with Next.js

```tsx
"use client";

import { useEffect, useRef } from "react";
import { HapticEngine, DragHaptics } from "web-haptic-engine";

export function DragArea() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const engine = new HapticEngine();
    const drag = new DragHaptics(engine, {
      fireDist: 18,
      impulse: "tick",
      intensity: 0.6,
    });

    const unbind = drag.bind(el);

    return () => {
      unbind();
      drag.destroyAll();
      engine.destroy();
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        height: 200,
        background: "#f0f4fa",
        borderRadius: 12,
        touchAction: "none",
      }}
    >
      Drag here
    </div>
  );
}
```

## Middleware & API Routes

Web Haptic Engine is a client-side library. Do not import it in:

- `middleware.ts`
- API routes (`app/api/` or `pages/api/`)
- Server Components (without `"use client"`)
- `getServerSideProps` / `getStaticProps`

## SSR Safety

The library performs runtime checks for browser APIs (`navigator`, `document`, `AudioContext`). It will not throw if these are missing — it simply disables the corresponding features. However, the module itself should only be imported in client-side contexts to avoid bundler warnings.

::: tip Best Practice
Always use `"use client"` (App Router) or `dynamic(() => import(...), { ssr: false })` (Pages Router) for components that use haptics. This ensures the module is only loaded in the browser.
:::

## Tips

- **Tree-shaking works:** Next.js + webpack/turbopack will tree-shake unused exports from `web-haptic-engine` since it's marked as `sideEffects: false`.
- **No polyfills needed:** The library gracefully degrades on all platforms.
- **Bundle size:** The library is ~25 KB (ESM, minified) with zero dependencies.
