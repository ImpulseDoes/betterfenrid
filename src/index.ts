import { installNetworkHooks } from './api/network'
import { startTopics } from './api/topics'
import { startObserver } from './core/dom'
import { startEntityCache } from './core/entities'
import { createLogger } from './core/logger'
import { installModuleHooks, moduleStatus } from './core/modules'
import { registerPlugins, syncPlugins } from './core/plugins'
import { settings } from './core/settings'
import { createStyle } from './core/styles'
import { startFonts } from './core/fonts'
import { startSounds } from './core/sounds'
import { startThemes } from './core/theme'
import { showUpdateNotice, watchAppUpdates } from './core/updates'
import { NAME, VERSION } from './meta'
import { plugins } from './plugins'
import { startSettingsInjection } from './ui/settingsSidebar'
import css from './ui/styles.css'

const log = createLogger()

function startUi() {

  startObserver()
  startSettingsInjection()
  showUpdateNotice()
  watchAppUpdates()
}

// Runs before Fenrid's scripts, to catch its connections and avoid a flash of the stock theme
function init() {

  installModuleHooks()
  installNetworkHooks()
  startTopics()
  startEntityCache()

  createStyle(css)
  startThemes()
  startFonts()
  startSounds()

  registerPlugins(plugins)
  syncPlugins()

  if (document.body) startUi()
  else document.addEventListener('DOMContentLoaded', startUi, { once: true })

  window.BetterFenrid = { version: VERSION, settings, modules: moduleStatus }

  log.info(`${NAME} v${VERSION} loaded`)
}

// The bundle can be injected more than once (e.g. by two userscript managers at once)
if (!window.BetterFenrid) init()