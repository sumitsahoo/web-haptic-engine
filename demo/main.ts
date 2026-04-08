import {
  DragHaptics,
  HapticEngine,
  presets,
  type ImpulseType,
  type SequenceStep,
  type Vibration,
} from "web-haptic-engine";

// ---------------------------------------------------------------------------
// Platform detection (for display badge)
// ---------------------------------------------------------------------------

const hasVib = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
const isAndroid =
  hasVib && typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
const isIOSSwitch = (() => {
  if (typeof document === "undefined" || hasVib) return false;
  if (!("ontouchstart" in window) && !navigator.maxTouchPoints) return false;
  try {
    const el = document.createElement("input");
    el.type = "checkbox";
    el.setAttribute("switch", "");
    return el.getAttribute("switch") !== null;
  } catch {
    return false;
  }
})();
const platformLabel = isAndroid
  ? "Android · Vibration + Audio"
  : isIOSSwitch
    ? "iOS · Taptic + Audio"
    : "Desktop · Audio Only";
const platformOk = isAndroid || isIOSSwitch;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

const engine = new HapticEngine({ throttleMs: 15, audioLayer: true, audioGain: 0.6 });

let intensity = 0.6;
let audioGain = 0.6;
let audioOn = true;

// ---------------------------------------------------------------------------
// Event log
// ---------------------------------------------------------------------------

interface LogEntry {
  name: string;
  duration: number;
  impulse: string;
}
const logs: LogEntry[] = [];

function dur(p: Vibration[]): number {
  return p.reduce((s, v) => s + (v.delay ?? 0) + v.duration, 0);
}

function renderLog(): void {
  const el = document.getElementById("log");
  if (!el) return;
  el.innerHTML = logs
    .map(
      (l) =>
        `<div class="le"><span class="p">${l.name}</span> ${l.duration}ms · ${l.impulse}</div>`,
    )
    .join("");
}

// ---------------------------------------------------------------------------
// Preset categories for display
// ---------------------------------------------------------------------------

type Category = "n" | "i" | "s" | "x";

const presetCategories: Record<string, Category> = {
  success: "n",
  warning: "n",
  error: "n",
  confirm: "n",
  reject: "n",
  light: "i",
  medium: "i",
  heavy: "i",
  soft: "i",
  rigid: "i",
  selection: "s",
  tick: "s",
  click: "s",
  snap: "s",
  nudge: "x",
  buzz: "x",
  heartbeat: "x",
  spring: "x",
  rampUp: "x",
  rampDown: "x",
  thud: "x",
  trill: "x",
  pulse: "x",
};

function fire(name: string): void {
  const el = document.querySelector(`[data-n="${name}"]`);
  if (el) {
    el.classList.remove("pop");
    void (el as HTMLElement).offsetWidth;
    el.classList.add("pop");
  }
  const preset = presets[name];
  if (preset) {
    logs.unshift({ name, duration: dur(preset.pattern), impulse: preset.impulse ?? "-" });
    if (logs.length > 10) logs.pop();
    renderLog();
  }
  void engine.trigger(name, { intensity });
}

function fireImp(type: ImpulseType): void {
  engine.fireImpulse(type, intensity, true);
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function cards(cat: Category, cols: number): string {
  const items = Object.entries(presets).filter(([k]) => presetCategories[k] === cat);
  return `<div class="g g${cols}">${items
    .map(
      ([k, v]) =>
        `<div class="hc" data-c="${cat}" data-n="${k}"><div class="rp"></div><div class="nm">${k}</div><div class="ms">${dur(v.pattern)}ms</div><div class="ap">${v.impulse ?? ""}</div></div>`,
    )
    .join("")}</div>`;
}

const impulseTypes: { type: ImpulseType; hz: string }[] = [
  { type: "tick", hz: "320Hz" },
  { type: "click", hz: "400Hz" },
  { type: "tap", hz: "220Hz" },
  { type: "snap", hz: "500Hz" },
  { type: "thud", hz: "160Hz" },
  { type: "confirm", hz: "280Hz" },
  { type: "harsh", hz: "180Hz" },
  { type: "buzz", hz: "200Hz" },
];

interface SequenceDemo {
  name: string;
  desc: string;
  steps: SequenceStep[];
  opts?: { repeat?: number; repeatGap?: number };
}

const sequences: SequenceDemo[] = [
  {
    name: "Cascade",
    desc: "success → warning → error",
    steps: [
      { preset: "success" },
      { preset: "warning", delay: 300 },
      { preset: "error", delay: 300 },
    ],
  },
  {
    name: "Buzz Burst",
    desc: "buzz → snap → buzz",
    steps: [{ preset: "buzz" }, { preset: "snap", delay: 200 }, { preset: "buzz", delay: 200 }],
  },
  {
    name: "Tension Build",
    desc: "rampUp → confirm",
    steps: [{ preset: "rampUp" }, { preset: "confirm", delay: 200 }],
  },
  {
    name: "Impact Chain",
    desc: "thud → spring",
    steps: [{ preset: "thud" }, { preset: "spring", delay: 150 }],
  },
];

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

function render(): void {
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <div class="hdr">
      <h1>Web Haptic Engine</h1>
      <p>Touch-driven haptic feedback with audio layering for richer, more immersive interactions across ${Object.keys(presets).length} built-in presets.</p>
      <div class="badge"><span class="d ${platformOk ? "ok" : "no"}"></span>${platformLabel}</div>
      <div style="margin-top:6px"><a class="doc-link" href="./docs/" target="_blank"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.414A2 2 0 0 0 15.414 6L12 2.586A2 2 0 0 0 10.586 2H6zm5 1.414L14.586 7H12a1 1 0 0 1-1-1V3.414zM5 4a1 1 0 0 1 1-1h4v3a2 2 0 0 0 2 2h3v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4zm2 7a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H7zm0 2a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H7zm0 2a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1H7z"/></svg>Documentation</a></div>
    </div>

    <div class="sec">
      <div class="ctrl ctrls-group">
        <div class="row">
          <div><div class="l">Audio Layer</div><div class="sub">Synthesized audio reinforces each haptic event</div></div>
          <div class="sw ${audioOn ? "on" : ""}" id="at"><div class="k"></div></div>
        </div>
        <div class="ctrl-divider"></div>
        <div class="sl-row"><span class="t">Intensity</span><span class="v" id="iv">${intensity.toFixed(2)}</span></div>
        <input type="range" id="ir" min="0" max="100" value="${intensity * 100}">
        <div class="ctrl-divider"></div>
        <div class="sl-row"><span class="t">Audio Volume</span><span class="v" id="gv">${audioGain.toFixed(2)}</span></div>
        <input type="range" id="gr" min="0" max="100" value="${audioGain * 100}">
      </div>
    </div>

    <div class="sec">
      <div class="st">Drag Haptics <span class="tag tag-b">TOUCHMOVE-DRIVEN</span></div>${isIOSSwitch ? '\n      <div class="ios-hint">Taptic fires on each detent. All other feedback is audio-only on iOS.</div>' : ""}
      <div class="ctrl" style="padding:8px 13px">
        <div class="da" id="da">
          <div class="da-dot" id="dd"></div>
          <div class="da-ring" id="dr"></div>
          <div class="da-inner">
            <div class="da-txt">Drag here</div>
            <small>18px detent · haptic + audio on every touchmove</small>
          </div>
          <div class="da-stats">
            <div class="ds"><div class="dv" id="sv">0</div><div class="dl">px/s</div></div>
            <div class="ds"><div class="dv" id="stt">0</div><div class="dl">ticks</div></div>
          </div>
        </div>
      </div>
    </div>

    <div class="sec">
      <div class="st">Impulse Buffers <span class="tag tag-v">AudioBuffer</span></div>
      <div class="g g4">${impulseTypes.map((i) => `<div class="imp-btn" data-imp="${i.type}"><div class="ib-nm">${i.type}</div><div class="ib-d">${i.hz}</div></div>`).join("")}</div>
    </div>

    <div class="sec"><div class="st">Notification</div>${cards("n", 3)}</div>
    <div class="sec"><div class="st">Impact</div>${cards("i", 3)}</div>
    <div class="sec"><div class="st">Selection</div>${cards("s", 2)}</div>
    <div class="sec"><div class="st">Expressive</div>${cards("x", 3)}</div>

    <div class="sec">
      <div class="st">Sequences</div>
      <div class="sq-grid">${sequences.map((s, i) => `<div class="sq-btn" data-si="${i}"><div class="sq-nm">${s.name}</div><div class="sq-d">${s.desc}</div></div>`).join("")}</div>
    </div>

    <div class="sec"><div class="st">Event Log</div><div class="logbox" id="log"></div></div>
  `;

  // --- Event listeners ---

  document
    .querySelectorAll(".hc")
    .forEach((c) => c.addEventListener("click", () => fire((c as HTMLElement).dataset.n!)));

  document
    .querySelectorAll(".imp-btn")
    .forEach((b) =>
      b.addEventListener("click", () => fireImp((b as HTMLElement).dataset.imp as ImpulseType)),
    );

  document.getElementById("ir")!.addEventListener("input", (e) => {
    intensity = parseInt((e.target as HTMLInputElement).value, 10) / 100;
    document.getElementById("iv")!.textContent = intensity.toFixed(2);
  });

  document.getElementById("gr")!.addEventListener("input", (e) => {
    audioGain = parseInt((e.target as HTMLInputElement).value, 10) / 100;
    document.getElementById("gv")!.textContent = audioGain.toFixed(2);
    engine.setAudioGain(audioGain);
  });

  document.getElementById("at")!.addEventListener("click", () => {
    audioOn = !audioOn;
    engine.setAudioLayer(audioOn);
    document.getElementById("at")!.classList.toggle("on", audioOn);
  });

  document.querySelectorAll(".sq-btn").forEach((b) =>
    b.addEventListener("click", () => {
      const s = sequences[parseInt((b as HTMLElement).dataset.si!, 10)];
      void engine.sequence(s.steps, s.opts);
    }),
  );

  // --- Drag area ---

  const da = document.getElementById("da")!;
  const dd = document.getElementById("dd")!;
  const dr = document.getElementById("dr")!;
  const sv = document.getElementById("sv")!;
  const stt = document.getElementById("stt")!;

  const dragH = new DragHaptics(engine, {
    fireDist: 18,
    impulse: "tick",
    intensity,
    onTick: (vel: number, ticks: number) => {
      sv.textContent = String(Math.round(vel));
      stt.textContent = String(ticks);
      const r = da.getBoundingClientRect();
      dr.style.left = `${dragH.curX - r.left}px`;
      dr.style.top = `${dragH.curY - r.top}px`;
      dr.classList.remove("flash");
      void dr.offsetWidth;
      dr.classList.add("flash");
    },
  });

  // --- Touch visual tracking ---

  let touchDragging = false;

  da.addEventListener(
    "touchstart",
    (e: TouchEvent) => {
      touchDragging = true;
      const t = e.touches[0];
      const r = da.getBoundingClientRect();
      dd.style.left = `${t.clientX - r.left}px`;
      dd.style.top = `${t.clientY - r.top}px`;
      dd.classList.add("on");
      da.classList.add("dragging");
      sv.textContent = "0";
      stt.textContent = "0";
    },
    { passive: true },
  );

  da.addEventListener(
    "touchmove",
    (e: TouchEvent) => {
      const t = e.touches[0];
      const r = da.getBoundingClientRect();
      dd.style.left = `${t.clientX - r.left}px`;
      dd.style.top = `${t.clientY - r.top}px`;
    },
    { passive: true },
  );

  da.addEventListener(
    "touchend",
    () => {
      dd.classList.remove("on");
      da.classList.remove("dragging");
      setTimeout(() => {
        touchDragging = false;
      }, 400);
    },
    { passive: true },
  );

  da.addEventListener(
    "touchcancel",
    () => {
      dd.classList.remove("on");
      da.classList.remove("dragging");
      touchDragging = false;
    },
    { passive: true },
  );

  // --- Mouse visual tracking (desktop trackpad / mouse) ---

  let mouseDragging = false;

  da.addEventListener("mousedown", (e: MouseEvent) => {
    if (touchDragging || e.button !== 0) return;
    mouseDragging = true;
    const r = da.getBoundingClientRect();
    dd.style.left = `${e.clientX - r.left}px`;
    dd.style.top = `${e.clientY - r.top}px`;
    dd.classList.add("on");
    da.classList.add("dragging");
    sv.textContent = "0";
    stt.textContent = "0";
  });

  window.addEventListener("mousemove", (e: MouseEvent) => {
    if (!mouseDragging) return;
    const r = da.getBoundingClientRect();
    dd.style.left = `${e.clientX - r.left}px`;
    dd.style.top = `${e.clientY - r.top}px`;
  });

  window.addEventListener("mouseup", () => {
    if (!mouseDragging) return;
    mouseDragging = false;
    dd.classList.remove("on");
    da.classList.remove("dragging");
  });

  dragH.bind(da);
}

render();
