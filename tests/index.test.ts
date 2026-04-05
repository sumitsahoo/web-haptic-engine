import { describe, expect, it } from 'vite-plus/test'

import {
  DragHaptics,
  easings,
  HapticEngine,
  presets,
} from '../src'

describe('presets', () => {
  it('exports all 23 built-in presets', () => {
    const names = Object.keys(presets)
    expect(names.length).toBe(23)
  })

  it('every preset has a valid pattern array', () => {
    for (const [name, preset] of Object.entries(presets)) {
      expect(Array.isArray(preset.pattern), `${name} should have a pattern array`).toBe(true)
      expect(preset.pattern.length, `${name} pattern should not be empty`).toBeGreaterThan(0)
      for (const vib of preset.pattern) {
        expect(vib.duration, `${name} vibration should have duration`).toBeGreaterThan(0)
      }
    }
  })

  it('every preset with iosTicks has a positive tick count', () => {
    for (const [name, preset] of Object.entries(presets)) {
      if (preset.iosTicks !== undefined) {
        expect(preset.iosTicks, `${name} iosTicks should be > 0`).toBeGreaterThan(0)
      }
    }
  })

  it('every preset has an impulse type', () => {
    for (const [name, preset] of Object.entries(presets)) {
      expect(preset.impulse, `${name} should have an impulse type`).toBeDefined()
    }
  })
})

describe('easings', () => {
  const names = Object.keys(easings) as (keyof typeof easings)[]

  it('exports all easing functions', () => {
    expect(names).toContain('linear')
    expect(names).toContain('easeIn')
    expect(names).toContain('easeOut')
    expect(names).toContain('easeInOut')
    expect(names).toContain('bounce')
    expect(names).toContain('spring')
  })

  it('all easings return 0 at t=0', () => {
    for (const name of names) {
      const val = easings[name](0)
      expect(Math.abs(val), `${name}(0) should be ~0`).toBeLessThan(0.01)
    }
  })

  it('all easings return ~1 at t=1', () => {
    for (const name of names) {
      const val = easings[name](1)
      expect(Math.abs(val - 1), `${name}(1) should be ~1`).toBeLessThan(0.01)
    }
  })

  it('linear is identity', () => {
    expect(easings.linear(0.5)).toBe(0.5)
    expect(easings.linear(0.25)).toBe(0.25)
  })
})

describe('HapticEngine', () => {
  it('can be instantiated', () => {
    const engine = new HapticEngine()
    expect(engine).toBeDefined()
    expect(engine.isEnabled).toBe(true)
    engine.destroy()
  })

  it('can be disabled and re-enabled', () => {
    const engine = new HapticEngine()
    engine.setEnabled(false)
    expect(engine.isEnabled).toBe(false)
    engine.setEnabled(true)
    expect(engine.isEnabled).toBe(true)
    engine.destroy()
  })

  it('accepts custom options', () => {
    const engine = new HapticEngine({
      throttleMs: 50,
      audioLayer: false,
      audioGain: 0.3,
    })
    expect(engine).toBeDefined()
    engine.destroy()
  })

  it('trigger resolves without errors for preset names', async () => {
    const engine = new HapticEngine({ audioLayer: false })
    await engine.trigger('light')
    await engine.trigger('medium')
    await engine.trigger('heavy')
    engine.destroy()
  })

  it('trigger resolves without errors for number input', async () => {
    const engine = new HapticEngine({ audioLayer: false })
    await engine.trigger(50)
    engine.destroy()
  })

  it('trigger resolves without errors for pattern array', async () => {
    const engine = new HapticEngine({ audioLayer: false })
    await engine.trigger([20, 10, 30])
    engine.destroy()
  })

  it('trigger resolves without errors for vibration array', async () => {
    const engine = new HapticEngine({ audioLayer: false })
    await engine.trigger([{ duration: 20, intensity: 0.5 }, { delay: 30, duration: 40 }])
    engine.destroy()
  })

  it('trigger resolves without errors for null/undefined', async () => {
    const engine = new HapticEngine({ audioLayer: false })
    await engine.trigger(undefined)
    await engine.trigger()
    engine.destroy()
  })

  it('warns on unknown preset', async () => {
    const engine = new HapticEngine({ audioLayer: false })
    const warnings: string[] = []
    const origWarn = console.warn
    console.warn = (msg: string) => warnings.push(msg)
    await engine.trigger('nonexistent')
    console.warn = origWarn
    expect(warnings.some((w) => w.includes('nonexistent'))).toBe(true)
    engine.destroy()
  })

  it('cancel does not throw', () => {
    const engine = new HapticEngine()
    expect(() => engine.cancel()).not.toThrow()
    engine.destroy()
  })

  it('setThrottle adjusts throttle', async () => {
    const engine = new HapticEngine({ audioLayer: false })
    engine.setThrottle(0)
    await engine.trigger('tick')
    await engine.trigger('tick')
    engine.destroy()
  })

  it('registerPreset adds a custom preset', async () => {
    const engine = new HapticEngine({ audioLayer: false })
    engine.registerPreset('custom', {
      pattern: [{ duration: 10, intensity: 0.5 }],
      impulse: 'tick',
    })
    expect(presets.custom).toBeDefined()
    await engine.trigger('custom')
    delete (presets as Record<string, unknown>).custom
    engine.destroy()
  })

  it('sequence resolves without errors', async () => {
    const engine = new HapticEngine({ audioLayer: false })
    engine.setThrottle(0)
    await engine.sequence([
      { preset: 'tick' },
      { preset: 'click', delay: 10 },
    ])
    engine.destroy()
  })

  it('setAudioLayer and setAudioGain do not throw', () => {
    const engine = new HapticEngine()
    expect(() => engine.setAudioLayer(false)).not.toThrow()
    expect(() => engine.setAudioGain(0.8)).not.toThrow()
    engine.destroy()
  })
})

describe('DragHaptics', () => {
  it('can be created from engine.drag()', () => {
    const engine = new HapticEngine()
    const drag = engine.drag({ fireDist: 20, impulse: 'click', intensity: 0.8 })
    expect(drag).toBeInstanceOf(DragHaptics)
    drag.destroyAll()
    engine.destroy()
  })
})

describe('static properties', () => {
  it('exposes static support flags', () => {
    expect(typeof HapticEngine.supportsVibration).toBe('boolean')
    expect(typeof HapticEngine.supportsIOSHaptics).toBe('boolean')
    expect(typeof HapticEngine.isSupported).toBe('boolean')
  })
})
