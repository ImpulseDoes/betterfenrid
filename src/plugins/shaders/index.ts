import { toast } from '../../api/toast'
import { definePlugin } from '../../core/plugins'
import { SEE_THROUGH_CSS } from '../../core/seeThrough'
import { settings } from '../../core/settings'
import { THEMES } from '../../core/theme'
import type { Effect, Frame } from './effect'
import { createFrost } from './frost'
import { createGlass } from './glass'
import { createPond } from './pond'
import { createSnow } from './snow'

const EFFECTS: Record<string, { label: string; create: (gl: WebGLRenderingContext) => Effect }> = {
  glass: { label: 'Rain on glass', create: createGlass },
  pond: { label: 'Rain on a pond', create: createPond },
  snow: { label: 'Snowfall', create: createSnow },
  frost: { label: 'Frozen window', create: createFrost },
}

const QUALITY: Record<string, number> = { low: 0.5, medium: 0.75, high: 1 }

const BASE_CSS = `
.bf-shader {
  position: fixed;
  inset: 0;
  display: block;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  pointer-events: none;
}
`

function lightning(since: number): number {

  if (since < 0) return 0

  const first = Math.exp(-since * 14)
  const second = since > 0.13 ? Math.exp(-(since - 0.13) * 6) * 0.7 : 0

  return Math.min(1, first + second) * 0.22
}

export default definePlugin({
  id: 'shaders',
  name: 'Shaders',
  description: 'Weather in front of your wallpaper, drawn by your graphics card behind Fenrid: rain running down a window, rain on a pond, snowfall or a window freezing over.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    effect: {
      type: 'select',
      label: 'Effect',
      description: 'On the pond, moving your cursor stirs the water too.',
      default: 'glass',
      options: Object.entries(EFFECTS).map(([value, { label }]) => ({ label, value })),
    },
    amount: {
      type: 'number',
      label: 'Amount',
      description: 'How heavy the rain or snow is, or how far the frost reaches, in percent.',
      default: 50,
      min: 5,
      max: 100,
      step: 5,
    },
    speed: {
      type: 'number',
      label: 'Speed',
      description: 'In percent.',
      default: 100,
      min: 20,
      max: 200,
      step: 10,
    },
    fog: {
      type: 'boolean',
      label: 'Fogged glass',
      description: 'Blurs the wallpaper behind the effect.',
      default: true,
    },
    lightning: {
      type: 'boolean',
      label: 'Lightning',
      description: 'A soft flash every now and then, with rain on glass. Leave it off if flashing light bothers you.',
      default: false,
    },
    fps: {
      type: 'select',
      label: 'Frame rate',
      description: 'Lower uses less of your graphics card.',
      default: '60',
      options: [
        { label: '30 FPS', value: '30' },
        { label: '60 FPS', value: '60' },
        { label: 'Unlimited', value: '0' },
      ],
    },
    quality: {
      type: 'select',
      label: 'Quality',
      description: 'The resolution it draws at. Lower uses less of your graphics card.',
      default: 'medium',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
      ],
    },
  },

  start(ctx) {

    ctx.addStyle(BASE_CSS)

    const layer = ctx.addStyle('')
    const canvas = document.createElement('canvas')

    canvas.className = 'bf-shader'
    canvas.setAttribute('aria-hidden', 'true')
    document.documentElement.append(canvas)

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })

    if (!gl) toast('Shaders need WebGL, which is turned off in this browser', 'error', 5000)

    let effect: Effect | null = null
    let effectId = ''

    const pickEffect = () => {

      if (!gl || gl.isContextLost()) return

      const id = ctx.settings.effect in EFFECTS ? ctx.settings.effect : 'glass'

      if (effect && effectId === id) return

      effect?.destroy()
      effect = null
      effectId = id

      try {

        effect = EFFECTS[id].create(gl)

      } catch (error) {

        ctx.log.error('Shader failed', error)
        toast('The effect could not start', 'error', 4000)

      }
    }

    const applySettings = () => {

      const theme = THEMES.find((t) => t.id === settings.get().theme.preset)
      const base = theme?.preview?.bg ?? '#0e0f12'

      layer.set(`${theme?.assets ? '' : `html:root { --bf-wall-base: ${base}; background-color: ${base} !important; }\n${SEE_THROUGH_CSS}`}`)

      pickEffect()
    }

    let frame = 0
    let pointer: Frame['pointer'] = null

    const onPointer = (e: PointerEvent) => {

      pointer = { x: e.clientX, y: e.clientY }
    }

    window.addEventListener('pointermove', onPointer, { passive: true })
    let lastDraw = 0
    let time = 0
    let strikeAt = -1
    let nextStrike = 6 + Math.random() * 10

    const draw = (now: number) => {

      frame = requestAnimationFrame(draw)

      const cap = Number(ctx.settings.fps) || 0

      if (cap && now - lastDraw < 1000 / cap - 2) return

      const real = Math.min(0.1, (now - lastDraw) / 1000)
      const speed = (Number(ctx.settings.speed) || 100) / 100

      lastDraw = now
      time += real

      if (!gl || !effect || gl.isContextLost()) return

      const quality = QUALITY[ctx.settings.quality] ?? 0.75
      const scale = (window.devicePixelRatio || 1) * quality
      const width = Math.max(1, Math.round(window.innerWidth * scale))
      const height = Math.max(1, Math.round(window.innerHeight * scale))

      if (canvas.width !== width || canvas.height !== height) {

        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)

      }

      if (ctx.settings.lightning && time >= nextStrike) {

        strikeAt = time
        nextStrike = time + 8 + Math.random() * 22

      }

      const f: Frame = {
        width,
        height,
        scale: width / window.innerWidth,
        step: real * speed,
        time,
        flash: effectId === 'glass' && ctx.settings.lightning && strikeAt >= 0 ? lightning(time - strikeAt) : 0,
        amount: (Number(ctx.settings.amount) || 0) / 100,
        fog: ctx.settings.fog,
        quality,
        pointer,
      }

      effect.draw(f)
    }

    canvas.addEventListener('webglcontextlost', (e) => {

      e.preventDefault()
      effect = null

    })

    canvas.addEventListener('webglcontextrestored', () => {

      effectId = ''
      pickEffect()

    })

    applySettings()
    ctx.onSettingsChange(applySettings)

    if (gl) frame = requestAnimationFrame(draw)

    ctx.onStop(() => {

      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointer)
      effect?.destroy()
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
    })
  },
})