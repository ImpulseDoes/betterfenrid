// CODE STOLEN FROM https://tympanus.net/codrops/2015/11/04/rain-water-effect-experiments/

import type { Effect } from './effect'
import { compile, drawFullscreen } from './gl'

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
const UNIFORMS = ['uRes', 'uScale', 'uTime', 'uFlow', 'uAmount', 'uWind', 'uColor', 'uDrops', 'uFlash'] as const

export function createRain(gl: WebGLRenderingContext): Effect {

  const { program, uniforms: u } = compile(gl, RAIN, UNIFORMS)

  return {
    draw(f) {

      gl.useProgram(program)
      gl.uniform2f(u.uRes, f.width, f.height)
      gl.uniform1f(u.uScale, f.scale)
      gl.uniform1f(u.uTime, f.time)
      gl.uniform1f(u.uFlow, f.flow)
      gl.uniform1f(u.uAmount, f.amount)
      gl.uniform1f(u.uWind, f.wind)
      gl.uniform3f(u.uColor, ...f.color)
      gl.uniform1f(u.uDrops, f.drops ? 1 : 0)
      gl.uniform1f(u.uFlash, f.flash)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      drawFullscreen(gl)
    },
    destroy: () => gl.deleteProgram(program),
  }
}