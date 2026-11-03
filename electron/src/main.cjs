const { app, BaseWindow, BrowserWindow, Menu, Tray, WebContentsView, desktopCapturer, ipcMain, nativeImage, session, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { MediaBridge } = require('./media.cjs')
const { ModUpdater } = require('./updater.cjs')

const HOME = 'https://fenrid.com/channels/me'
const ROOT = path.join(__dirname, '..')
const ICON = path.join(ROOT, 'assets', 'icon.png')
const TRAY_ICON = path.join(ROOT, 'assets', 'tray.png')
const DEV = !app.isPackaged || process.argv.includes('--dev')

const INTERNAL_HOSTS = [/^(.+\.)?fenrid\.com$/, /^challenges\.cloudflare\.com$/]
const ALLOWED_PERMISSIONS = new Set([
  'media',
  'notifications',
  'clipboard-read',
  'clipboard-sanitized-write',
  'fullscreen',
  'display-capture',
  'pointerLock',
  'speaker-selection',
  'idle-detection',
])

app.setAppUserModelId('com.impulsedoes.betterfenrid')

app.commandLine.appendSwitch('disable-features', [
  'HardwareMediaKeyHandling',
  'MediaRouter',
  'SpareRendererForSitePerProcess',
  'AutofillServerCommunication',
].join(','))

if (!app.requestSingleInstanceLock()) {

  app.quit()
  process.exit(0)

}

/** @type {BaseWindow | null} */
let win = null
/** @type {WebContentsView | null} */
let view = null
/** @type {Tray | null} */
let tray = null
let quitting = false

const TITLE_BAR_HEIGHT = 32
const OVERLAY_PAGES = /^\/(?:auth|login|register|signup|sign-up|forgot|reset|verify|invite)/
const titleBar = { background: '#141418', foreground: '#b5b6bd', title: 'Better Fenrid', mode: 'docked' }
const INSET_CSS = `
html[data-bf-titlebar="inset"] { height: 100%; overflow: hidden; }
html[data-bf-titlebar="inset"] body.chat-active {
  top: ${TITLE_BAR_HEIGHT}px !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  height: auto !important;
  max-height: none !important;
}
html[data-bf-titlebar="inset"] body:not(.chat-active) { padding-top: ${TITLE_BAR_HEIGHT}px !important; box-sizing: border-box !important; }
`

function overlayColors() {

  const colors = {
    overlay: { color: '#00000000', symbolColor: '#ffffff' },
    inset: { color: '#00000000', symbolColor: titleBar.foreground },
    docked: { color: titleBar.background, symbolColor: titleBar.foreground },
  }

  return { ...colors[titleBar.mode], height: TITLE_BAR_HEIGHT }
}

function modeFor(url) {

  try {

    const { hostname, pathname } = new URL(url)

    if (hostname !== 'fenrid.com') return 'docked'

    return OVERLAY_PAGES.test(pathname) ? 'overlay' : 'inset'

  } catch {

    return 'docked'

  }
}

let layoutView = () => { }

function setMode(mode) {

  if (titleBar.mode === mode) return

  titleBar.mode = mode

  if (!win || win.isDestroyed()) return

  layoutView()
  win.setTitleBarOverlay(overlayColors())
}

const COLOR = /^(#[0-9a-f]{6}|#[0-9a-f]{8})$/i

function setTitleBarColors(colors) {

  if (!colors || !COLOR.test(colors.background) || !COLOR.test(colors.foreground)) return
  if (colors.background === titleBar.background && colors.foreground === titleBar.foreground) return

  titleBar.background = colors.background.slice(0, 7)
  titleBar.foreground = colors.foreground.slice(0, 7)

  if (!win || win.isDestroyed()) return

  win.setBackgroundColor(titleBar.background)
  win.setTitleBarOverlay(overlayColors())
  layoutView()
}

// ---------- Unread badge ----------

let badgeCount = 0

function setBadge(badge) {

  const count = Number.isSafeInteger(badge?.count) && badge.count > 0 ? badge.count : 0

  if (count === badgeCount && count) return

  badgeCount = count

  const label = count ? `${count} unread` : ''

  tray?.setToolTip(count ? `Better Fenrid (${label})` : 'Better Fenrid')

  if (!win || win.isDestroyed() || process.platform !== 'win32') return

  const image = count && typeof badge.image === 'string' && badge.image.startsWith('data:image/png;base64,')
    ? nativeImage.createFromDataURL(badge.image)
    : null

  win.setOverlayIcon(image && !image.isEmpty() ? image : null, label)
  stopTaskbarFlash()
}

function stopTaskbarFlash() {

  if (!win || win.isDestroyed() || process.platform !== 'win32') return

  win.flashFrame(false)
}

let flashGuard = null

function guardTaskbarFlash() {

  stopTaskbarFlash()

  if (process.platform !== 'win32' || flashGuard) return

  flashGuard = setInterval(stopTaskbarFlash, 50)
}

function releaseTaskbarFlash() {

  if (flashGuard) {

    clearInterval(flashGuard)
    flashGuard = null

  }

  stopTaskbarFlash()
}

const media = new MediaBridge()
const mediaSubscriptions = new Map()

function storePath(name) {

  return path.join(app.getPath('userData'), name)
}

function readJson(name, fallback) {

  try {

    return { ...fallback, ...JSON.parse(fs.readFileSync(storePath(name), 'utf8')) }

  } catch {

    return { ...fallback }

  }
}

function writeJson(name, value) {

  try {

    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    fs.writeFileSync(storePath(name), JSON.stringify(value, null, 2))

  } catch (err) {

    console.error(`Could not save ${name}`, err)

  }
}

const config = readJson('config.json', { closeToTray: true, startHidden: false, autoUpdate: true })

function setConfig(key, value) {

  config[key] = value
  writeJson('config.json', config)
}

const LOCAL_MOD = process.env.BF_MOD_PATH || (app.isPackaged ? null : path.join(ROOT, '..', 'dist', 'betterfenrid.js'))

const updater = new ModUpdater({

  cacheFile: storePath('betterfenrid.js'),
  bundledFile: app.isPackaged ? path.join(process.resourcesPath, 'betterfenrid.js') : null,
  onReady: (version) => {

    if (view && !view.webContents.isDestroyed()) view.webContents.send('bf:mod-update', { version })

    refreshTray()
  },
})

function findMod() {

  return LOCAL_MOD && fs.existsSync(LOCAL_MOD) ? LOCAL_MOD : null
}

function readMod() {

  if (LOCAL_MOD) {

    try {

      return fs.readFileSync(LOCAL_MOD, 'utf8')

    } catch (err) {

      console.error('Could not read the mod', err)
      return null

    }
  }

  return updater.load()?.code ?? null
}

// helpers

function isInternal(url) {

  try {

    const { protocol, hostname } = new URL(url)

    return protocol === 'https:' && INTERNAL_HOSTS.some((host) => host.test(hostname))

  } catch {

    return false

  }
}

function openExternal(url) {

  try {

    const { protocol } = new URL(url)

    if (['http:', 'https:', 'mailto:'].includes(protocol)) shell.openExternal(url)

  } catch { }
}

function showWindow() {

  if (!win) return createWindow()

  if (win.isMinimized()) win.restore()

  win.show()
  win.focus()
}

// WINDOW(s) HAHAHAHHAH

function createWindow() {

  const saved = readJson('window.json', { width: 1280, height: 800, maximized: false })

  win = new BaseWindow({
    x: saved.x,
    y: saved.y,
    width: saved.width,
    height: saved.height,
    minWidth: 940,
    minHeight: 520,
    show: false,
    title: 'Better Fenrid',
    icon: ICON,
    backgroundColor: titleBar.background,
    titleBarStyle: 'hidden',
    titleBarOverlay: overlayColors(),
  })

  view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      partition: 'persist:fenrid',
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
  })

  view.setBackgroundColor(titleBar.background)
  win.contentView.addChildView(view)

  const layout = () => {

    if (!win || win.isDestroyed() || !view) return

    const [width, height] = win.getContentSize()
    const full = win.isFullScreen()
    const top = full || titleBar.mode !== 'docked' ? 0 : TITLE_BAR_HEIGHT

    view.setBounds({ x: 0, y: top, width, height: height - top })
    view.webContents.send('bf:titlebar:float', { mode: full ? 'none' : titleBar.mode, height: TITLE_BAR_HEIGHT, foreground: titleBar.foreground })
  }

  layoutView = layout

  for (const event of ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) win.on(event, layout)

  layout()

  if (saved.maximized) win.maximize()

  let shown = false
  const reveal = () => {

    if (shown || !win || win.isDestroyed()) return

    shown = true

    if (!(config.startHidden && process.argv.includes('--hidden'))) win.show()

  }

  view.webContents.once('dom-ready', reveal)
  setTimeout(reveal, 3000)

  win.on('focus', () => {

    releaseTaskbarFlash()
    view?.webContents.focus()

  })

  win.on('blur', guardTaskbarFlash)
  win.on('minimize', guardTaskbarFlash)

  let saveTimer = null
  const saveBounds = () => {

    clearTimeout(saveTimer)

    saveTimer = setTimeout(() => {

      if (!win || win.isDestroyed() || win.isMinimized()) return

      writeJson('window.json', { ...(win.isMaximized() ? readJson('window.json', {}) : win.getNormalBounds()), maximized: win.isMaximized() })

    }, 400)
  }

  for (const event of ['resize', 'move', 'maximize', 'unmaximize']) win.on(event, saveBounds)

  win.on('close', (event) => {

    if (quitting || !config.closeToTray || !tray) return

    event.preventDefault()
    win.hide()
  })

  win.on('closed', () => {

    releaseTaskbarFlash()
    win = null
    view = null
  })

  const { webContents } = view

  // Float the title bar over full-page backgrounds, dock it inside the app
  const followPage = (url) => setMode(modeFor(url))

  webContents.on('did-navigate', (_event, url) => followPage(url))
  webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => isMainFrame && followPage(url))
  webContents.on('dom-ready', () => {

    webContents.insertCSS(INSET_CSS).catch(() => { })
    layout()

  })

  // Videos and streams going full screen take the whole window, title bar included
  webContents.on('enter-html-full-screen', () => win?.setFullScreen(true))
  webContents.on('leave-html-full-screen', () => win?.setFullScreen(false))
  webContents.setWindowOpenHandler(({ url }) => {

    if (isInternal(url) && new URL(url).hostname === 'fenrid.com') webContents.loadURL(url)
    else openExternal(url)

    return { action: 'deny' }
  })

  webContents.on('will-navigate', (event, url) => {

    if (isInternal(url)) return

    event.preventDefault()
    openExternal(url)
  })

  webContents.on('before-input-event', (event, input) => {

    if (input.type !== 'keyDown') return

    const key = input.key.toLowerCase()
    const ctrl = input.control || input.meta

    const actions = {
      fullScreen: () => win?.setFullScreen(!win.isFullScreen()),
      devtools: () => webContents.toggleDevTools(),
      reload: () => webContents.reload(),
      hardReload: () => webContents.reloadIgnoringCache(),
      zoomIn: () => webContents.setZoomLevel(Math.min(webContents.getZoomLevel() + 0.5, 5)),
      zoomOut: () => webContents.setZoomLevel(Math.max(webContents.getZoomLevel() - 0.5, -5)),
      zoomReset: () => webContents.setZoomLevel(0),
      back: () => webContents.navigationHistory.canGoBack() && webContents.navigationHistory.goBack(),
      forward: () => webContents.navigationHistory.canGoForward() && webContents.navigationHistory.goForward(),
    }

    let action = null

    if (key === 'f11') action = 'fullScreen'
    else if ((ctrl && input.shift && key === 'i') || key === 'f12') action = 'devtools'
    else if (ctrl && input.shift && key === 'r') action = 'hardReload'
    else if ((ctrl && key === 'r') || key === 'f5') action = 'reload'
    else if (ctrl && (key === '=' || key === '+')) action = 'zoomIn'
    else if (ctrl && key === '-') action = 'zoomOut'
    else if (ctrl && key === '0') action = 'zoomReset'
    else if (input.alt && key === 'arrowleft') action = 'back'
    else if (input.alt && key === 'arrowright') action = 'forward'

    if (!action) return

    event.preventDefault()
    actions[action]()
  })

  webContents.on('context-menu', (_event, params) => {

    if (!params.isEditable && !params.misspelledWord) return

    const items = params.dictionarySuggestions.slice(0, 5).map((word) => ({ label: word, click: () => webContents.replaceMisspelling(word) }))

    if (params.misspelledWord) {

      items.push({ label: 'Add to dictionary', click: () => webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord) })
      items.push({ type: 'separator' })

    }

    items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' }, { role: 'selectAll' })

    Menu.buildFromTemplate(items).popup({ window: win })
  })

  webContents.on('page-title-updated', (event, title) => {

    event.preventDefault()
    titleBar.title = title
    win?.setTitle(title)
    stopTaskbarFlash()

  })

  webContents.loadURL(HOME)

  return win
}

let picking = false

async function pickSource() {

  if (picking) return null

  picking = true

  try {

    return await showPicker()

  } finally {

    picking = false

  }
}

async function showPicker() {

  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: true })

  if (!sources.length) return null

  const picker = new BrowserWindow({
    parent: win ?? undefined,
    modal: true,
    width: 760,
    height: 560,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Share your screen',
    icon: ICON,
    backgroundColor: '#1b1b20',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'picker-preload.cjs'), contextIsolation: true, sandbox: true },
  })

  const list = sources.map((source) => ({
    id: source.id,
    name: source.name,
    kind: source.id.startsWith('screen:') ? 'screen' : 'window',
    thumbnail: source.thumbnail.toDataURL(),
    icon: source.appIcon?.toDataURL() ?? null,
  }))

  return new Promise((resolve) => {

    let done = false

    const finish = (result) => {

      if (done) return

      done = true
      ipcMain.removeHandler('bf:picker:sources')
      ipcMain.removeAllListeners('bf:picker:choose')
      if (!picker.isDestroyed()) picker.close()
      resolve(result)
    }

    ipcMain.handle('bf:picker:sources', () => list)

    ipcMain.on('bf:picker:choose', (_event, choice) => {

      const source = choice && sources.find((s) => s.id === choice.id)

      finish(source ? { source, audio: Boolean(choice.audio) } : null)
    })

    picker.on('closed', () => finish(null))
    picker.once('ready-to-show', () => picker.show())
    picker.loadFile(path.join(__dirname, 'picker.html'))
  })
}

function setUpSession() {

  const ses = session.fromPartition('persist:fenrid')

  ses.setUserAgent(ses.getUserAgent().replace(/\s(Electron|BetterFenrid|better-fenrid-desktop|Better Fenrid)\/\S+/g, ''))

  ses.setPermissionRequestHandler((webContents, permission, callback) => {

    callback(isInternal(webContents.getURL()) && ALLOWED_PERMISSIONS.has(permission))

  })

  ses.setPermissionCheckHandler((_webContents, permission, origin) => isInternal(origin) && ALLOWED_PERMISSIONS.has(permission))

  ses.setDisplayMediaRequestHandler(async (_request, callback) => {

    try {

      const choice = await pickSource()

      if (!choice) return callback({})

      // Loopback grabs the whole system's sound, which only works on Windows
      callback(choice.audio && process.platform === 'win32' ? { video: choice.source, audio: 'loopback' } : { video: choice.source })

    } catch (err) {

      console.error('Screen share failed', err)
      callback({})

    }
  })
}

function setUpIpc() {

  ipcMain.on('bf:info', (event) => {

    event.returnValue = { version: app.getVersion(), icon: nativeImage.createFromPath(TRAY_ICON).resize({ width: 64, height: 64 }).toDataURL() }

  })

  ipcMain.on('bf:mod', (event) => {

    event.returnValue = isInternal(event.sender.getURL()) ? readMod() : null

  })

  ipcMain.on('bf:open-external', (_event, url) => openExternal(url))

  ipcMain.on('bf:badge', (event, badge) => {

    if (!view || event.sender !== view.webContents) return

    setBadge(badge)
  })

  ipcMain.on('bf:stop-flash', (event) => {

    if (!view || event.sender !== view.webContents) return

    stopTaskbarFlash()
  })

  ipcMain.handle('bf:mod-check', async (event) => {

    if (!isInternal(event.sender.getURL())) return { status: 'error', error: 'Not allowed' }
    if (LOCAL_MOD) return { status: 'local' }

    return updater.check()
  })

  ipcMain.on('bf:titlebar:colors', (event, colors) => {

    if (view && event.sender === view.webContents) setTitleBarColors(colors)

  })

  ipcMain.on('bf:media:subscribe', (event, id) => {

    const { sender } = event
    const key = `${sender.id}:${id}`

    if (mediaSubscriptions.has(key) || !isInternal(sender.getURL())) return

    const unsubscribe = media.subscribe((message) => {

      if (!sender.isDestroyed()) sender.send(`bf:media:${id}`, message)

    })

    mediaSubscriptions.set(key, unsubscribe)

    const onNavigate = (_e, _url, isInPlace, isMainFrame) => {

      if (isMainFrame && !isInPlace) cleanup()

    }

    const cleanup = () => {

      mediaSubscriptions.get(key)?.()
      mediaSubscriptions.delete(key)
      sender.removeListener('did-start-navigation', onNavigate)
      sender.removeListener('destroyed', cleanup)

    }

    sender.on('destroyed', cleanup)
    sender.on('did-start-navigation', onNavigate)
  })

  ipcMain.on('bf:media:unsubscribe', (event, id) => {

    const key = `${event.sender.id}:${id}`

    mediaSubscriptions.get(key)?.()
    mediaSubscriptions.delete(key)
  })

  ipcMain.on('bf:media:command', (_event, line) => media.command(line))
}

let refreshTray = () => { }

function createTray() {

  tray = new Tray(nativeImage.createFromPath(TRAY_ICON).resize({ width: 32, height: 32 }))
  tray.setToolTip('Better Fenrid')

  const build = () => Menu.buildFromTemplate([
    { label: 'Open Better Fenrid', click: showWindow },
    ...(updater.pending ? [{ label: `Reload to update the mod (v${updater.pending})`, click: () => view?.webContents.reload() }] : []),
    { type: 'separator' },
    { label: 'Close to tray', type: 'checkbox', checked: config.closeToTray, click: (item) => setConfig('closeToTray', item.checked) },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }),
    },
    {
      label: 'Update the mod automatically',
      type: 'checkbox',
      checked: config.autoUpdate,
      enabled: !LOCAL_MOD,
      click: (item) => {

        setConfig('autoUpdate', item.checked)

        if (item.checked) updater.start()
        else updater.stop()

      },
    },
    { type: 'separator' },
    { label: 'Reload', click: () => view?.webContents.reload() },
    { label: 'Open data folder', click: () => shell.openPath(app.getPath('userData')) },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit() } },
  ])

  refreshTray = () => tray?.setContextMenu(build())

  refreshTray()
  tray.on('click', showWindow)
  tray.on('right-click', refreshTray)
}

function watchMod() {

  const file = findMod()

  if (!file) return

  let timer = null

  fs.watch(path.dirname(file), (_event, name) => {

    if (name !== path.basename(file)) return

    clearTimeout(timer)
    timer = setTimeout(() => view?.webContents.reload(), 300)
  })

  console.log(`Watching ${file}`)
}

// starup

Menu.setApplicationMenu(null)

app.on('second-instance', showWindow)

app.on('before-quit', () => {

  quitting = true
  media.stop()
})

app.on('window-all-closed', () => {

  if (process.platform !== 'darwin') app.quit()

})

app.whenReady().then(() => {

  setUpSession()
  setUpIpc()
  createTray()
  createWindow()

  if (DEV) watchMod()
  if (!LOCAL_MOD && config.autoUpdate) updater.start()

  app.on('activate', showWindow)
})