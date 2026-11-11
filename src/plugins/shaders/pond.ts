import { Backdrop, backdropTextures } from './backdrop'
import type { Effect } from './effect'
import { bind, compile, createTexture, drawFullscreen, uploadBytes } from './gl'

const STEP = 1 / 60
const DAMPING = 0.986
const SLOPE = 900
const CURVE = 1400

class Surface {

  readonly pixels: Uint8Array
  private height: Float32Array
  private velocity: Float32Array

  constructor(readonly cols: number, readonly rows: number) {

    this.height = new Float32Array(cols * rows)
    this.velocity = new Float32Array(cols * rows)
    this.pixels = new Uint8Array(cols * rows * 4)
  }

  drop(x: number, y: number, radius: number, strength: number) {

    const { cols, rows, height } = this

    for (let cy = Math.max(1, Math.floor(y - radius)); cy <= Math.min(rows - 2, Math.ceil(y + radius)); cy++) {

      for (let cx = Math.max(1, Math.floor(x - radius)); cx <= Math.min(cols - 2, Math.ceil(x + radius)); cx++) {

        const d = Math.hypot(cx - x, cy - y) / radius

        if (d < 1) height[cy * cols + cx] -= (0.5 + Math.cos(d * Math.PI) * 0.5) * strength
      }
    }
  }

  step() {

    const { cols, rows, height, velocity } = this

    for (let y = 1; y < rows - 1; y++) {

      for (let i = y * cols + 1, end = y * cols + cols - 1; i < end; i++) {

        velocity[i] = (velocity[i] + ((height[i - 1] + height[i + 1] + height[i - cols] + height[i + cols]) * 0.25 - height[i]) * 1.9) * DAMPING
      }
    }

    for (let i = 0; i < height.length; i++) height[i] += velocity[i]

    for (let x = 0; x < cols; x++) {

      height[x] = height[x + cols]
      height[(rows - 1) * cols + x] = height[(rows - 2) * cols + x]
    }

    for (let y = 0; y < rows; y++) {

      height[y * cols] = height[y * cols + 1]
      height[y * cols + cols - 1] = height[y * cols + cols - 2]
    }
  }

  paint() {

    const { cols, rows, height, pixels } = this

    for (let y = 0; y < rows; y++) {

      const up = Math.max(0, y - 1) * cols
      const down = Math.min(rows - 1, y + 1) * cols

      for (let x = 0; x < cols; x++) {

        const left = height[y * cols + Math.max(0, x - 1)]
        const right = height[y * cols + Math.min(cols - 1, x + 1)]
        const above = height[up + x]
        const below = height[down + x]
        const o = (y * cols + x) * 4

        pixels[o] = 127.5 + (right - left) * SLOPE
        pixels[o + 1] = 127.5 + (below - above) * SLOPE
        pixels[o + 2] = 127.5 + ((left + right + above + below) * 0.25 - height[y * cols + x]) * CURVE
        pixels[o + 3] = 255
      }
    }
  }
}

const FRAGMENT = `
precision mediump float;

uniform sampler2D uWave;
uniform sampler2D uSharp;
uniform sampler2D uBlur;
uniform vec2 uRes;
uniform vec2 uCell;
uniform vec4 uTint;
uniform float uFog;
uniform float uTime;

vec3 wave(vec2 uv) {
  vec2 o = uCell * 0.5;
  return (texture2D(uWave, uv + o).rgb + texture2D(uWave, uv - o).rgb + texture2D(uWave, uv + vec2(o.x, -o.y)).rgb + texture2D(uWave, uv + vec2(-o.x, o.y)).rgb) * 0.25 - 0.498;
}

void main() {

  vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  vec2 aspect = vec2(uRes.y / uRes.x, 1.0);

  vec3 w = wave(uv);

  vec2 p = uv / aspect * 5.0;
  vec2 swell = vec2(
    sin(p.y * 1.7 + uTime * 0.6) + sin((p.x + p.y) * 1.1 - uTime * 0.45) * 0.7,
    sin(p.x * 1.5 - uTime * 0.5) + sin((p.x - p.y) * 1.3 + uTime * 0.4) * 0.7
  ) * 0.012;

  vec2 slope = w.rg * 2.0 + swell;
  vec2 bent = uv - slope * aspect * 0.3;

  vec3 color = uFog > 0.5 ? texture2D(uBlur, bent).rgb : texture2D(uSharp, bent).rgb;

  float gather = w.b * 2.0;

  color *= 1.0 + clamp(gather * 7.0, -0.35, 1.6);

  vec3 normal = normalize(vec3(-slope * 7.0, 1.0));
  float shine = pow(max(dot(normal, normalize(vec3(-0.35, -0.5, 0.8))), 0.0), 90.0);
  float sky = pow(1.0 - normal.z, 1.5);

  color = color * vec3(0.93, 0.98, 1.0) + sky * vec3(0.5, 0.62, 0.72) * 0.6 + shine * 0.7;

  color = mix(color, uTint.rgb, uTint.a);

  gl_FragColor = vec4(color, 1.0);
}
`

const UNIFORMS = ['uWave', 'uSharp', 'uBlur', 'uRes', 'uCell', 'uTint', 'uFog', 'uTime'] as const

export function createPond(gl: WebGLRenderingContext): Effect {

  const { program, uniforms: u } = compile(gl, FRAGMENT, UNIFORMS)
  const waveTexture = createTexture(gl)
  const wallpaper = backdropTextures(gl)
  const backdrop = new Backdrop()

  let surface: Surface | null = null
  let pending = 0
  let rain = 0
  let last: { x: number; y: number } | null = null

  return {
    draw(f) {

      const cssWidth = Math.round(f.width / f.scale)
      const cssHeight = Math.round(f.height / f.scale)
      const cols = Math.max(96, Math.min(400, Math.round((cssWidth / 5) * f.quality)))
      const rows = Math.max(2, Math.round((cols * cssHeight) / cssWidth))

      if (!surface || surface.cols !== cols || surface.rows !== rows) surface = new Surface(cols, rows)

      const cell = cols / cssWidth

      if (f.pointer && last && (f.pointer.x !== last.x || f.pointer.y !== last.y)) {

        const distance = Math.hypot(f.pointer.x - last.x, f.pointer.y - last.y)
        const dents = Math.min(12, Math.ceil((distance * cell) / 2))

        for (let i = 1; i <= dents && distance < 400; i++) {

          surface.drop((last.x + ((f.pointer.x - last.x) * i) / dents) * cell, (last.y + ((f.pointer.y - last.y) * i) / dents) * cell, 2.2, Math.min(0.014, distance * 0.0005))
        }
      }

      last = f.pointer && { ...f.pointer }

      pending = Math.min(pending + f.step, STEP * 4)

      while (pending >= STEP) {

        pending -= STEP
        rain += f.amount * 7 * STEP * Math.max(0.5, (cssWidth * cssHeight) / (1400 * 800))

        while (rain >= 1) {

          rain--

          const size = Math.random() ** 2

          surface.drop(Math.random() * cols, Math.random() * rows, 1.6 + size * 2.2, 0.06 + size * 0.16)
        }

        surface.step()
      }

      surface.paint()
      backdrop.check(f.time * 1000, cssWidth, cssHeight)

      gl.useProgram(program)

      if (!backdrop.ready) {

        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        return

      }

      uploadBytes(gl, waveTexture, 0, cols, rows, surface.pixels)
      bind(gl, waveTexture, 0)
      wallpaper.bind(backdrop, 1)

      gl.uniform1i(u.uWave, 0)
      gl.uniform1i(u.uSharp, 1)
      gl.uniform1i(u.uBlur, 2)
      gl.uniform2f(u.uRes, f.width, f.height)
      gl.uniform2f(u.uCell, 1 / cols, 1 / rows)
      gl.uniform4f(u.uTint, ...backdrop.tint)
      gl.uniform1f(u.uFog, f.fog ? 1 : 0)
      gl.uniform1f(u.uTime, f.time)

      drawFullscreen(gl)
    },
    destroy() {

      gl.deleteProgram(program)
      gl.deleteTexture(waveTexture)
      wallpaper.destroy()
    },
  }
}