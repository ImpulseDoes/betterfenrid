import { toast } from '../api/toast'
import { definePlugin } from '../core/plugins'
import { SEE_THROUGH_CSS } from '../core/seeThrough'
import { settings } from '../core/settings'
import { THEMES } from '../core/theme'

const COMMON = `
precision highp float;

uniform vec2 uRes;      // canvas size in device pixels
uniform float uScale;   // device pixels per CSS pixel
uniform float uTime;    // seconds
uniform float uFlow;    // seconds, scaled by the Speed setting
uniform float uAmount;  // 0..1
uniform float uWind;    // -1..1
uniform vec3 uColor;
uniform float uDrops;   // 0 or 1
uniform float uFlash;   // 0..1, lightning

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
`

const RAIN = `${COMMON}
float sheet(vec2 p, float depth) {

  float cellW = mix(6.0, 26.0, depth);
  float cellH = mix(110.0, 320.0, depth);
  float speed = mix(650.0, 1500.0, depth);
  float len = mix(14.0, 64.0, depth);
  float width = mix(0.45, 1.3, depth);
  float aa = 1.0 / uScale;

  p.x -= p.y * uWind * 0.45;
  p.x += depth * 913.0;

  float col = floor(p.x / cellW);
  float colRnd = hash(vec2(col, depth * 17.0 + 3.0));
  float y = p.y - uFlow * speed * (0.85 + 0.3 * colRnd) - colRnd * 997.0;
  float row = floor(y / cellH);

  if (hash(vec2(col + 0.5, row + depth * 31.0)) > uAmount * mix(0.9, 0.35, depth)) return 0.0;

  float head = cellH * (0.25 + 0.7 * hash(vec2(row + 2.1, col * 1.37)));
  float d = head - (y - row * cellH);

  if (d < 0.0 || d > len) return 0.0;

  float jitter = (hash(vec2(col * 3.1, row + 9.2)) - 0.5) * max(cellW - 4.0 * width, 0.0);
  float dx = abs(p.x - (col + 0.5) * cellW - jitter);
  float line = smoothstep(width + aa, width * 0.3, dx);
  float tail = 1.0 - d / len;

  return line * tail * tail;
}

vec3 glass(vec2 p, float cell) {

  vec2 id = floor(p / cell);
  float seed = hash(id + 0.31);

  if (seed > uAmount * 0.55) return vec3(0.0);

  vec2 center = vec2(hash(id + 1.7), hash(id + 5.3)) * vec2(cell - 24.0, cell - 70.0) + 12.0;
  float radius = mix(2.5, 7.5, hash(id + 8.9));
  float life = fract(uTime * mix(0.03, 0.08, hash(id + 2.2)) + seed * 7.0);
  float fade = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.55, 1.0, life));

  center.y += smoothstep(0.6, 1.0, life) * 40.0;

  vec2 v = p - id * cell - center;

  v.y *= 0.85;

  float dist = length(v);
  float aa = 1.0 / uScale;
  float body = 1.0 - smoothstep(radius - aa, radius + aa, dist);
  float edge = smoothstep(radius * 0.45, radius, dist);
  float down = v.y / radius;

  // A drop works like a small lens: light gathers at its bottom edge, the top edge stays dark
  float lit = body * edge * smoothstep(-0.2, 1.0, down);
  float shade = body * (0.45 + 0.55 * edge * smoothstep(0.3, -1.0, down));
  float spot = body * (1.0 - smoothstep(0.0, radius * 0.28, length(v - vec2(-0.32, -0.42) * radius)));

  return vec3(lit, spot, shade) * fade;
}

void main() {

  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;

  float rain = sheet(p, 0.0) * 0.35 + sheet(p, 0.33) * 0.55 + sheet(p, 0.66) * 0.75 + sheet(p, 1.0) * 0.95;

  vec3 color = uColor * rain;
  float alpha = rain;

  if (uDrops > 0.5) {

    vec3 g = glass(p, 90.0) + glass(p + vec2(41.0, 67.0), 140.0);

    color += uColor * g.x * 0.75 + vec3(g.y * 0.9);
    alpha += g.x * 0.75 + g.y * 0.9 + g.z * 0.2;
  }

  float fog = (1.0 - smoothstep(0.0, 0.45, gl_FragCoord.y / uRes.y)) * 0.16;

  color += uColor * 0.5 * fog + vec3(0.82, 0.88, 1.0) * uFlash;
  alpha = clamp(alpha + fog + uFlash, 0.0, 1.0);

  gl_FragColor = vec4(min(color, vec3(alpha)), alpha);
}
`

const SHADERS: Record<string, { label: string; fragment: string }> = {
  rain: { label: 'Rain', fragment: RAIN },
}

const VERTEX = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }'

const UNIFORMS = ['uRes', 'uScale', 'uTime', 'uFlow', 'uAmount', 'uWind', 'uColor', 'uDrops', 'uFlash'] as const

const QUALITY: Record<string, number> = { low: 0.5, medium: 0.75, high: 1 }

const HEX = /^#?([0-9a-f]{6})$/i

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

type Uniforms = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>

function compile(gl: WebGLRenderingContext, fragment: string): { program: WebGLProgram; uniforms: Uniforms } {

  const program = gl.createProgram()!

  for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, fragment]] as const) {

    const shader = gl.createShader(type)!

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader did not compile')

    gl.attachShader(program, shader)
  }

  gl.bindAttribLocation(program, 0, 'a')
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Shader did not link')

  const uniforms = Object.fromEntries(UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)])) as Uniforms

  return { program, uniforms }
}

// Two quick flickers that fade out, like a lightning strike seen through clouds
function lightning(since: number): number {

  if (since < 0) return 0

  const first = Math.exp(-since * 14)
  const second = since > 0.13 ? Math.exp(-(since - 0.13) * 6) * 0.7 : 0

  return Math.min(1, first + second) * 0.22
}

export default definePlugin({
  id: 'shaders',
  name: 'Shaders',
  description: 'Animated effects drawn by your graphics card behind Fenrid, on top of your wallpaper. For now: rain.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    shader: {
      type: 'select',
      label: 'Effect',
      default: 'rain',
      options: Object.entries(SHADERS).map(([value, { label }]) => ({ label, value })),
    },
    amount: {
      type: 'number',
      label: 'Amount',
      description: 'How heavy the rain is, in percent.',
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
    wind: {
      type: 'number',
      label: 'Wind',
      description: 'Below zero blows to the left, above zero to the right.',
      default: 15,
      min: -100,
      max: 100,
      step: 5,
    },
    opacity: {
      type: 'number',
      label: 'Opacity',
      description: 'In percent.',
      default: 70,
      min: 10,
      max: 100,
      step: 5,
    },
    color: {
      type: 'string',
      label: 'Color',
      description: 'As #RRGGBB.',
      placeholder: '#a8c8ff',
      default: '#a8c8ff',
    },
    glass: {
      type: 'boolean',
      label: 'Drops on the glass',
      description: 'Drops that land on the screen, sit there and slide off.',
      default: true,
    },
    lightning: {
      type: 'boolean',
      label: 'Lightning',
      description: 'A soft flash every now and then. Leave it off if flashing light bothers you.',
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

    let gl: WebGLRenderingContext | null = null
    let compiled: { program: WebGLProgram; uniforms: Uniforms } | null = null
    let compiledFor = ''

    const setup = (): boolean => {

      gl ??= canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })

      if (!gl) {

        toast('Shaders need WebGL, which is turned off in this browser', 'error', 5000)
        return false

      }

      const id = SHADERS[ctx.settings.shader] ? ctx.settings.shader : 'rain'

      if (compiled && compiledFor === id) return true

      try {

        if (compiled) gl.deleteProgram(compiled.program)

        compiled = compile(gl, SHADERS[id].fragment)
        compiledFor = id

      } catch (error) {

        ctx.log.error('Shader failed', error)
        toast('The effect could not start', 'error', 4000)
        compiled = null
        return false

      }

      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
      // One triangle bigger than the screen covers every pixel
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      gl.useProgram(compiled.program)

      return true
    }

    let color: [number, number, number] = [0.66, 0.78, 1]
    let warned = ''

    const applySettings = () => {

      const theme = THEMES.find((t) => t.id === settings.get().theme.preset)
      const base = theme?.preview?.bg ?? '#0e0f12'

      layer.set(`
.bf-shader {
  opacity: ${Math.min(100, Math.max(0, Number(ctx.settings.opacity) || 0)) / 100};
}
${theme?.assets ? '' : `html:root { --bf-wall-base: ${base}; background-color: ${base} !important; }\n${SEE_THROUGH_CSS}`}`)

      const raw = ctx.settings.color.trim()
      const hex = raw.match(HEX)?.[1]

      if (hex) color = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
      else if (raw && warned !== raw) {

        warned = raw
        toast('The color has to look like #a8c8ff', 'error', 3000)

      }

      if (gl && !gl.isContextLost()) setup()
    }

    let frame = 0
    let lastDraw = 0
    let clock = 0
    let flow = 0
    let strikeAt = -1
    let nextStrike = 6 + Math.random() * 10

    const draw = (now: number) => {

      frame = requestAnimationFrame(draw)

      const cap = Number(ctx.settings.fps) || 0

      if (cap && now - lastDraw < 1000 / cap - 2) return

      const step = Math.min(0.1, (now - lastDraw) / 1000)

      lastDraw = now
      clock += step
      flow += step * (Number(ctx.settings.speed) || 100) / 100

      if (!gl || !compiled || gl.isContextLost()) return

      const scale = (window.devicePixelRatio || 1) * (QUALITY[ctx.settings.quality] ?? 0.75)
      const width = Math.max(1, Math.round(window.innerWidth * scale))
      const height = Math.max(1, Math.round(window.innerHeight * scale))

      if (canvas.width !== width || canvas.height !== height) {

        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)

      }

      if (ctx.settings.lightning && clock >= nextStrike) {

        strikeAt = clock
        nextStrike = clock + 8 + Math.random() * 22

      }

      const u = compiled.uniforms

      gl.uniform2f(u.uRes, width, height)
      gl.uniform1f(u.uScale, width / window.innerWidth)
      gl.uniform1f(u.uTime, clock)
      gl.uniform1f(u.uFlow, flow)
      gl.uniform1f(u.uAmount, (Number(ctx.settings.amount) || 0) / 100)
      gl.uniform1f(u.uWind, Math.max(-1, Math.min(1, (Number(ctx.settings.wind) || 0) / 100)))
      gl.uniform3f(u.uColor, ...color)
      gl.uniform1f(u.uDrops, ctx.settings.glass ? 1 : 0)
      gl.uniform1f(u.uFlash, ctx.settings.lightning && strikeAt >= 0 ? lightning(clock - strikeAt) : 0)

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    // The browser can take the graphics card back, for example after a driver reset
    canvas.addEventListener('webglcontextlost', (e) => {

      e.preventDefault()
      compiled = null

    })

    canvas.addEventListener('webglcontextrestored', () => setup())

    applySettings()
    ctx.onSettingsChange(applySettings)

    if (setup()) frame = requestAnimationFrame(draw)

    ctx.onStop(() => {

      cancelAnimationFrame(frame)
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
    })
  },
})