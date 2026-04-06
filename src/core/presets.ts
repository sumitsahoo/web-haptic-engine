import type { HapticPreset } from "./types";

export const presets: Record<string, HapticPreset> = {
  // Notification
  success: {
    description: "Ascending double-tap",
    pattern: [
      { duration: 30, intensity: 0.5 },
      { delay: 65, duration: 45, intensity: 1 },
    ],
    iosTicks: 2,
    iosTickGap: 80,
    impulse: "confirm",
  },
  warning: {
    description: "Two hesitant taps",
    pattern: [
      { duration: 40, intensity: 0.7 },
      { delay: 120, duration: 35, intensity: 0.5 },
    ],
    iosTicks: 2,
    iosTickGap: 140,
    impulse: "harsh",
  },
  error: {
    description: "Three rapid harsh taps",
    pattern: [
      { duration: 45, intensity: 0.9 },
      { delay: 50, duration: 45, intensity: 0.9 },
      { delay: 50, duration: 45, intensity: 0.9 },
    ],
    iosTicks: 3,
    iosTickGap: 65,
    impulse: "harsh",
  },
  confirm: {
    description: "Strong double-tap confirm",
    pattern: [
      { duration: 35, intensity: 0.9 },
      { delay: 100, duration: 50, intensity: 1 },
    ],
    iosTicks: 2,
    iosTickGap: 110,
    impulse: "confirm",
  },
  reject: {
    description: "Harsh staccato triple",
    pattern: [
      { duration: 30, intensity: 1 },
      { delay: 30, duration: 30, intensity: 1 },
      { delay: 30, duration: 50, intensity: 1 },
    ],
    iosTicks: 3,
    iosTickGap: 45,
    impulse: "harsh",
  },
  // Impact
  light: {
    description: "Single light tap",
    pattern: [{ duration: 12, intensity: 0.35 }],
    iosTicks: 1,
    impulse: "tick",
  },
  medium: {
    description: "Moderate tap",
    pattern: [{ duration: 28, intensity: 0.65 }],
    iosTicks: 1,
    impulse: "tap",
  },
  heavy: {
    description: "Strong tap",
    pattern: [{ duration: 40, intensity: 1 }],
    iosTicks: 2,
    iosTickGap: 30,
    impulse: "thud",
  },
  soft: {
    description: "Cushioned tap",
    pattern: [{ duration: 45, intensity: 0.45 }],
    iosTicks: 1,
    impulse: "tap",
  },
  rigid: {
    description: "Hard crisp snap",
    pattern: [{ duration: 8, intensity: 1 }],
    iosTicks: 1,
    impulse: "snap",
  },
  // Selection
  selection: {
    description: "Subtle tick",
    pattern: [{ duration: 6, intensity: 0.25 }],
    iosTicks: 1,
    impulse: "tick",
  },
  // Custom
  tick: {
    description: "Crisp tick",
    pattern: [{ duration: 10, intensity: 0.5 }],
    iosTicks: 1,
    impulse: "click",
  },
  click: {
    description: "Ultra-short click",
    pattern: [{ duration: 5, intensity: 0.8 }],
    iosTicks: 1,
    impulse: "click",
  },
  snap: {
    description: "Sharp snap",
    pattern: [{ duration: 6, intensity: 1 }],
    iosTicks: 1,
    impulse: "snap",
  },
  nudge: {
    description: "Two quick taps",
    pattern: [
      { duration: 60, intensity: 0.7 },
      { delay: 70, duration: 40, intensity: 0.3 },
    ],
    iosTicks: 2,
    iosTickGap: 90,
    impulse: "tap",
  },
  buzz: {
    description: "Sustained vibration",
    pattern: [{ duration: 800, intensity: 1 }],
    iosTicks: 8,
    iosTickGap: 50,
    impulse: "buzz",
  },
  heartbeat: {
    description: "Heartbeat rhythm",
    pattern: [
      { duration: 35, intensity: 0.8 },
      { delay: 80, duration: 25, intensity: 0.5 },
      { delay: 300, duration: 35, intensity: 0.8 },
      { delay: 80, duration: 25, intensity: 0.5 },
    ],
    iosTicks: 4,
    iosTickGap: 0,
    impulse: "thud",
  },
  spring: {
    description: "Bouncy pulses",
    pattern: [
      { duration: 40, intensity: 1 },
      { delay: 50, duration: 30, intensity: 0.7 },
      { delay: 45, duration: 20, intensity: 0.45 },
      { delay: 40, duration: 12, intensity: 0.25 },
    ],
    iosTicks: 4,
    iosTickGap: 55,
    impulse: "tap",
    easing: "bounce",
  },
  rampUp: {
    description: "Escalating",
    pattern: [
      { duration: 12, intensity: 0.2 },
      { delay: 50, duration: 18, intensity: 0.4 },
      { delay: 45, duration: 25, intensity: 0.65 },
      { delay: 40, duration: 35, intensity: 1 },
    ],
    iosTicks: 4,
    iosTickGap: 60,
    impulse: "tap",
    easing: "easeIn",
  },
  rampDown: {
    description: "Decreasing",
    pattern: [
      { duration: 35, intensity: 1 },
      { delay: 45, duration: 25, intensity: 0.6 },
      { delay: 50, duration: 15, intensity: 0.3 },
      { delay: 55, duration: 8, intensity: 0.15 },
    ],
    iosTicks: 3,
    iosTickGap: 65,
    impulse: "tap",
    easing: "easeOut",
  },
  thud: {
    description: "Heavy impact",
    pattern: [
      { duration: 50, intensity: 1 },
      { delay: 40, duration: 25, intensity: 0.35 },
    ],
    iosTicks: 2,
    iosTickGap: 50,
    impulse: "thud",
  },
  trill: {
    description: "Rapid flutter",
    pattern: [
      { duration: 15, intensity: 0.8 },
      { delay: 25, duration: 15, intensity: 0.8 },
      { delay: 25, duration: 15, intensity: 0.8 },
      { delay: 25, duration: 15, intensity: 0.8 },
      { delay: 25, duration: 15, intensity: 0.8 },
    ],
    iosTicks: 5,
    iosTickGap: 35,
    impulse: "click",
  },
  pulse: {
    description: "Rhythmic pulse",
    pattern: [
      { duration: 30, intensity: 0.6 },
      { delay: 150, duration: 30, intensity: 0.6 },
      { delay: 150, duration: 30, intensity: 0.6 },
    ],
    iosTicks: 3,
    iosTickGap: 180,
    impulse: "tap",
  },
};
