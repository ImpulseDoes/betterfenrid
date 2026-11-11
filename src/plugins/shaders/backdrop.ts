import { bind, createTexture, upload } from './gl'
import { settings } from '../../core/settings'
import { THEMES } from '../../core/theme'

export function canvas(width: number, height: number): HTMLCanvasElement {

  const c = document.createElement('canvas')

  c.width = Math.max(1, Math.round(width))
  c.height = Math.max(1, Math.round(height))

  return c
}

function readColor(css: string): [number, number, number, number] | null {

  const ctx = canvas(1, 1).getContext('2d', { willReadFrequently: true })!

  ctx.fillStyle = '#010203'
  ctx.fillStyle = css

  if (ctx.fillStyle === '#010203' && !/^#010203$/i.test(css)) return null

  ctx.fillRect(0, 0, 1, 1)

  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data

  return [r / 255, g / 255, b / 255, a / 255]
}

const proxied = (url: string) => `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=2560&we&output=webp&q=85`

const images = new Map<string, Promise<HTMLImageElement | null>>()

function loadImage(url: string): Promise<HTMLImageElement | null> {

  const attempt = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {

    const img = new Image()

    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

  let loading = images.get(url)

  if (!loading) {

    loading = attempt(url).then((img) => img ?? (/^https:/i.test(url) && !url.startsWith('https://wsrv.nl/') ? attempt(proxied(url)) : null))
    images.set(url, loading)

  }

  return loading
}

function bokeh(ctx: CanvasRenderingContext2D, width: number, height: number, base: string) {

  const theme = THEMES.find((t) => t.id === settings.get().theme.preset)
  const accent = theme?.preview?.accent ?? '#5865f2'
  const colors = [accent, '#ffb35c', '#ff6b8b', '#7cc4ff', '#ffe08a']
  const sky = ctx.createLinearGradient(0, 0, 0, height)

  sky.addColorStop(0, base)
  sky.addColorStop(1, '#000')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)

  let seed = 7

  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647

  ctx.globalCompositeOperation = 'lighter'

  for (let i = 0; i < 90; i++) {

    const x = next() * width
    const y = height * (0.1 + next() * 0.9)
    const r = (8 + next() ** 2 * 60) * (width / 1400)
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r)

    ctx.globalAlpha = 0.12 + next() * 0.3
    glow.addColorStop(0, colors[i % colors.length])
    glow.addColorStop(0.7, colors[i % colors.length])
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}

export class Backdrop {

  readonly sharp = canvas(1, 1)
  readonly blur = canvas(1, 1)
  readonly lens = canvas(1, 1)
  tint: [number, number, number, number] = [0, 0, 0, 0]
  ready = false
  version = 0
  private key = ''
  private checkedAt = -Infinity

  check(now: number, width: number, height: number) {

    if (now - this.checkedAt < 1500) return

    this.checkedAt = now

    const style = getComputedStyle(document.documentElement)
    const image = style.backgroundImage
    const base = style.backgroundColor
    const key = `${image}|${base}|${width}x${height}`

    if (key === this.key) return

    this.key = key

    const url = image.match(/url\("?(.*?)"?\)/)?.[1] ?? null
    const shade = image.match(/linear-gradient\(\s*([a-z-]+\([^()]*\)|#[0-9a-f]{3,8}|[a-z]+)/i)?.[1]

    this.tint = (shade && readColor(shade)) || [0, 0, 0, 0]

    void (url ? loadImage(url) : Promise.resolve(null)).then((img) => {

      if (this.key !== key) return

      const sharp = this.sharp.getContext('2d')!

      this.sharp.width = width
      this.sharp.height = height

      if (img) {

        // Cover, like background-size: cover
        const s = Math.max(width / img.naturalWidth, height / img.naturalHeight)

        sharp.drawImage(img, (width - img.naturalWidth * s) / 2, (height - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s)

      } else bokeh(sharp, width, height, readColor(base)?.[3] ? base : '#0e0f12')

      const blur = this.blur.getContext('2d')!

      this.blur.width = Math.max(1, Math.round(width / 4))
      this.blur.height = Math.max(1, Math.round(height / 4))
      blur.filter = 'blur(3px)'
      blur.drawImage(this.sharp, 0, 0, this.blur.width, this.blur.height)

      const lens = this.lens.getContext('2d')!

      this.lens.width = Math.max(1, Math.round(width / 3))
      this.lens.height = Math.max(1, Math.round(height / 3))
      lens.filter = 'blur(1px)'
      lens.drawImage(this.sharp, 0, 0, this.lens.width, this.lens.height)

      this.ready = true
      this.version++
    })
  }
}

export function backdropTextures(gl: WebGLRenderingContext) {

  const sharp = createTexture(gl)
  const blur = createTexture(gl)

  let uploaded = -1

  return {
    bind(backdrop: Backdrop, unit: number) {

      if (uploaded !== backdrop.version) {

        upload(gl, sharp, unit, backdrop.sharp)
        upload(gl, blur, unit + 1, backdrop.blur)
        uploaded = backdrop.version

      }

      bind(gl, sharp, unit)
      bind(gl, blur, unit + 1)
    },
    destroy() {

      gl.deleteTexture(sharp)
      gl.deleteTexture(blur)
    },
  }
}