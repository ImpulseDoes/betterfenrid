const fs = require('node:fs')
const path = require('node:path')

const REPO = 'ImpulseDoes/betterfenrid'
const LATEST = `https://github.com/${REPO}/releases/latest/download/betterfenrid.js`
const CHECK_EVERY_MS = 2 * 60 * 60_000
const FIRST_CHECK_MS = 15_000
const TIMEOUT_MS = 30_000

function compareVersions(a, b) {

  const left = String(a).split('.').map(Number)
  const right = String(b).split('.').map(Number)

  for (let i = 0; i < Math.max(left.length, right.length); i++) {

    const diff = (left[i] || 0) - (right[i] || 0)

    if (diff) return Math.sign(diff)

  }

  return 0
}

function versionOf(code) {

  return /\bvar VERSION = "([\d.]+)"/.exec(code)?.[1] ?? '0'
}

function looksLikeMod(code) {

  return typeof code === 'string' && code.length > 10_000 && code.includes('window.BetterFenrid') && versionOf(code) !== '0'
}

class ModUpdater {

  /**
   * @param {{ cacheFile: string, bundledFile: string | null, onReady?: (version: string) => void }} options
   */
  constructor({ cacheFile, bundledFile, onReady }) {

    this.cacheFile = cacheFile
    this.bundledFile = bundledFile
    this.onReady = onReady ?? (() => { })
    // What the page is running right now
    this.loaded = null
    // Downloaded and waiting for a reload
    this.pending = null
    this.checking = null
    this.timer = null
  }

  read(file) {

    try {

      const code = file && fs.readFileSync(file, 'utf8')

      return looksLikeMod(code) ? { code, version: versionOf(code), file } : null

    } catch {

      return null

    }
  }

  // The newest of what's downloaded and what came with the installer
  load() {

    const candidates = [this.read(this.cacheFile), this.read(this.bundledFile)].filter(Boolean)
    const best = candidates.sort((a, b) => compareVersions(b.version, a.version))[0] ?? null

    this.loaded = best
    this.pending = null

    return best
  }

  get version() {

    return this.loaded?.version ?? null
  }

  // Asks GitHub where "latest" points, which names the version without downloading anything
  async latestVersion() {

    const response = await fetch(LATEST, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
    const location = response.headers.get('location') ?? ''
    const tag = /\/releases\/download\/v?([\d.]+)\//.exec(location)?.[1]

    if (!tag) throw new Error(`Unexpected answer from GitHub (${response.status})`)

    return tag
  }

  async download() {

    const response = await fetch(LATEST, { signal: AbortSignal.timeout(TIMEOUT_MS) })

    if (!response.ok) throw new Error(`Download failed (${response.status})`)

    const code = await response.text()

    if (!looksLikeMod(code)) throw new Error('The download is not a Better Fenrid build')

    // Write next to it first, so a half-written file never gets loaded
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true })
    fs.writeFileSync(`${this.cacheFile}.tmp`, code)
    fs.renameSync(`${this.cacheFile}.tmp`, this.cacheFile)

    return versionOf(code)
  }

  /** @returns {Promise<{ status: 'latest' | 'ready' | 'error', version?: string, error?: string }>} */
  check() {

    this.checking ??= (async () => {

      try {

        const latest = await this.latestVersion()
        const have = this.pending ?? this.version ?? '0'

        if (compareVersions(latest, have) <= 0) return { status: this.pending ? 'ready' : 'latest', version: have }

        const version = await this.download()

        this.pending = version
        this.onReady(version)

        return { status: 'ready', version }

      } catch (err) {

        console.warn('[updater]', err)
        return { status: 'error', error: String(err?.message ?? err) }

      } finally {

        this.checking = null

      }
    })()

    return this.checking
  }

  start() {

    this.stop()
    this.firstCheck = setTimeout(() => this.check(), FIRST_CHECK_MS)
    this.timer = setInterval(() => this.check(), CHECK_EVERY_MS)
  }

  stop() {

    clearTimeout(this.firstCheck)
    clearInterval(this.timer)
  }
}

module.exports = { ModUpdater, compareVersions, versionOf }