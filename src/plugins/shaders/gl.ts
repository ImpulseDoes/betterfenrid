const VERTEX = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }'

export interface Program<U extends string> {
  program: WebGLProgram
  uniforms: Record<U, WebGLUniformLocation | null>
}

export function compile<U extends string>(gl: WebGLRenderingContext, fragment: string, names: readonly U[]): Program<U> {

  const program = gl.createProgram()!

  for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, fragment]] as const) {

    const shader = gl.createShader(type)!

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader did not compile')

    gl.attachShader(program, shader)
    gl.deleteShader(shader)
  }

  gl.bindAttribLocation(program, 0, 'a')
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Shader did not link')

  const uniforms = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)])) as Record<U, WebGLUniformLocation | null>

  return { program, uniforms }
}

const triangles = new WeakMap<WebGLRenderingContext, WebGLBuffer>()

// One triangle bigger than the screen covers every pixel
export function drawFullscreen(gl: WebGLRenderingContext) {

  let buffer = triangles.get(gl)

  if (!buffer) {

    buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    triangles.set(gl, buffer)

  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

export function createTexture(gl: WebGLRenderingContext): WebGLTexture {

  const texture = gl.createTexture()!

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))

  return texture
}

export function upload(gl: WebGLRenderingContext, texture: WebGLTexture, unit: number, source: TexImageSource) {

  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
}

export function bind(gl: WebGLRenderingContext, texture: WebGLTexture, unit: number) {

  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
}

export function uploadBytes(gl: WebGLRenderingContext, texture: WebGLTexture, unit: number, width: number, height: number, data: Uint8Array) {

  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
}

export interface Target {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
}

export function createTarget(gl: WebGLRenderingContext, width: number, height: number): Target {

  const texture = createTexture(gl)
  const framebuffer = gl.createFramebuffer()!

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  return { texture, framebuffer }
}