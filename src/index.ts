import { startObserver } from './core/dom'
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

function init() {

  createStyle(css)
  startObserver()
  startThemes()
  startSettingsInjection()

  registerPlugins(plugins)
  syncPlugins()

  window.BetterFenrid = { version: VERSION, settings }

  log.info(`${NAME} v${VERSION} loaded`)
}

// The bundle can be injected more than once (e.g. by two userscript managers at once)
if (!window.BetterFenrid) {

  if (document.body) init()
  else document.addEventListener('DOMContentLoaded', init, { once: true })

}