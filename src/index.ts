import { installNetworkHooks } from './api/network'
import { startObserver } from './core/dom'
import { startEntityCache } from './core/entities'
import { createLogger } from './core/logger'
import { registerPlugins, syncPlugins } from './core/plugins'
import { settings } from './core/settings'
import { createStyle } from './core/styles'
import { startThemes } from './core/theme'
import { NAME, VERSION } from './meta'
import { plugins } from './plugins'
import { startSettingsInjection } from './ui/settingsSidebar'
import css from './ui/styles.css'

const log = createLogger()

function startUi() {

  startObserver()
  startSettingsInjection()
}

// Runs before Fenrid's scripts, to catch its connections and avoid a flash of the stock theme
function init() {

  installNetworkHooks()
  startEntityCache()

  createStyle(css)
  startThemes()

  registerPlugins(plugins)
  syncPlugins()

  if (document.body) startUi()
  else document.addEventListener('DOMContentLoaded', startUi, { once: true })

  window.BetterFenrid = { version: VERSION, settings }

  log.info(`${NAME} v${VERSION} loaded`)
}

// The bundle can be injected more than once (e.g. by two userscript managers at once)
if (!window.BetterFenrid) init()