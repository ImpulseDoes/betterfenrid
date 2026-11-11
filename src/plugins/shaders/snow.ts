import { Backdrop, backdropTextures } from './backdrop'
import type { Effect } from './effect'
import { compile, drawFullscreen } from './gl'

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uSharp;
uniform sampler2D uBlur;
uniform vec2 uRes;
uniform float uScale;
uniform vec4 uTint;
uniform float uFog;
uniform float uTime;
uniform float uAmount;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float flakes(vec2 px, float depth, float seed) {

  float cell = mix(22.0, 340.0, depth * depth);
  float fall = mix(38.0, 560.0, pow(depth, 1.6));
  float radius = mix(1.3, 30.0, pow(depth, 2.2));
  float soft = clamp(abs(depth - 0.3) * 2.2, 0.12, 0.95);

  vec2 p = px / cell;

  p.y -= uTime * fall / cell;
  p.x += (uTime * (14.0 + depth * 60.0) + sin(uTime * 0.21 + seed) * 50.0 * depth) / cell;
  p.x += sin(p.y * 0.8 + seed * 6.3) * 0.3;

  vec2 id = floor(p);
  vec2 f = fract(p);
  float pick = hash(id + seed);

  if (pick > uAmount) return 0.0;

  float size = radius / cell * (0.55 + 0.9 * hash(id + seed + 3.3));
  float room = 0.5 - size - 0.1;
  vec2 center = 0.5 + (vec2(hash(id + seed + 1.7), hash(id + seed + 9.2)) - 0.5) * 2.0 * max(room, 0.0);

  center.x += sin(uTime * (0.8 + pick * 14.0) + pick * 60.0) * 0.08;

  vec2 d = (f - center) * vec2(1.0, 1.0 / (1.0 + depth * 0.3));
  float flake = smoothstep(size, size * (1.0 - soft), length(d));

  return flake * mix(0.95, 0.16, smoothstep(0.3, 1.0, depth)) * (0.6 + 0.4 * hash(id + seed + 5.1));
}

void main() {

  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;
  vec2 uv = px * uScale / uRes;

  vec3 color = uFog > 0.5 ? texture2D(uBlur, uv).rgb * 0.94 + 0.03 : texture2D(uSharp, uv).rgb;

  color = mix(color * vec3(0.94, 0.97, 1.0), vec3(0.78, 0.83, 0.9), 0.05 + uAmount * 0.07);

  for (int i = 0; i < 9; i++) {

    float depth = float(i) / 8.0;
    float a = flakes(px, depth, float(i) * 17.31 + 2.0);

    color = mix(color, mix(vec3(0.86, 0.9, 0.96), vec3(1.0), depth), a);
  }

  color = mix(color, uTint.rgb, uTint.a);

  gl_FragColor = vec4(color, 1.0);
}
`

const UNIFORMS = ['uSharp', 'uBlur', 'uRes', 'uScale', 'uTint', 'uFog', 'uTime', 'uAmount'] as const

export function createSnow(gl: WebGLRenderingContext): Effect {

  const { program, uniforms: u } = compile(gl, FRAGMENT, UNIFORMS)
  const wallpaper = backdropTextures(gl)
  const backdrop = new Backdrop()

  // Starts a while in, so the first frame isn't an empty sky
  let clock = 40

  return {
    draw(f) {

      clock += f.step
      backdrop.check(f.time * 1000, Math.round(f.width / f.scale), Math.round(f.height / f.scale))

      gl.useProgram(program)

      if (!backdrop.ready) {

        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        return

      }

      wallpaper.bind(backdrop, 0)

      gl.uniform1i(u.uSharp, 0)
      gl.uniform1i(u.uBlur, 1)
      gl.uniform2f(u.uRes, f.width, f.height)
      gl.uniform1f(u.uScale, f.scale)
      gl.uniform4f(u.uTint, ...backdrop.tint)
      gl.uniform1f(u.uFog, f.fog ? 1 : 0)
      gl.uniform1f(u.uTime, clock)
      gl.uniform1f(u.uAmount, 0.12 + f.amount * 0.78)

      drawFullscreen(gl)
    },
    destroy() {

      gl.deleteProgram(program)
      wallpaper.destroy()
    },
  }
}