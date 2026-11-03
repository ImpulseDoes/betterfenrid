const { contextBridge, ipcRenderer, webFrame } = require('electron')

let canvas = null

function paint(color, base) {

  canvas ??= document.createElement('canvas')
  canvas.width = canvas.height = 1

  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  ctx.clearRect(0, 0, 1, 1)

  if (base) {

    ctx.fillStyle = base
    ctx.fillRect(0, 0, 1, 1)

  }

  ctx.fillStyle = 'transparent'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)

  return ctx.getImageData(0, 0, 1, 1).data
}

const hex = (rgb) => `#${rgb.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`

const rgbOf = (color) => Array.from(paint(color, '#000').slice(0, 3))

function isSeeThrough(color) {

  return !color || paint(color)[3] < 128
}

function solidBackground(el) {

  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {

    const color = getComputedStyle(node).backgroundColor

    if (!isSeeThrough(color)) return color

  }

  return null
}

function readColors() {

  const root = getComputedStyle(document.documentElement)
  const rail = document.querySelector('.bg-server-sidebar')
  const hit = document.elementFromPoint(Math.round(innerWidth / 2), 1)
  const top = rail ?? (hit && !hit.closest('[data-bf-titlebar]') ? hit : document.body)
  const background = root.getPropertyValue('--bf-titlebar-bg').trim() || (top && solidBackground(top))
  const foreground = root.getPropertyValue('--bf-titlebar-fg').trim() || (top && getComputedStyle(top).color)

  if (!background || !foreground) return null

  const back = rgbOf(background)
  const front = rgbOf(foreground)

  return { background: hex(back), foreground: hex(front.map((n, i) => n * 0.72 + back[i] * 0.28)) }
}

function floatingTitleBar(icon) {

  const bar = document.createElement('div')
  const logo = document.createElement('img')
  const name = document.createElement('span')

  bar.setAttribute('aria-hidden', 'true')
  bar.dataset.bfTitlebar = ''

  Object.assign(bar.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '138px',
    height: '32px',
    display: 'none',
    alignItems: 'center',
    gap: '10px',
    padding: '0 14px',
    zIndex: '2147483647',
    color: '#fff',
    font: "600 14px/1 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif",
    letterSpacing: '0.01em',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.35)',
    userSelect: 'none',
    boxSizing: 'border-box',
  })

  bar.style.setProperty('-webkit-app-region', 'drag')

  Object.assign(logo.style, { width: '20px', height: '20px', borderRadius: '5px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' })
  logo.src = icon
  logo.alt = ''
  logo.draggable = false

  name.textContent = 'Better Fenrid'

  bar.append(logo, name)

  let floating = false

  // Fenrid may rebuild <body>, so keep the bar on <html> and put it back if it goes missing
  const mount = () => {

    if (!bar.isConnected) document.documentElement?.append(bar)

  }

  ipcRenderer.on('bf:titlebar:float', (_event, state) => {

    floating = Boolean(state?.floating)
    bar.style.height = `${state?.height ?? 32}px`
    bar.style.display = floating ? 'flex' : 'none'

    if (floating) mount()

  })

  setInterval(() => floating && mount(), 1000)
}

function watchTitleBarColors() {

  let last = ''

  const check = () => {

    if (!document.body) return

    try {

      const colors = readColors()
      const key = colors && `${colors.background}${colors.foreground}`

      if (key && key !== last) {

        last = key
        ipcRenderer.send('bf:titlebar:colors', colors)

      }

    } catch { }
  }

  // Themes swap stylesheets without any event to listen for, so just look now and then
  document.addEventListener('DOMContentLoaded', check, { once: true })
  window.addEventListener('load', check, { once: true })
  setInterval(check, 1000)
}

if (location.hostname === 'fenrid.com') {

  const info = ipcRenderer.sendSync('bf:info')

  contextBridge.exposeInMainWorld('BetterFenridNative', {
    version: info.version,
    platform: process.platform,

    media: {
      // Returns a function that stops listening
      subscribe(listener) {

        if (typeof listener !== 'function') throw new TypeError('listener must be a function')

        const handler = (_event, message) => listener(message)
        const id = Math.random().toString(36).slice(2)

        ipcRenderer.on(`bf:media:${id}`, handler)
        ipcRenderer.send('bf:media:subscribe', id)

        return () => {

          ipcRenderer.removeListener(`bf:media:${id}`, handler)
          ipcRenderer.send('bf:media:unsubscribe', id)

        }
      },

      command(line) {

        ipcRenderer.send('bf:media:command', String(line))

      },
    },

    openExternal(url) {

      ipcRenderer.send('bf:open-external', String(url))

    },

    updates: {
      check: () => ipcRenderer.invoke('bf:mod-check'),

      // Called when a new mod build is downloaded and waits for a reload
      onReady(listener) {

        if (typeof listener !== 'function') throw new TypeError('listener must be a function')

        const handler = (_event, update) => listener(update)

        ipcRenderer.on('bf:mod-update', handler)

        return () => ipcRenderer.removeListener('bf:mod-update', handler)
      },
    },
  })

  watchTitleBarColors()
  floatingTitleBar(info.icon)

  // Same as a userscript at document-start, but no extension needed
  const code = ipcRenderer.sendSync('bf:mod')

  if (code) webFrame.executeJavaScript(`${code}\n//# sourceURL=betterfenrid.js`).catch((err) => console.error('[Better Fenrid Desktop] Mod failed to start', err))
  else console.warn('[Better Fenrid Desktop] Mod bundle not found, run "npm run build" in the repo root')
}