const { spawn } = require('node:child_process')
const path = require('node:path')
const readline = require('node:readline')
const HELPER = path.join(__dirname, 'media', 'media-helper.exe').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')

class MediaBridge {

  constructor() {

    this.listeners = new Set()
    this.child = null
    this.state = null
    this.art = null
    this.anyPlayer = false
    this.restarts = 0
    this.restartTimer = null
  }

  subscribe(listener) {

    this.listeners.add(listener)

    if (this.state) listener(this.state)
    if (this.art) listener(this.art)

    this.start()

    return () => {

      this.listeners.delete(listener)

      if (!this.listeners.size) this.stop()

    }
  }

  command(line) {

    if (typeof line !== 'string' || !/^(toggle|play|pause|next|prev|refresh|seek \d+|shuffle [01]|repeat [0-2]|any [01])$/.test(line)) return

    if (line.startsWith('any ')) this.anyPlayer = line === 'any 1'

    this.child?.stdin.write(`${line}\n`)
  }

  emit(message) {

    for (const listener of this.listeners) {

      try {

        listener(message)

      } catch (err) {

        console.error('[media] listener failed', err)

      }
    }
  }

  start() {

    if (this.child || process.platform !== 'win32' || !this.listeners.size) return

    clearTimeout(this.restartTimer)

    const child = spawn(HELPER, [String(process.pid)], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this.child = child

    readline.createInterface({ input: child.stdout }).on('line', (line) => {

      let message

      try {

        message = JSON.parse(line)

      } catch {

        return

      }

      if (message.type === 'ready') {

        this.restarts = 0
        if (this.anyPlayer) child.stdin.write('any 1\n')
        return

      }

      if (message.type === 'error') return console.warn('[media]', message.message)
      if (message.type === 'state') this.state = message
      if (message.type === 'art') this.art = message

      this.emit(message)
    })

    child.stderr.on('data', (data) => console.warn('[media]', String(data).trim()))
    child.stdin.on('error', () => { })

    child.on('exit', () => {

      if (this.child !== child) return

      this.child = null

      if (!this.listeners.size) return

      // Back off if PowerShell keeps dying, but keep trying
      const delay = Math.min(30_000, 1000 * 2 ** this.restarts++)

      this.restartTimer = setTimeout(() => this.start(), delay)
    })
  }

  stop() {

    clearTimeout(this.restartTimer)

    const child = this.child

    this.child = null
    this.state = null
    this.art = null

    if (child) {

      child.stdin.end()
      setTimeout(() => child.kill(), 1000).unref()

    }
  }
}

module.exports = { MediaBridge }