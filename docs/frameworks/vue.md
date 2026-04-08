# Vue

Web Haptic Engine integrates seamlessly with Vue 3 (Composition API and Options API). The library has no framework dependencies and works directly with Vue's reactivity system.

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

Use the `haptic()` convenience function in event handlers:

```vue
<script setup lang="ts">
import { haptic } from "web-haptic-engine";
</script>

<template>
  <button @click="haptic('success')">Like</button>
</template>
```

## `useHaptic` Composable

For more control, create a composable that manages a `HapticEngine` instance:

```ts
// composables/useHaptic.ts
import { onUnmounted, shallowRef } from "vue";
import {
  HapticEngine,
  type HapticEngineOptions,
  type HapticInput,
  type TriggerOptions,
} from "web-haptic-engine";

export function useHaptic(options?: HapticEngineOptions) {
  const engine = shallowRef<HapticEngine | null>(null);

  function getEngine(): HapticEngine {
    if (!engine.value) {
      engine.value = new HapticEngine(options);
    }
    return engine.value;
  }

  function trigger(input?: HapticInput, triggerOptions?: TriggerOptions) {
    return getEngine().trigger(input, triggerOptions);
  }

  onUnmounted(() => {
    engine.value?.destroy();
    engine.value = null;
  });

  return { trigger, getEngine };
}
```

**Usage:**

```vue
<script setup lang="ts">
import { useHaptic } from "@/composables/useHaptic";

const { trigger } = useHaptic({ audioGain: 0.5 });
</script>

<template>
  <div>
    <button @click="trigger('success')">Save</button>
    <button @click="trigger('error')">Delete</button>
    <button @click="trigger('light')">Tap</button>
  </div>
</template>
```

## `useDragHaptics` Composable

For drag interactions:

```ts
// composables/useDragHaptics.ts
import { onMounted, onUnmounted, ref, type Ref } from "vue";
import { HapticEngine, DragHaptics, type DragHapticsOptions } from "web-haptic-engine";

export function useDragHaptics(target: Ref<HTMLElement | null>, options?: DragHapticsOptions) {
  let engine: HapticEngine | null = null;
  let drag: DragHaptics | null = null;
  let unbind: (() => void) | null = null;

  const velocity = ref(0);
  const ticks = ref(0);

  onMounted(() => {
    const el = target.value;
    if (!el) return;

    engine = new HapticEngine();
    drag = new DragHaptics(engine, {
      ...options,
      onTick: (vel, t) => {
        velocity.value = Math.round(vel);
        ticks.value = t;
        options?.onTick?.(vel, t);
      },
    });

    unbind = drag.bind(el);
  });

  onUnmounted(() => {
    unbind?.();
    drag?.destroyAll();
    engine?.destroy();
  });

  return { velocity, ticks };
}
```

**Usage:**

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useDragHaptics } from "@/composables/useDragHaptics";

const dragArea = ref<HTMLElement | null>(null);
const { velocity, ticks } = useDragHaptics(dragArea, {
  fireDist: 18,
  impulse: "tick",
  intensity: 0.6,
});
</script>

<template>
  <div
    ref="dragArea"
    style="width: 100%; height: 200px; background: #f0f4fa; border-radius: 12px; touch-action: none;"
  >
    <p>Drag here</p>
    <p>Velocity: {{ velocity }}px/s | Ticks: {{ ticks }}</p>
  </div>
</template>
```

## Haptic Button Component

A reusable component with built-in haptic feedback:

```vue
<!-- components/HapticButton.vue -->
<script setup lang="ts">
import { haptic, type HapticInput } from "web-haptic-engine";

const props = withDefaults(
  defineProps<{
    preset?: HapticInput;
    intensity?: number;
  }>(),
  {
    preset: "light",
    intensity: 0.6,
  },
);

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

function handleClick(e: MouseEvent) {
  haptic(props.preset, { intensity: props.intensity });
  emit("click", e);
}
</script>

<template>
  <button @click="handleClick">
    <slot />
  </button>
</template>
```

**Usage:**

```vue
<HapticButton preset="success" :intensity="0.8" @click="onSave">
  Submit
</HapticButton>
```

## Sequences

```vue
<script setup lang="ts">
import { HapticEngine } from "web-haptic-engine";

async function playSequence() {
  const engine = new HapticEngine();
  await engine.sequence([{ preset: "rampUp" }, { preset: "confirm", delay: 200 }], { repeat: 1 });
  engine.destroy();
}
</script>

<template>
  <button @click="playSequence">Play Sequence</button>
</template>
```

## Platform Detection

```vue
<script setup lang="ts">
import { computed } from "vue";
import { HapticEngine } from "web-haptic-engine";

const platform = computed(() => {
  if (HapticEngine.supportsVibration) return "Android (Vibration)";
  if (HapticEngine.supportsIOSHaptics) return "iOS (Taptic)";
  return "Desktop (Audio only)";
});
</script>

<template>
  <span>Haptics: {{ platform }}</span>
</template>
```

## Nuxt 3

For Nuxt 3, wrap haptic components in `<ClientOnly>` or use a client-only plugin:

### Client-Only Component

```vue
<!-- pages/index.vue -->
<template>
  <ClientOnly>
    <HapticButton preset="success">Like</HapticButton>
  </ClientOnly>
</template>
```

### Client Plugin

```ts
// plugins/haptic.client.ts
import { HapticEngine } from "web-haptic-engine";

export default defineNuxtPlugin(() => {
  const engine = new HapticEngine();

  return {
    provide: {
      hapticEngine: engine,
    },
  };
});
```

```vue
<script setup lang="ts">
const { $hapticEngine } = useNuxtApp();

function handleClick() {
  $hapticEngine.trigger("success");
}
</script>
```

## Tips

- **Reactive options:** If you want to reactively change engine settings (like gain or intensity), use `watch()` to call `engine.setAudioGain()` etc.
- **Template refs:** Use `ref()` + template `ref="..."` for drag haptics targets.
- **SSR safe:** The library checks for browser APIs at runtime. Use `<ClientOnly>` in Nuxt or ensure haptic code runs in `onMounted`.
- **Tree-shaking:** The library is marked `sideEffects: false` — unused exports are eliminated by Vite.
