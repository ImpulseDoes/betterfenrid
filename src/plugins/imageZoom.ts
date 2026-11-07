import { VIEWER_IMAGE } from '../api/imageViewer'
import { definePlugin } from '../core/plugins'

const PROFILE_MEDIA = /^https:\/\/cdn\.fenrid\.com\/profiles\/[^/]+\/(avatars|banners)\//
const LENS = 'bf-zoom-lens'
const ZOOMING = 'bf-zooming'
const MIN_SIDE = 120
const HOLD_MS = 200

type Media = HTMLImageElement | HTMLVideoElement

const CSS = `
.${LENS} {
  position: fixed;
  z-index: 2147483647;
  box-sizing: border-box;
  pointer-events: none;
  overflow: hidden;
  border: 2px solid var(--bf-accent);
  border-radius: 50%;
  background: #0d0e11;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.55);
}
.${LENS}[data-square] { border-radius: 12px; }
.${LENS} canvas { display: block; width: 100%; height: 100%; }
.${LENS} span {
  position: absolute;
  left: 50%;
  bottom: 10px;
  transform: translateX(-50%);
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font: 600 12px/18px system-ui, sans-serif;
  opacity: 0;
  transition: opacity 160ms;
}
.${LENS} span[data-shown] { opacity: 1; }
html.${ZOOMING}, html.${ZOOMING} * { cursor: none !important; }
`

function sizeOf(el: Media): [number, number] {

  return el instanceof HTMLImageElement ? [el.naturalWidth, el.naturalHeight] : [el.videoWidth, el.videoHeight]
}

/**
 * True for the picture in an image viewer: big, and in something that covers the screen, not in a small window
 * like a profile. Our own viewer always counts.
 */
function isViewerMedia(el: Element): el is Media {

  if (!(el instanceof HTMLImageElement || el instanceof HTMLVideoElement)) return false
  if (el.classList.contains(VIEWER_IMAGE)) return true
  if (el instanceof HTMLVideoElement && el.controls) return false

  const src = el.currentSrc || el.src

  if (!src || PROFILE_MEDIA.test(src)) return false

  const box = el.getBoundingClientRect()

  if (box.width < MIN_SIDE && box.height < MIN_SIDE) return false
  if (el.closest('[data-message-id]')) return false

  const dialog = el.closest('[role="dialog"]')

  if (dialog) {

    const area = dialog.getBoundingClientRect()

    return area.width >= innerWidth * 0.75 && area.height >= innerHeight * 0.75
  }

  // No dialog: count it when something on the way up is fixed and covers the screen
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {

    if (getComputedStyle(node).position !== 'fixed') continue

    const area = node.getBoundingClientRect()

    return area.width >= innerWidth * 0.75 && area.height >= innerHeight * 0.75
  }

  return false
}

function mediaAt(x: number, y: number): Media | null {

  for (const el of document.elementsFromPoint(x, y)) {

    if (isViewerMedia(el)) return el

  }

  return null
}

export default definePlugin({
  id: 'imageZoom',
  name: 'Image Zoom',
  description: 'A magnifying lens for pictures you open full size, like Vencord\'s ImageZoom. Hold the mouse button on the picture. Scroll to zoom, Shift + scroll to resize the lens.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,
  settings: {
    trigger: {
      type: 'select',
      label: 'Show the lens',
      default: 'hold',
      options: [
        { label: 'While holding the mouse button', value: 'hold' },
        { label: 'Whenever the mouse is on the picture', value: 'hover' },
      ],
    },
    zoom: {
      type: 'number',
      label: 'Zoom',
      description: 'How much bigger the lens shows things, compared to the picture on screen.',
      default: 2,
      min: 1.25,
      max: 12,
      step: 0.25,
    },
    size: {
      type: 'number',
      label: 'Lens size',
      description: 'In pixels.',
      default: 200,
      min: 60,
      max: 800,
      step: 10,
    },
    square: {
      type: 'boolean',
      label: 'Square lens',
      default: false,
    },
    sharp: {
      type: 'boolean',
      label: 'Sharp pixels',
      description: 'No smoothing when zoomed in, so you see every pixel. Good for pixel art.',
      default: false,
    },
    invertScroll: {
      type: 'boolean',
      label: 'Invert scrolling',
      default: false,
    },
    remember: {
      type: 'boolean',
      label: 'Remember zoom and size',
      description: 'Keeps what you set with the scroll wheel for next time.',
      default: true,
    },
  },

  start(ctx) {

    ctx.addStyle(CSS)

    const canvas = document.createElement('canvas')
    const draw2d = canvas.getContext('2d')!
    const label = document.createElement('span')
    const lens = document.createElement('div')

    lens.className = `bf-root ${LENS}`
    lens.append(canvas, label)

    let target: Media | null = null
    let x = 0
    let y = 0
    let zoom = ctx.settings.zoom
    let size = ctx.settings.size
    let frame = 0
    let labelTimer = 0
    let pressedAt = 0
    let pressX = 0
    let pressY = 0
    let swallowClick = false
    let holding = false

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

    const draw = () => {

      frame = 0

      if (!target) return
      if (!target.isConnected) return hide()

      const [width, height] = sizeOf(target)

      if (width && height) {

        const box = target.getBoundingClientRect()
        const fit = getComputedStyle(target).objectFit

        let shownWidth = box.width
        let shownHeight = box.height

        if (fit === 'contain' || fit === 'scale-down' || fit === 'cover') {

          const scale = (fit === 'cover' ? Math.max : Math.min)(box.width / width, box.height / height)

          shownWidth = width * scale
          shownHeight = height * scale
        }

        const left = box.left + (box.width - shownWidth) / 2
        const top = box.top + (box.height - shownHeight) / 2
        const perPixelX = width / shownWidth
        const perPixelY = height / shownHeight
        const sourceWidth = (size / zoom) * perPixelX
        const sourceHeight = (size / zoom) * perPixelY
        const dpr = devicePixelRatio || 1
        const pixels = Math.round(size * dpr)

        if (canvas.width !== pixels) {

          canvas.width = pixels
          canvas.height = pixels

        }

        draw2d.imageSmoothingEnabled = !ctx.settings.sharp
        draw2d.clearRect(0, 0, pixels, pixels)
        draw2d.drawImage(target, (x - left) * perPixelX - sourceWidth / 2, (y - top) * perPixelY - sourceHeight / 2, sourceWidth, sourceHeight, 0, 0, pixels, pixels)
      }

      lens.style.width = `${size}px`
      lens.style.height = `${size}px`
      lens.style.left = `${x - size / 2}px`
      lens.style.top = `${y - size / 2}px`
      lens.toggleAttribute('data-square', ctx.settings.square)

      // GIFs and videos keep moving, so keep drawing
      frame = requestAnimationFrame(draw)
    }

    const show = (media: Media) => {

      target = media

      if (!lens.isConnected) document.body.append(lens)

      document.documentElement.classList.add(ZOOMING)

      if (!frame) frame = requestAnimationFrame(draw)
    }

    function hide() {

      target = null
      cancelAnimationFrame(frame)
      frame = 0
      lens.remove()
      document.documentElement.classList.remove(ZOOMING)
    }

    const flashLabel = (text: string) => {

      label.textContent = text
      label.setAttribute('data-shown', '')
      clearTimeout(labelTimer)
      labelTimer = window.setTimeout(() => label.removeAttribute('data-shown'), 900)
    }

    const save = () => {

      if (!ctx.settings.remember) return

      ctx.setSetting('zoom', Math.round(zoom * 100) / 100)
      ctx.setSetting('size', Math.round(size))
    }

    let saveTimer = 0

    const onDown = (event: PointerEvent) => {

      if (event.button !== 0 || ctx.settings.trigger !== 'hold') return

      const media = mediaAt(event.clientX, event.clientY)

      if (!media) return

      // No dragging the picture away or selecting text while zooming
      event.preventDefault()

      x = event.clientX
      y = event.clientY
      pressX = x
      pressY = y
      pressedAt = performance.now()
      holding = true
      show(media)
    }

    const onMove = (event: PointerEvent) => {

      x = event.clientX
      y = event.clientY

      if (ctx.settings.trigger !== 'hover') return

      const media = mediaAt(x, y)

      if (media) show(media)
      else if (target) hide()
    }

    const onUp = () => {

      holding = false

      if (!target || ctx.settings.trigger !== 'hold') return

      // A long press or a drag shouldn't also count as a click on the viewer, which might close it
      swallowClick = performance.now() - pressedAt > HOLD_MS || Math.hypot(x - pressX, y - pressY) > 4

      hide()
    }

    const onClick = (event: MouseEvent) => {

      if (!swallowClick) return

      swallowClick = false
      event.preventDefault()
      event.stopImmediatePropagation()
    }

    const onWheel = (event: WheelEvent) => {

      if (!target) return

      event.preventDefault()
      event.stopPropagation()

      const up = (event.deltaY < 0) !== ctx.settings.invertScroll

      if (event.shiftKey) {

        size = clamp(size + (up ? 20 : -20), 60, 800)
        flashLabel(`${Math.round(size)}px`)

      } else {

        zoom = clamp(up ? zoom * 1.15 : zoom / 1.15, 1.25, 12)
        flashLabel(`${zoom.toFixed(1)}×`)

      }

      clearTimeout(saveTimer)
      saveTimer = window.setTimeout(save, 500)
    }

    const onDrag = (event: DragEvent) => {

      if (target) event.preventDefault()

    }

    const onKey = (event: KeyboardEvent) => {

      if (event.key === 'Escape' && target) hide()

    }

    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', hide, true)
    window.addEventListener('click', onClick, true)
    window.addEventListener('wheel', onWheel, { capture: true, passive: false })
    window.addEventListener('dragstart', onDrag, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', hide)

    ctx.onSettingsChange((values) => {

      zoom = values.zoom
      size = values.size

      if (values.trigger === 'hold' && target && !holding) hide()
    })

    ctx.onStop(() => {

      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', hide, true)
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('wheel', onWheel, true)
      window.removeEventListener('dragstart', onDrag, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', hide)
      clearTimeout(labelTimer)
      clearTimeout(saveTimer)
      hide()
    })
  },
})