import {
  DragHaptics,
  HapticsEngine,
  presets,
  type HapticPreset,
  type ImpulseType,
  type SequenceStep,
  type Vibration,
} from 'web-haptic-engine'

// ---------------------------------------------------------------------------
// Platform detection (for display badge)
// ---------------------------------------------------------------------------

const hasVib = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
const isIOSSwitch = (() => {
  if (typeof document === 'undefined' || hasVib) return false
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return false
  try {
    const el = document.createElement('input')
    el.type = 'checkbox'
    el.setAttribute('switch', '')
    return el.getAttribute('switch') !== null
  } catch {
    return false
  }
})()
const platformLabel = hasVib
  ? 'Android · Vibration + Audio'
  : isIOSSwitch
    ? 'iOS · Taptic + Audio'
    : 'Desktop · Audio Only'
const platformOk = hasVib || isIOSSwitch

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

const engine = new HapticsEngine({ throttleMs: 15, audioLayer: true, audioGain: 0.6 })

let intensity = 0.6
let audioGain = 0.6
let audioOn = true

// ---------------------------------------------------------------------------
// Event log
// ---------------------------------------------------------------------------

interface LogEntry { name: string; duration: number; impulse: string }
const logs: LogEntry[] = []

function dur(p: Vibration[]): number {
  return p.reduce((s, v) => s + (v.delay ?? 0) + v.duration, 0)
}

function renderLog(): void {
  const el = document.getElementById('log')
  if (!el) return
  el.innerHTML = logs
    .map((l) => `<div class="le"><span class="p">${l.name}</span> ${l.duration}ms · ${l.impulse}</div>`)
    .join('')
}

// ---------------------------------------------------------------------------
// Preset categories for display
// ---------------------------------------------------------------------------

type Category = 'n' | 'i' | 's' | 'x'

const presetCategories: Record<string, Category> = {
  success: 'n', warning: 'n', error: 'n', confirm: 'n', reject: 'n',
  light: 'i', medium: 'i', heavy: 'i', soft: 'i', rigid: 'i',
  selection: 's', tick: 's', click: 's', snap: 's',
  nudge: 'x', buzz: 'x', heartbeat: 'x', spring: 'x', rampUp: 'x',
  rampDown: 'x', thud: 'x', trill: 'x', pulse: 'x',
}

function fire(name: string): void {
  const el = document.querySelector(`[data-n="${name}"]`)
  if (el) {
    el.classList.remove('pop')
    void (el as HTMLElement).offsetWidth
    el.classList.add('pop')
  }
  const preset = presets[name]
  if (preset) {
    logs.unshift({ name, duration: dur(preset.pattern), impulse: preset.impulse ?? '-' })
    if (logs.length > 10) logs.pop()
    renderLog()
  }
  engine.trigger(name, { intensity })
}

function fireImp(type: ImpulseType): void {
  engine.fireImpulse(type, intensity, true)
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function cards(cat: Category, cols: number): string {
  const items = Object.entries(presets).filter(([k]) => presetCategories[k] === cat)
  return `<div class="g g${cols}">${items
    .map(
      ([k, v]) =>
        `<div class="hc" data-c="${cat}" data-n="${k}"><div class="rp"></div><div class="nm">${k}</div><div class="ms">${dur(v.pattern)}ms</div><div class="ap">${v.impulse ?? ''}</div></div>`,
    )
    .join('')}</div>`
}

const impulseTypes: { type: ImpulseType; hz: string }[] = [
  { type: 'tick', hz: '320Hz' },
  { type: 'click', hz: '400Hz' },
  { type: 'tap', hz: '220Hz' },
  { type: 'snap', hz: '500Hz' },
  { type: 'thud', hz: '160Hz' },
  { type: 'confirm', hz: '280Hz' },
  { type: 'harsh', hz: '180Hz' },
  { type: 'buzz', hz: '200Hz' },
]

interface SequenceDemo {
  name: string
  desc: string
  steps: SequenceStep[]
  opts?: { repeat?: number; repeatGap?: number }
}

const sequences: SequenceDemo[] = [
  { name: 'Cascade', desc: 'success → warning → error', steps: [{ preset: 'success' }, { preset: 'warning', delay: 300 }, { preset: 'error', delay: 300 }] },
  { name: 'Heartbeat ×2', desc: 'double heartbeat', steps: [{ preset: 'heartbeat' }], opts: { repeat: 2, repeatGap: 400 } },
  { name: 'Tension Build', desc: 'rampUp → confirm', steps: [{ preset: 'rampUp' }, { preset: 'confirm', delay: 200 }] },
  { name: 'Impact Chain', desc: 'thud → spring', steps: [{ preset: 'thud' }, { preset: 'spring', delay: 150 }] },
]

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------

function render(): void {
  const app = document.getElementById('app')!
  app.innerHTML = `
    <div class="hdr">
      <h1>Haptics Engine <em>v5.2</em></h1>
      <p>Touchmove-driven drag haptics · Impulse buffers · ${Object.keys(presets).length} presets</p>
      <div class="badge"><span class="d ${platformOk ? 'ok' : 'no'}"></span>${platformLabel}</div>
    </div>

    <div class="sec">
      <div class="info">
        <b>How drag haptics work:</b> touchstart fires the first haptic tick. Each touchmove checks if the finger moved ≥18px since the last fire — if so, fires haptic + audio. Every fire happens inside a user gesture (touchstart/touchmove), so iOS Taptic and audio work reliably. Faster drag = more ticks.
      </div>
    </div>

    <div class="sec">
      <div class="ctrl">
        <div class="row">
          <div><div class="l">Audio on Presets</div><div class="sub">Drag always fires audio + haptic regardless</div></div>
          <div class="sw ${audioOn ? 'on' : ''}" id="at"><div class="k"></div></div>
        </div>
      </div>
    </div>

    <div class="sec">
      <div class="ctrl">
        <div class="sl-row"><span class="t">Intensity</span><span class="v" id="iv">${intensity.toFixed(2)}</span></div>
        <input type="range" id="ir" min="0" max="100" value="${intensity * 100}">
      </div>
      <div class="ctrl">
        <div class="sl-row"><span class="t">Audio Volume</span><span class="v" id="gv">${audioGain.toFixed(2)}</span></div>
        <input type="range" id="gr" min="0" max="100" value="${audioGain * 100}">
      </div>
    </div>

    <div class="sec">
      <div class="st">Drag Haptics <span class="tag tag-b">TOUCHMOVE-DRIVEN</span></div>
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
      <div class="g g4">${impulseTypes.map((i) => `<div class="imp-btn" data-imp="${i.type}"><div class="ib-nm">${i.type}</div><div class="ib-d">${i.hz}</div></div>`).join('')}</div>
    </div>

    <div class="sec"><div class="st">Notification</div>${cards('n', 3)}</div>
    <div class="sec"><div class="st">Impact</div>${cards('i', 3)}</div>
    <div class="sec"><div class="st">Selection</div>${cards('s', 2)}</div>
    <div class="sec"><div class="st">Expressive</div>${cards('x', 3)}</div>

    <div class="sec">
      <div class="st">Sequences</div>
      <div class="sq-grid">${sequences.map((s, i) => `<div class="sq-btn" data-si="${i}"><div class="sq-nm">${s.name}</div><div class="sq-d">${s.desc}</div></div>`).join('')}</div>
    </div>

    <div class="sec"><div class="st">Event Log</div><div class="logbox" id="log"></div></div>
  `

  // --- Event listeners ---

  document.querySelectorAll('.hc').forEach((c) =>
    c.addEventListener('click', () => fire((c as HTMLElement).dataset.n!)),
  )

  document.querySelectorAll('.imp-btn').forEach((b) =>
    b.addEventListener('click', () => fireImp((b as HTMLElement).dataset.imp as ImpulseType)),
  )

  document.getElementById('ir')!.addEventListener('input', (e) => {
    intensity = parseInt((e.target as HTMLInputElement).value, 10) / 100
    document.getElementById('iv')!.textContent = intensity.toFixed(2)
  })

  document.getElementById('gr')!.addEventListener('input', (e) => {
    audioGain = parseInt((e.target as HTMLInputElement).value, 10) / 100
    document.getElementById('gv')!.textContent = audioGain.toFixed(2)
    engine.setAudioGain(audioGain)
  })

  document.getElementById('at')!.addEventListener('click', () => {
    audioOn = !audioOn
    engine.setAudioLayer(audioOn)
    document.getElementById('at')!.classList.toggle('on', audioOn)
  })

  document.querySelectorAll('.sq-btn').forEach((b) =>
    b.addEventListener('click', () => {
      const s = sequences[parseInt((b as HTMLElement).dataset.si!, 10)]
      engine.sequence(s.steps, s.opts)
    }),
  )

  // --- Drag area ---

  const da = document.getElementById('da')!
  const dd = document.getElementById('dd')!
  const dr = document.getElementById('dr')!
  const sv = document.getElementById('sv')!
  const stt = document.getElementById('stt')!

  const dragH = new DragHaptics(engine, {
    fireDist: 18,
    impulse: 'tick',
    intensity,
    onTick: (vel: number, ticks: number) => {
      sv.textContent = String(Math.round(vel))
      stt.textContent = String(ticks)
      const r = da.getBoundingClientRect()
      dr.style.left = `${dragH.curX - r.left}px`
      dr.style.top = `${dragH.curY - r.top}px`
      dr.classList.remove('flash')
      void dr.offsetWidth
      dr.classList.add('flash')
    },
  })

  da.addEventListener('touchstart', (e: TouchEvent) => {
    const t = e.touches[0]
    const r = da.getBoundingClientRect()
    dd.style.left = `${t.clientX - r.left}px`
    dd.style.top = `${t.clientY - r.top}px`
    dd.classList.add('on')
    da.classList.add('dragging')
    sv.textContent = '0'
    stt.textContent = '0'
  }, { passive: true })

  da.addEventListener('touchmove', (e: TouchEvent) => {
    const t = e.touches[0]
    const r = da.getBoundingClientRect()
    dd.style.left = `${t.clientX - r.left}px`
    dd.style.top = `${t.clientY - r.top}px`
  }, { passive: true })

  da.addEventListener('touchend', () => {
    dd.classList.remove('on')
    da.classList.remove('dragging')
  }, { passive: true })

  da.addEventListener('touchcancel', () => {
    dd.classList.remove('on')
    da.classList.remove('dragging')
  }, { passive: true })

  dragH.bind(da)
}

render()
