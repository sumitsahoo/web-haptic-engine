// ---------------------------------------------------------------------------
// Platform Detection
//
// Three modes:
//   'vibration'  — Android / browsers with navigator.vibrate()
//   'ios-switch' — iOS Safari (no vibrate, touch-capable, switch attr supported)
//   'none'       — SSR or desktop without haptic support
// ---------------------------------------------------------------------------

export type Platform = "vibration" | "ios-switch" | "none";

export const hasVib = (): boolean =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

const isIOS = (): boolean => {
  if (typeof document === "undefined") return false;
  if (hasVib()) return false;
  if (!("ontouchstart" in window) && !navigator.maxTouchPoints) return false;
  try {
    const el = document.createElement("input");
    el.type = "checkbox";
    el.setAttribute("switch", "");
    return el.getAttribute("switch") !== null;
  } catch {
    return false;
  }
};

export const detectPlatform = (): Platform => {
  if (typeof window === "undefined") return "none";
  if (hasVib()) return "vibration";
  if (isIOS()) return "ios-switch";
  return "none";
};

export const supportsIOSHaptics: boolean = typeof document !== "undefined" ? isIOS() : false;
