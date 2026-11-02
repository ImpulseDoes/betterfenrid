import sprites from '../assets/oneko.gif'
import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'

// Ported from oneko.js by adryd (MIT): https://github.com/adryd325/oneko.js

const STORAGE_KEY = 'BetterFenrid:oneko'
const SIZE = 32
const FRAME_MS = 100

type Sprite = [number, number]

const SPRITES: Record<string, Sprite[]> = {
  idle: [[-3, -3]],
  alert: [[-7, -3]],
  scratchSelf: [[-5, 0], [-6, 0], [-7, 0]],
  scratchWallN: [[0, 0], [0, -1]],
  scratchWallS: [[-7, -1], [-6, -2]],
  scratchWallE: [[-2, -2], [-2, -3]],
  scratchWallW: [[-4, 0], [-4, -1]],
  tired: [[-3, -2]],
  sleeping: [[-2, 0], [-2, -1]],
  N: [[-1, -2], [-1, -3]],
  NE: [[0, -2], [0, -3]],
  E: [[-3, 0], [-3, -1]],
  SE: [[-5, -1], [-5, -2]],
  S: [[-6, -3], [-7, -2]],
  SW: [[-5, -3], [-6, -1]],
  W: [[-4, -2], [-4, -3]],
  NW: [[-1, 0], [-1, -1]],
}

interface State {
  x: number
  y: number
  mouseX: number
  mouseY: number
  frame: number
  idleTime: number
  idleAnimation: string | null
  idleFrame: number
}

function loadState(): State {

  const fresh: State = { x: 32, y: 32, mouseX: 0, mouseY: 0, frame: 0, idleTime: 0, idleAnimation: null, idleFrame: 0 }

  try {

    return { ...fresh, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }

  } catch {

    return fresh

  }
}

export default definePlugin({
  id: 'oneko',
  name: 'Oneko',
  description: 'A pixel cat that chases your cursor. Based on oneko.js by adryd.',
  authors: ['Better Fenrid', 'adryd'],
  enabledByDefault: false,
  settings: {
    speed: {
      type: 'number',
      label: 'Speed',
      description: 'How many pixels the cat runs per step.',
      default: 10,
      min: 2,
      max: 30,
      step: 1,
    },
    reducedMotion: {
      type: 'boolean',
      label: 'Run with reduced motion',
      description: 'Shows the cat even when your system asks for less animation.',
      default: false,
    },
  },

  start(ctx) {

    const state = loadState()
    const cat = h('div', { class: 'bf-oneko', 'aria-hidden': 'true' })

    cat.style.backgroundImage = `url("${sprites}")`

    let raf = 0
    let last = 0

    const place = () => {

      cat.style.transform = `translate(${state.x - SIZE / 2}px, ${state.y - SIZE / 2}px)`
    }

    const setSprite = (name: string, frame: number) => {

      const set = SPRITES[name]
      const [x, y] = set[frame % set.length]

      cat.style.backgroundPosition = `${x * SIZE}px ${y * SIZE}px`
    }

    const resetIdle = () => {

      state.idleAnimation = null
      state.idleFrame = 0
    }

    const idle = () => {

      state.idleTime += 1

      // Roughly every 20 seconds
      if (state.idleTime > 10 && state.idleAnimation == null && Math.floor(Math.random() * 200) === 0) {

        const options = ['sleeping', 'scratchSelf']

        if (state.x < SIZE) options.push('scratchWallW')
        if (state.y < SIZE) options.push('scratchWallN')
        if (state.x > innerWidth - SIZE) options.push('scratchWallE')
        if (state.y > innerHeight - SIZE) options.push('scratchWallS')

        state.idleAnimation = options[Math.floor(Math.random() * options.length)]
      }

      switch (state.idleAnimation) {

        case 'sleeping':

          if (state.idleFrame < 8) {

            setSprite('tired', 0)
            break

          }

          setSprite('sleeping', Math.floor(state.idleFrame / 4))

          if (state.idleFrame > 192) resetIdle()

          break

        case 'scratchWallN':
        case 'scratchWallS':
        case 'scratchWallE':
        case 'scratchWallW':
        case 'scratchSelf':

          setSprite(state.idleAnimation, state.idleFrame)

          if (state.idleFrame > 9) resetIdle()

          break

        default:

          setSprite('idle', 0)
          return
      }

      state.idleFrame += 1
    }

    const step = () => {

      state.frame += 1

      const speed = ctx.settings.speed
      const diffX = state.x - state.mouseX
      const diffY = state.y - state.mouseY
      const distance = Math.hypot(diffX, diffY)

      if (distance < speed || distance < 48) return idle()

      resetIdle()

      // Wakes up and looks at the cursor for a moment before running
      if (state.idleTime > 1) {

        setSprite('alert', 0)
        state.idleTime = Math.min(state.idleTime, 7) - 1
        return

      }

      let direction = diffY / distance > 0.5 ? 'N' : diffY / distance < -0.5 ? 'S' : ''

      direction += diffX / distance > 0.5 ? 'W' : diffX / distance < -0.5 ? 'E' : ''

      setSprite(direction, state.frame)

      state.x = Math.min(Math.max(SIZE / 2, state.x - (diffX / distance) * speed), innerWidth - SIZE / 2)
      state.y = Math.min(Math.max(SIZE / 2, state.y - (diffY / distance) * speed), innerHeight - SIZE / 2)

      place()
    }

    const tick = (now: number) => {

      raf = requestAnimationFrame(tick)

      if (now - last < FRAME_MS) return

      last = now
      step()
    }

    const onMove = (event: PointerEvent) => {

      state.mouseX = event.clientX
      state.mouseY = event.clientY
    }

    const save = () => {

      try {

        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

      } catch { }
    }

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

    const sync = () => {

      const run = ctx.settings.reducedMotion || !reducedMotion.matches

      if (run && !cat.isConnected) {

        document.body.append(cat)
        raf = requestAnimationFrame(tick)

      } else if (!run && cat.isConnected) {

        cancelAnimationFrame(raf)
        cat.remove()

      }
    }

    state.x = Math.min(Math.max(SIZE / 2, state.x), innerWidth - SIZE / 2)
    state.y = Math.min(Math.max(SIZE / 2, state.y), innerHeight - SIZE / 2)

    place()
    setSprite(state.idleAnimation === 'sleeping' && state.idleFrame >= 8 ? 'sleeping' : 'idle', 0)
    sync()

    window.addEventListener('pointermove', onMove, { capture: true, passive: true })
    window.addEventListener('pagehide', save)
    reducedMotion.addEventListener('change', sync)
    ctx.onSettingsChange(sync)

    return () => {

      save()
      cancelAnimationFrame(raf)
      cat.remove()
      window.removeEventListener('pointermove', onMove, { capture: true })
      window.removeEventListener('pagehide', save)
      reducedMotion.removeEventListener('change', sync)
    }
  },
})