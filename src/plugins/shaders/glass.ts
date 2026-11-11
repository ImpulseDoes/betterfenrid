import { Backdrop, canvas } from './backdrop'
import type { Effect } from './effect'
import { bind, compile, createTexture, drawFullscreen, upload } from './gl'

const MIN_R = 7
const MAX_R = 30
const DEPTHS = 32
const SPRITE = 64
const EDGE = 0.6

interface Drop {
  x: number
  y: number
  r: number
  momentum: number
  momentumX: number
  spreadX: number
  spreadY: number
  sinceTrail: number
  nextTrail: number
  shrink: number
  parent: Drop | null
  fresh: boolean
  dead: boolean
}

const random = (from: number, to: number) => from + Math.random() * (to - from)
const chance = (p: number) => Math.random() < p

function newDrop(fields: Partial<Drop> & Pick<Drop, 'x' | 'y' | 'r'>): Drop {

  return { momentum: 0, momentumX: 0, spreadX: 0, spreadY: 0, sinceTrail: 0, nextTrail: 0, shrink: 0, parent: null, fresh: true, dead: false, ...fields }
}

function makeSprites(): HTMLCanvasElement[] {

  return Array.from({ length: DEPTHS }, (_, i) => {

    const sprite = canvas(SPRITE, SPRITE)
    const ctx = sprite.getContext('2d')!
    const image = ctx.createImageData(SPRITE, SPRITE)
    const half = SPRITE / 2

    for (let y = 0; y < SPRITE; y++) {

      for (let x = 0; x < SPRITE; x++) {

        const u = (x + 0.5) / half - 1
        const v = (y + 0.5) / half - 1
        const d = Math.hypot(u, v)

        if (d >= 1) continue

        const o = (y * SPRITE + x) * 4

        image.data[o] = 128 + Math.max(-1, Math.min(1, u / EDGE)) * 127
        image.data[o + 1] = 128 + Math.max(-1, Math.min(1, v / EDGE)) * 127
        image.data[o + 2] = (i / (DEPTHS - 1)) * 255
        image.data[o + 3] = Math.max(0, Math.min(1, (1 - d) * 1.55)) * 255
      }
    }

    ctx.putImageData(image, 0, 0)

    return sprite
  })
}

class Water {

  readonly map: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly droplets: HTMLCanvasElement
  private readonly dropletsCtx: CanvasRenderingContext2D
  private drops: Drop[] = []
  private dropletBudget = 0

  constructor(private readonly sprites: HTMLCanvasElement[], readonly width: number, readonly height: number, readonly k: number) {

    this.map = canvas(width * k, height * k)
    this.ctx = this.map.getContext('2d')!
    this.droplets = canvas(width * k, height * k)
    this.dropletsCtx = this.droplets.getContext('2d')!
  }

  resized(width: number, height: number, k: number): Water {

    const next = new Water(this.sprites, width, height, k)

    next.drops = this.drops.filter((d) => d.x < width && d.y < height)

    return next
  }

  private get area() {
    return Math.sqrt((this.width * this.height) / (1024 * 768))
  }

  private paint(ctx: CanvasRenderingContext2D, drop: Drop) {

    let depth = Math.max(0, Math.min(1, ((drop.r - MIN_R) / (MAX_R - MIN_R)) * 0.9))

    depth /= (drop.spreadX + drop.spreadY) * 0.5 + 1

    const sprite = this.sprites[Math.floor(depth * (DEPTHS - 1))]
    const hx = (drop.r / EDGE) * (1 + drop.spreadX)
    const hy = (drop.r / EDGE) * 1.2 * (1 + drop.spreadY)

    ctx.drawImage(sprite, (drop.x - hx) * this.k, (drop.y - hy) * this.k, hx * 2 * this.k, hy * 2 * this.k)
  }

  // A drop sliding down wipes the small droplets off its path
  private wipe(x: number, y: number, r: number) {

    const ctx = this.dropletsCtx

    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.ellipse(x * this.k, (y + r * 0.25) * this.k, r * this.k, r * 1.3 * this.k, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }

  update(ts: number, amount: number) {

    const { width, height, area } = this
    const max = 900 * area

    this.dropletBudget += 60 * amount * ts * area

    while (this.dropletBudget >= 1) {

      this.dropletBudget--
      this.paint(this.dropletsCtx, newDrop({ x: random(0, width), y: random(0, height), r: random(1.6, 2.6) ** 1.3 }))

    }

    const spawned: Drop[] = []

    for (let n = 0; n < 3 * ts * area && chance(0.6 * amount * ts * area) && this.drops.length + spawned.length < max; n++) {

      const r = MIN_R + (MAX_R - MIN_R) * Math.random() ** 3

      spawned.push(newDrop({
        x: random(0, width),
        y: random(-0.1 * height, 0.95 * height),
        r,
        momentum: 1 + (r - MIN_R) * 0.1 + random(0, 2),
        spreadX: 1.5,
        spreadY: 1.5,
      }))
    }

    this.drops.sort((a, b) => a.y * width + a.x - (b.y * width + b.x))

    const alive: Drop[] = [...spawned]

    this.ctx.clearRect(0, 0, this.map.width, this.map.height)
    this.ctx.drawImage(this.droplets, 0, 0)

    for (let i = 0; i < this.drops.length; i++) {

      const drop = this.drops[i]

      if (drop.dead) continue

      // Bigger drops get heavy enough to slide down now and then
      if (chance((drop.r - MIN_R) * (0.1 / (MAX_R - MIN_R)) * ts)) drop.momentum += random(0, (drop.r / MAX_R) * 4)

      if (drop.r <= MIN_R && chance(0.05 * ts)) drop.shrink += 0.01

      drop.r -= drop.shrink * ts

      if (drop.r <= 0) {

        drop.dead = true
        continue

      }

      // A moving drop leaves a trail of small ones and gets smaller itself
      drop.sinceTrail += drop.momentum * ts

      if (drop.sinceTrail > drop.nextTrail && alive.length + this.drops.length < max) {

        alive.push(newDrop({
          x: drop.x + random(-drop.r, drop.r) * 0.1,
          y: drop.y - drop.r * 0.01,
          r: drop.r * random(0.2, 0.45),
          spreadY: drop.momentum * 0.1,
          parent: drop,
        }))

        drop.r *= 0.97 ** ts
        drop.sinceTrail = 0
        drop.nextTrail = random(MIN_R, MAX_R) - drop.momentum * 2 + (MAX_R - drop.r)

      }

      drop.spreadX *= 0.4 ** ts
      drop.spreadY *= 0.7 ** ts

      const moved = drop.momentum > 0

      if (moved) {

        drop.y += drop.momentum * ts
        drop.x += drop.momentumX * ts

        if (drop.y > height + drop.r) {

          drop.dead = true
          continue

        }
      }

      if (moved || drop.fresh) {

        for (let j = i + 1; j < Math.min(this.drops.length, i + 70); j++) {

          const other = this.drops[j]

          if (other.dead || drop.r <= other.r || drop.parent === other || other.parent === drop) continue

          const dx = other.x - drop.x
          const dy = other.y - drop.y

          if (Math.hypot(dx, dy) < (drop.r + other.r) * (0.45 + drop.momentum * 0.01 * ts)) {

            const r = Math.min(MAX_R * 1.4, Math.sqrt(drop.r ** 2 + other.r ** 2 * 0.8))

            drop.r = r
            drop.momentumX += dx * 0.1
            drop.spreadX = 0
            drop.spreadY = 0
            other.dead = true
            drop.momentum = Math.max(other.momentum, Math.min(40, drop.momentum + r * 0.05 + 1))

          }
        }
      }

      drop.fresh = false
      drop.momentum = Math.max(0, drop.momentum - Math.max(1, MIN_R * 0.5 - drop.momentum) * 0.1 * ts)
      drop.momentumX *= 0.7 ** ts

      alive.push(drop)

      if (moved) this.wipe(drop.x, drop.y, drop.r * 0.7)

      this.paint(this.ctx, drop)
    }

    this.drops = alive.filter((d) => !d.dead)
  }
}

const FRAGMENT = `
precision mediump float;

uniform sampler2D uWater;
uniform sampler2D uSharp;
uniform sampler2D uBlur;
uniform sampler2D uLens;
uniform vec2 uRes;
uniform float uScale;
uniform vec4 uTint;
uniform float uFog;
uniform float uFlash;

float cut(float a) {
  return clamp(a * 6.0 - 3.0, 0.0, 1.0);
}

void main() {

  vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  vec2 px = uScale / uRes;

  vec4 water = texture2D(uWater, uv);
  float drop = cut(water.a);
  vec2 lean = (water.rg - 0.5) * 2.0;
  float depth = water.b;

  vec3 inside = texture2D(uLens, uv - lean * px * (24.0 + depth * 60.0)).rgb;

  float shine = pow(max(dot(normalize(vec3(lean, 0.9)), normalize(vec3(-0.45, -0.75, 0.55))), 0.0), 18.0);

  inside = inside * 1.06 + 0.035 + shine * 0.45;

  vec3 glass = uFog > 0.5 ? texture2D(uBlur, uv).rgb * 0.92 + 0.035 : texture2D(uSharp, uv).rgb;

  glass *= 1.0 - cut(texture2D(uWater, uv - vec2(0.0, (2.0 + depth * 5.0) * px.y)).a) * 0.22;

  vec3 color = mix(glass, inside, drop);

  color = mix(color, uTint.rgb, uTint.a);
  color += uFlash * vec3(0.82, 0.88, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`

const UNIFORMS = ['uWater', 'uSharp', 'uBlur', 'uLens', 'uRes', 'uScale', 'uTint', 'uFog', 'uFlash'] as const

export function createGlass(gl: WebGLRenderingContext): Effect {

  const { program, uniforms: u } = compile(gl, FRAGMENT, UNIFORMS)
  const sprites = makeSprites()
  const textures = { water: createTexture(gl), sharp: createTexture(gl), blur: createTexture(gl), lens: createTexture(gl) }
  const backdrop = new Backdrop()

  let water: Water | null = null
  let uploaded = -1

  return {
    draw(f) {

      const cssWidth = Math.round(f.width / f.scale)
      const cssHeight = Math.round(f.height / f.scale)
      const k = f.quality

      if (!water) water = new Water(sprites, cssWidth, cssHeight, k)
      else if (water.width !== cssWidth || water.height !== cssHeight || water.k !== k) water = water.resized(cssWidth, cssHeight, k)

      water.update(Math.min(1.1 * 4, f.step * 60), f.amount)
      backdrop.check(f.time * 1000, cssWidth, cssHeight)

      gl.useProgram(program)

      if (!backdrop.ready) {

        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        return

      }

      if (uploaded !== backdrop.version) {

        upload(gl, textures.sharp, 1, backdrop.sharp)
        upload(gl, textures.blur, 2, backdrop.blur)
        upload(gl, textures.lens, 3, backdrop.lens)
        uploaded = backdrop.version

      }

      upload(gl, textures.water, 0, water.map)
      bind(gl, textures.sharp, 1)
      bind(gl, textures.blur, 2)
      bind(gl, textures.lens, 3)

      gl.uniform1i(u.uWater, 0)
      gl.uniform1i(u.uSharp, 1)
      gl.uniform1i(u.uBlur, 2)
      gl.uniform1i(u.uLens, 3)
      gl.uniform2f(u.uRes, f.width, f.height)
      gl.uniform1f(u.uScale, f.scale)
      gl.uniform4f(u.uTint, ...backdrop.tint)
      gl.uniform1f(u.uFog, f.fog ? 1 : 0)
      gl.uniform1f(u.uFlash, f.flash)

      drawFullscreen(gl)
    },
    destroy() {

      gl.deleteProgram(program)
      Object.values(textures).forEach((t) => gl.deleteTexture(t))
    },
  }
}