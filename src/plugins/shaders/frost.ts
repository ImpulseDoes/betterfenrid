import { Backdrop, backdropTextures } from './backdrop'
import type { Effect } from './effect'
import { bind, compile, createTarget, drawFullscreen, type Target } from './gl'

const PRECISION = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`

const CRYSTALS = `${PRECISION}
uniform vec2 uRes;
uniform float uScale;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float gain = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += noise(p) * gain;
    p = p * 2.03 + 17.0;
    gain *= 0.5;
  }
  return sum;
}

float feather(vec2 q, float len, float seed) {

  float x = q.x;
  float y = abs(q.y);

  if (x < -0.02 || x > len || y > len * 0.5) return 0.0;

  float t = clamp(x / len, 0.0, 1.0);
  float stem = 1.0 - y / (0.02 * (1.0 - t) + 0.003);

  float gap = 0.03 + seed * 0.018;
  float root = floor((x - y * 0.577) / gap + 0.5) * gap;
  vec2 v = vec2(x - root, y);
  float along = dot(v, vec2(0.5, 0.866));
  float across = abs(dot(v, vec2(-0.866, 0.5)));
  float reach = len * 0.44 * (1.0 - clamp(root / len, 0.0, 1.0)) * (0.5 + 0.5 * hash(vec2(root * 37.0, seed * 91.0)));
  float inside = step(0.0, along) * step(along, reach) * step(0.0, root) * step(root, len);
  float barb = (1.0 - across / (0.011 * (1.0 - clamp(along / max(reach, 0.001), 0.0, 1.0)) + 0.002)) * inside;

  float gap2 = gap * 0.42;
  float root2 = floor((along - across * 0.577) / gap2 + 0.5) * gap2;
  vec2 v2 = vec2(along - root2, across);
  float along2 = dot(v2, vec2(0.5, 0.866));
  float across2 = abs(dot(v2, vec2(-0.866, 0.5)));
  float reach2 = reach * 0.32 * (1.0 - clamp(root2 / max(reach, 0.001), 0.0, 1.0));
  float tiny = (1.0 - across2 / 0.0045) * step(0.0, along2) * step(along2, reach2) * step(gap2 * 0.5, root2) * step(root2, reach) * inside * 0.75;

  return max(max(stem, barb), max(tiny, 0.0));
}

float feathers(vec2 p, vec2 away, float seed) {

  vec2 id = floor(p);
  vec2 f = fract(p);
  float turn = atan(away.y, away.x);
  float h = 0.0;

  for (int j = -1; j <= 1; j++) {

    for (int i = -1; i <= 1; i++) {

      vec2 cell = id + vec2(float(i), float(j));
      vec2 from = f - vec2(float(i), float(j)) - vec2(hash(cell + seed), hash(cell + seed + 7.1));
      float a = turn + (hash(cell + seed + 3.7) - 0.5) * 3.4;
      vec2 dir = vec2(cos(a), sin(a));

      h = max(h, feather(vec2(dot(from, dir), dot(from, vec2(-dir.y, dir.x))), 0.5 + hash(cell + seed + 1.3) * 0.45, hash(cell + seed + 5.5)));
    }
  }

  return h;
}

void main() {

  vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  vec2 px = uv * uRes / uScale;

  vec2 edge = min(uv, 1.0 - uv);
  vec2 pull = (0.5 - uv) / (edge + 0.04);
  vec2 away = pull / max(length(pull), 0.001);

  float thick = feathers(px / 300.0, away, 0.0);

  thick = max(thick, feathers(px / 150.0 + 31.7, away, 13.0) * 0.85);
  thick = max(thick, feathers(px / 78.0 + 77.1, away, 29.0) * 0.7);
  thick = max(thick, feathers(px / 40.0 + 11.3, away, 47.0) * 0.5);

  float reach = mix(min(edge.x, edge.y), sqrt(edge.x * edge.y), 0.55);

  reach += (fbm(px / 190.0) - 0.47) * 0.24 + (fbm(px / 46.0) - 0.47) * 0.07;

  float grain = fbm(px / 5.0) * 0.6 + noise(px / 1.7) * 0.4;
  float glint = step(0.991, hash(floor(px / 2.0) + 0.5)) * hash(floor(px / 2.0) + 9.5);

  gl_FragColor = vec4(clamp(thick, 0.0, 1.0), clamp(reach * 1.6 + 0.1, 0.0, 1.0), grain, glint);
}
`

const GLASS = `${PRECISION}
uniform sampler2D uIce;
uniform sampler2D uSharp;
uniform sampler2D uBlur;
uniform vec2 uRes;
uniform vec4 uTint;
uniform float uFog;
uniform float uTime;
uniform float uReach;

void main() {

  vec2 uv = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  vec2 texel = 1.5 / uRes;

  vec2 at = vec2(uv.x, 1.0 - uv.y);
  vec4 ice = texture2D(uIce, at);
  float reach = (ice.g - 0.1) / 1.6;

  float solid = smoothstep(uReach, uReach - 0.13, reach);
  float fringe = smoothstep(uReach + 0.13, uReach - 0.03, reach);
  float cover = clamp(fringe * ice.r * 1.5 + solid * (0.62 + 0.25 * ice.b + 0.3 * ice.r), 0.0, 1.0) * step(0.002, uReach + 0.13);

  vec2 slope = vec2(texture2D(uIce, at + vec2(texel.x, 0.0)).r, texture2D(uIce, at - vec2(0.0, texel.y)).r) - ice.r;

  vec2 bent = uv + slope * 0.03 * fringe + (ice.b - 0.5) * 0.012 * solid;

  vec3 clear = uFog > 0.5 ? texture2D(uBlur, uv).rgb * 0.94 + 0.03 : texture2D(uSharp, uv).rgb;
  vec3 behind = texture2D(uBlur, bent).rgb;

  float white = mix(0.42 + ice.r * 0.3, 0.38 + ice.r * 0.5 + ice.b * 0.12, solid);
  vec3 frosted = mix(behind * 1.1 + 0.04, vec3(0.88, 0.93, 1.0), clamp(white, 0.0, 0.95));

  vec3 normal = normalize(vec3(-slope * 9.0, 1.0));
  float shine = pow(max(dot(normal, normalize(vec3(-0.4, -0.6, 0.7))), 0.0), 24.0);
  float glint = ice.a * pow(max(sin(uTime * (0.6 + ice.a * 1.8) + ice.a * 400.0), 0.0), 12.0);

  vec3 color = mix(clear, frosted, cover);

  color += (shine * 0.16 * ice.r + glint * 0.75) * cover;
  color = mix(color, uTint.rgb, uTint.a);

  gl_FragColor = vec4(color, 1.0);
}
`

export function createFrost(gl: WebGLRenderingContext): Effect {

  const crystals = compile(gl, CRYSTALS, ['uRes', 'uScale'] as const)
  const glass = compile(gl, GLASS, ['uIce', 'uSharp', 'uBlur', 'uRes', 'uTint', 'uFog', 'uTime', 'uReach'] as const)
  const wallpaper = backdropTextures(gl)
  const backdrop = new Backdrop()

  let ice: Target | null = null
  let size = ''
  let reach = -0.13

  const destroyIce = () => {

    if (!ice) return

    gl.deleteTexture(ice.texture)
    gl.deleteFramebuffer(ice.framebuffer)
  }

  return {
    draw(f) {

      if (size !== `${f.width}x${f.height}`) {

        size = `${f.width}x${f.height}`
        destroyIce()
        ice = createTarget(gl, f.width, f.height)

        gl.bindFramebuffer(gl.FRAMEBUFFER, ice.framebuffer)
        gl.useProgram(crystals.program)
        gl.uniform2f(crystals.uniforms.uRes, f.width, f.height)
        gl.uniform1f(crystals.uniforms.uScale, f.scale)
        drawFullscreen(gl)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      }

      const target = -0.13 + f.amount ** 1.4 * 0.9

      reach += (target - reach) * (1 - Math.exp(-f.step / 9))

      backdrop.check(f.time * 1000, Math.round(f.width / f.scale), Math.round(f.height / f.scale))

      gl.useProgram(glass.program)

      if (!backdrop.ready || !ice) {

        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        return

      }

      bind(gl, ice.texture, 0)
      wallpaper.bind(backdrop, 1)

      const u = glass.uniforms

      gl.uniform1i(u.uIce, 0)
      gl.uniform1i(u.uSharp, 1)
      gl.uniform1i(u.uBlur, 2)
      gl.uniform2f(u.uRes, f.width, f.height)
      gl.uniform4f(u.uTint, ...backdrop.tint)
      gl.uniform1f(u.uFog, f.fog ? 1 : 0)
      gl.uniform1f(u.uTime, f.time)
      gl.uniform1f(u.uReach, reach)

      drawFullscreen(gl)
    },
    destroy() {

      gl.deleteProgram(crystals.program)
      gl.deleteProgram(glass.program)
      destroyIce()
      wallpaper.destroy()
    },
  }
}