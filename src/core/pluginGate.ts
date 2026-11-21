const ALLOWED_KEY = 'BetterFenrid:allowedPlugins'
const DISMISSED_KEY = 'BetterFenrid:dismissedPlugins'

const LOADER_FRAME = /betterfenrid-plugins\/([^:\s)]+):2:\d+/
const OWN_HOSTS = /^(.+\.)?fenrid\.com$/i
const LONG_LINE = 1000

const CHECKS: [RegExp, string][] = [
  [/\beval\s*\(|\bFunction\s*\(/, 'Runs code made from text (eval or Function)'],
  [/\b_0x[0-9a-f]{3,}|(\\x[0-9a-f]{2}.*){6}|\batob\s*\(|fromCharCode/i, 'Has scrambled or encoded code'],
  [/\[\s*(['"`])[^'"`]*\1\s*\+/, 'Builds names out of pieces of text, which can hide what it uses'],
  [/document\s*\.\s*cookie/, 'Reads your cookies'],
  [/\b(localStorage|sessionStorage|indexedDB)\b/, 'Reads data saved in the app'],
  [/\btoken\b|authorization/i, 'Mentions tokens or authorization'],
  [/password|\bemail\b/i, 'Mentions your password or email'],
  [/webhook/i, 'Mentions webhooks, a common way to send stolen data'],
  [/\bXMLHttpRequest\b|\bWebSocket\b|sendBeacon|\bEventSource\b/, 'Opens its own connections'],
  [/createElement\s*\(\s*['"`]script|\bimport\s*\(|importScripts/, 'Loads more code from somewhere else'],
  [/\brequire\s*\(|\bprocess\s*\.|child_process|BetterFenridNative/, 'Tries to reach the desktop app or your computer'],
]

export interface BlockedPlugin {
  file: string
  hash: string
  findings: string[]
  changed: boolean
}

const blocked = new Map<string, BlockedPlugin>()
const listeners = new Set<(plugin: BlockedPlugin) => void>()

export const blockedPlugins = () => [...blocked.values()].sort((a, b) => a.file.localeCompare(b.file))

export function onPluginBlocked(listener: (plugin: BlockedPlugin) => void): () => void {

  listeners.add(listener)

  return () => listeners.delete(listener)
}

export function scanPlugin(code: string): string[] {

  const found = new Map<string, number>()
  const lines = code.split('\n')

  lines.forEach((line, i) => {

    for (const [pattern, label] of CHECKS) if (!found.has(label) && pattern.test(line)) found.set(label, i + 1)

    for (const [, host] of line.matchAll(/\b(?:https?|wss?):\/\/([a-z0-9.-]+)/gi)) {

      const label = `Talks to ${host.toLowerCase()}`

      if (!OWN_HOSTS.test(host) && !found.has(label)) found.set(label, i + 1)
    }

    if (line.length > LONG_LINE && !found.has('long')) found.set('long', i + 1)
  })

  return [...found].map(([label, line]) => label === 'long' ? `Is packed into very long lines, so it is hard to read (line ${line})` : `${label} (line ${line})`)
}

type Store = Record<string, string>

function read(key: string): Store {

  try {

    const value = JSON.parse(localStorage.getItem(key) ?? '{}')

    return value && typeof value === 'object' ? value : {}

  } catch {

    return {}

  }
}

function remember(key: string, file: string, hash: string) {

  localStorage.setItem(key, JSON.stringify({ ...read(key), [file]: hash }))
}

export const allowPlugin = (plugin: BlockedPlugin) => remember(ALLOWED_KEY, plugin.file, plugin.hash)
export const dismissPlugin = (plugin: BlockedPlugin) => remember(DISMISSED_KEY, plugin.file, plugin.hash)
export const isDismissed = (plugin: BlockedPlugin) => read(DISMISSED_KEY)[plugin.file] === plugin.hash

function check(file: string, code: string): boolean {

  const findings = scanPlugin(code)

  if (!findings.length) return true

  const hash = sha256(code)
  const allowed = read(ALLOWED_KEY)[file]

  if (allowed === hash) return true

  const plugin = { file, hash, findings, changed: allowed !== undefined }

  blocked.set(file, plugin)
  console.warn(`[Better Fenrid] Did not run the plugin ${file}, it needs your permission:\n${findings.join('\n')}`)

  for (const l of listeners) l(plugin)

  return false
}

function catchNextCall(file: string) {

  const call = Function.prototype.call

  Function.prototype.call = function (this: Function, thisArg: unknown, ...args: unknown[]) {

    Function.prototype.call = call

    const text = Reflect.apply(Function.prototype.toString, this, []) as string

    if (thisArg !== window || !text.startsWith('function () {')) return Reflect.apply(this, thisArg, args)

    const code = text.slice(text.indexOf('\n') + 1, text.lastIndexOf('\n'))

    return check(file, code) ? Reflect.apply(this, thisArg, args) : undefined
  } as typeof call
}

function loaderFile(): string | null {

  const E = Error as any
  const limit = E.stackTraceLimit

  E.stackTraceLimit = 4

  const stack = new Error().stack ?? ''

  E.stackTraceLimit = limit

  const match = stack.split('\n')[3]?.match(LOADER_FRAME)

  return match ? decodeURIComponent(match[1]) : null
}

export function exposeApi(api: object) {

  Object.defineProperty(window, 'BetterFenrid', {
    configurable: false,
    enumerable: true,
    get() {

      const file = loaderFile()

      if (file) catchNextCall(file)

      return api
    },
  })
}

const PRIMES: number[] = []

for (let n = 2; PRIMES.length < 64; n++) if (PRIMES.every((p) => n % p)) PRIMES.push(n)

const fraction = (x: number) => ((x - Math.floor(x)) * 2 ** 32) >>> 0
const K = PRIMES.map((p) => fraction(Math.cbrt(p)))
const H = PRIMES.slice(0, 8).map((p) => fraction(Math.sqrt(p)))

function sha256(text: string): string {

  const bytes = new TextEncoder().encode(text)
  const length = bytes.length
  const words = new Uint32Array(((length + 72) >> 6) << 4)

  bytes.forEach((b, i) => (words[i >> 2] |= b << (24 - (i % 4) * 8)))
  words[length >> 2] |= 0x80 << (24 - (length % 4) * 8)
  words[words.length - 2] = Math.floor((length * 8) / 2 ** 32)
  words[words.length - 1] = (length * 8) >>> 0

  const h = [...H]
  const w = new Uint32Array(64)
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

  for (let start = 0; start < words.length; start += 16) {

    for (let i = 0; i < 64; i++) {

      if (i < 16) w[i] = words[start + i]
      else {

        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)

        w[i] = w[i - 16] + s0 + w[i - 7] + s1

      }
    }

    let [a, b, c, d, e, f, g, x] = h

    for (let i = 0; i < 64; i++) {

      const t1 = x + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]
      const t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))

      x = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }

    ;[a, b, c, d, e, f, g, x].forEach((v, i) => (h[i] = (h[i] + v) >>> 0))
  }

  return h.map((v) => v.toString(16).padStart(8, '0')).join('')
}