import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { Selectors } from '../core/selectors'
import { tooltip } from '../ui/tooltip'
import css from '../ui/polish/spotify.css'

const PANEL = 'bf-spotify'
const TICK_MS = 250

interface MediaState {
  type: 'state'
  active: boolean
  app?: string
  title?: string
  artist?: string
  album?: string
  playing?: boolean
  shuffle?: boolean
  repeat?: number
  position?: number
  duration?: number
  updatedAt?: number
}

interface ArtMessage {
  type: 'art'
  track: string
  data: string
}

const PATHS = {
  play: 'M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z',
  pause: 'M7 5h3.5v14H7zm6.5 0H17v14h-3.5z',
  next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
  prev: 'M6 6h2v12H6zm3.5 6 8.5 6V6z',
  shuffle:
    'M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
  repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
  repeatOne: 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z',
  note: 'M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z',
}

type PathName = keyof typeof PATHS

function svg(name: PathName, size = 20): SVGSVGElement {

  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')

  el.setAttribute('viewBox', '0 0 24 24')
  el.setAttribute('width', String(size))
  el.setAttribute('height', String(size))
  el.setAttribute('aria-hidden', 'true')
  path.setAttribute('fill', 'currentColor')
  path.setAttribute('d', PATHS[name])
  el.append(path)

  return el
}

function setIcon(button: Element, name: PathName, size?: number) {

  if (button.getAttribute('data-icon') === name) return

  button.setAttribute('data-icon', name)
  button.replaceChildren(svg(name, size))
}

function formatTime(ms: number): string {

  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, '0')

  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}

const trackKey = (state: MediaState) => `${state.app}|${state.title}|${state.artist}`

export default definePlugin({
  id: 'spotifyControls',
  name: 'Spotify Controls',
  description: 'A Spotify player above your profile in the bottom left: cover, track, play/pause, skip, shuffle, repeat and seeking. Only in the Better Fenrid desktop app.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    anyPlayer: {
      type: 'boolean',
      label: 'Other players too',
      description: 'When Spotify is closed, control whatever else is playing (YouTube in a browser, a video player…).',
      default: false,
    },
    hideWhenPaused: {
      type: 'boolean',
      label: 'Hide when paused',
      default: false,
    },
  },

  start(ctx) {

    const native = window.BetterFenridNative

    if (!native?.media) {

      ctx.log.info('Not running in the desktop app, nothing to control')
      return

    }

    const { media } = native

    let state: MediaState = { type: 'state', active: false }
    let art: ArtMessage | null = null
    let seeking = false

    const cover = h('img', { class: `${PANEL}-art`, alt: '', draggable: 'false' })
    const placeholder = h('div', { class: `${PANEL}-art ${PANEL}-art-empty` }, svg('note', 22))
    const title = h('div', { class: `${PANEL}-title` })
    const artist = h('div', { class: `${PANEL}-artist` })

    const button = (icon: PathName, onClick: () => void, size?: number) => {

      const el = h('button', { class: `${PANEL}-button`, type: 'button', onClick }, svg(icon, size))

      el.setAttribute('data-icon', icon)

      return el
    }

    const send = (line: string) => media.command(line)

    const prev = tooltip(button('prev', () => send('prev')), 'Previous')
    const next = tooltip(button('next', () => send('next')), 'Next')

    const toggle = button('play', () => {

      // Show it right away, the helper confirms a moment later
      state = { ...state, playing: !state.playing, position: currentPosition(), updatedAt: Date.now() }
      send('toggle')
      render()

    }, 22)

    toggle.classList.add(`${PANEL}-toggle`)

    const shuffle = tooltip(button('shuffle', () => {

      state = { ...state, shuffle: !state.shuffle }
      send(`shuffle ${state.shuffle ? 1 : 0}`)
      render()

    }, 16), 'Shuffle')

    const repeat = tooltip(button('repeat', () => {

      // Off → whole list → one track → off, like Spotify's own button
      const order = [0, 2, 1]
      const nextMode = order[(order.indexOf(state.repeat ?? 0) + 1) % order.length]

      state = { ...state, repeat: nextMode }
      send(`repeat ${nextMode}`)
      render()

    }, 16), 'Repeat')

    const elapsed = h('span', { class: `${PANEL}-time` }, '0:00')
    const total = h('span', { class: `${PANEL}-time` }, '0:00')
    const bar = h('input', { class: `${PANEL}-bar`, type: 'range', min: '0', max: '1', step: '1', value: '0', 'aria-label': 'Seek' })

    bar.addEventListener('pointerdown', () => { seeking = true })
    bar.addEventListener('input', () => {

      seeking = true
      elapsed.textContent = formatTime(Number(bar.value))
      paintBar()

    })
    bar.addEventListener('change', () => {

      const position = Number(bar.value)

      state = { ...state, position, updatedAt: Date.now() }
      seeking = false
      send(`seek ${Math.round(position)}`)
      render()

    })

    const panel = h('div', { class: PANEL, hidden: true },
      h('div', { class: `${PANEL}-row` },
        cover,
        placeholder,
        h('div', { class: `${PANEL}-info` }, title, artist),
        h('div', { class: `${PANEL}-controls` }, prev, toggle, next),
      ),
      h('div', { class: `${PANEL}-row ${PANEL}-seek` }, shuffle, elapsed, bar, total, repeat),
    )

    // ---------- Rendering ----------

    function currentPosition(): number {

      const position = state.position ?? 0
      const duration = state.duration ?? 0
      const moved = state.playing && state.updatedAt ? Math.max(0, Date.now() - state.updatedAt) : 0

      return duration > 0 ? Math.min(duration, position + moved) : position + moved
    }

    function paintBar() {

      const max = Number(bar.max) || 1

      bar.style.setProperty('--bf-progress', `${(Number(bar.value) / max) * 100}%`)
    }

    function renderTime() {

      const duration = state.duration ?? 0

      bar.max = String(Math.max(1, duration))
      bar.disabled = duration <= 0
      total.textContent = formatTime(duration)

      if (seeking) return

      const position = currentPosition()

      bar.value = String(position)
      elapsed.textContent = formatTime(position)
      paintBar()
    }

    function render() {

      const visible = state.active && Boolean(state.title) && !(ctx.settings.hideWhenPaused && !state.playing)

      panel.hidden = !visible

      if (!visible) return

      const hasArt = art?.track === trackKey(state)

      if (hasArt && cover.src !== art!.data) cover.src = art!.data

      cover.hidden = !hasArt
      placeholder.hidden = hasArt

      title.textContent = state.title ?? ''
      title.title = state.album ? `${state.title} · ${state.album}` : state.title ?? ''
      artist.textContent = state.artist ?? ''
      artist.title = state.artist ?? ''

      setIcon(toggle, state.playing ? 'pause' : 'play', 22)
      toggle.setAttribute('aria-label', state.playing ? 'Pause' : 'Play')
      toggle.title = state.playing ? 'Pause' : 'Play'

      shuffle.classList.toggle(`${PANEL}-on`, Boolean(state.shuffle))
      repeat.classList.toggle(`${PANEL}-on`, Boolean(state.repeat))
      setIcon(repeat, state.repeat === 1 ? 'repeatOne' : 'repeat', 16)

      panel.classList.toggle(`${PANEL}-paused`, !state.playing)

      renderTime()
    }

    const stopListening = media.subscribe((message: MediaState | ArtMessage) => {

      if (message?.type === 'art') art = message
      else if (message?.type === 'state') state = message

      render()
    })

    send(`any ${ctx.settings.anyPlayer ? 1 : 0}`)

    ctx.onSettingsChange((values) => {

      send(`any ${values.anyPlayer ? 1 : 0}`)
      render()

    })

    const timer = window.setInterval(() => {

      if (!panel.hidden && state.playing) renderTime()

    }, TICK_MS)

    const place = () => {

      const footer = document.querySelector(Selectors.userFooter)

      if (footer && panel.parentElement !== footer) footer.append(panel)

    }

    ctx.addStyle(css)
    ctx.onDomChange(place)
    ctx.onStop(() => {

      stopListening()
      window.clearInterval(timer)
      panel.remove()

    })

    place()
    render()
  },
})