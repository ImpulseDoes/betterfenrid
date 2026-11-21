import { extractText } from '../api/contextMenu'
import { openModal } from '../api/modal'
import { injectGatewayEvent, isGatewaySeen, onApiRequest, onApiResponse, onApiResult, onGatewayFrame, onGatewaySend } from '../api/network'
import { currentUserId } from '../api/profiles'
import { toast } from '../api/toast'
import { Button } from '../ui/components'
import { h } from './dom'
import { getChannel, getMessage, getUser, onMessageEdit } from './entities'
import { createLogger } from './logger'
import { allowPlugin, type BlockedPlugin, dismissPlugin, isDismissed, onPluginBlocked } from './pluginGate'
import { Selectors } from './selectors'
import { hasPlugin, isEnabled, registerPlugins, startPlugin, type Plugin, type SettingDef } from './plugins'

export interface CustomPluginFile {
  file: string
  id?: string
  error?: string
}

const log = createLogger('Custom plugins')
const files = new Map<string, CustomPluginFile>()
const ID = /^[A-Za-z][\w.-]{0,63}$/
const DEFAULT_TYPE: Record<SettingDef['type'], string> = { boolean: 'boolean', string: 'string', number: 'number', select: 'string' }

export const customPluginFiles = () => [...files.values()].sort((a, b) => a.file.localeCompare(b.file))

function fail(file: string, error: string) {

  log.error(`${file}: ${error}`)
  files.set(file, { ...files.get(file), file, error })
}

function checkSettings(settings: unknown): string | null {

  if (settings === undefined) return null
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return 'settings must be an object'

  for (const [key, def] of Object.entries(settings as Record<string, any>)) {

    if (!def || !(def.type in DEFAULT_TYPE)) return `setting "${key}" needs a type: boolean, string, number or select`
    if (typeof def.label !== 'string') return `setting "${key}" needs a label`
    if (typeof def.default !== DEFAULT_TYPE[def.type as SettingDef['type']]) return `setting "${key}" needs a ${DEFAULT_TYPE[def.type as SettingDef['type']]} default`
    if (def.type === 'select' && !(Array.isArray(def.options) && def.options.every((o: any) => typeof o?.label === 'string' && typeof o?.value === 'string'))) {
      return `setting "${key}" needs options: [{ label, value }]`
    }
  }

  return null
}

export function addCustomPlugin(raw: unknown, file: string) {

  const known = files.get(file)

  // Both definePlugin() and module.exports in one file
  if (known?.id && (raw as any)?.id === known.id) return

  const p = raw as Record<string, any>

  if (!p || typeof p !== 'object') return fail(file, 'definePlugin() needs an object')
  if (typeof p.id !== 'string' || !ID.test(p.id)) return fail(file, 'id must start with a letter and use only letters, digits, ".", "_" or "-"')
  if (typeof p.name !== 'string' || !p.name.trim()) return fail(file, 'name is missing')
  if (typeof p.start !== 'function') return fail(file, 'start(ctx) is missing')
  if (hasPlugin(p.id)) return fail(file, `the id "${p.id}" is already taken`)

  const settingsError = checkSettings(p.settings)

  if (settingsError) return fail(file, settingsError)

  const plugin: Plugin = {
    id: p.id,
    name: p.name.trim(),
    description: typeof p.description === 'string' ? p.description : '',
    authors: Array.isArray(p.authors) ? p.authors.map(String) : typeof p.authors === 'string' ? [p.authors] : [],
    enabledByDefault: p.enabledByDefault === true,
    settings: p.settings,
    panel: typeof p.panel === 'function' ? p.panel : undefined,
    start: p.start,
    source: file,
  }

  registerPlugins([plugin])
  files.set(file, { file, id: plugin.id })
  log.info(`Loaded ${plugin.name} from ${file}`)

  // Before the page exists, syncPlugins() starts it with the rest
  if (document.documentElement && isEnabled(plugin.id)) startPlugin(plugin.id)
}

export function reportCustomPluginError(file: string, error: unknown) {

  fail(String(file), String(error))
}

// What a plugin file can reach through BetterFenrid.api
export const customPluginApi = {
  h,
  Button,
  toast,
  openModal,
  extractText,
  createLogger,
  Selectors,
  currentUserId,
  getMessage,
  getChannel,
  getUser,
  onMessageEdit,
  onGatewayFrame,
  onGatewaySend,
  onApiRequest,
  onApiResult,
  onApiResponse,
  injectGatewayEvent,
  isGatewaySeen,
  shared: {} as Record<string, unknown>,
}

const queue: BlockedPlugin[] = []
let showing = false

export function reviewBlockedPlugin(plugin: BlockedPlugin, onClose?: () => void) {

  const findings = h('ul', { class: 'bf-plugin-findings' }, ...plugin.findings.map((f) => h('li', {}, f)))

  const close = openModal({
    title: `Allow ${plugin.file}?`,
    body: h(
      'div',
      { class: 'bf-plugin-gate' },
      h(
        'p',
        {},
        plugin.changed
          ? 'This plugin changed since you allowed it, and the new version does things plugins use to steal accounts. Better Fenrid did not run it.'
          : 'This plugin does things plugins use to steal accounts, so Better Fenrid did not run it. It may be harmless, but only allow it if you trust whoever made it.',
      ),
      findings,
      h('p', { class: 'bf-plugin-gate-note' }, 'Plugins run with full access to your Fenrid account. Allowing it covers this exact version of the file. If it changes, you will be asked again.'),
    ),
    footer: [
      Button('Keep it off', () => {

        dismissPlugin(plugin)
        close()

      }, 'secondary'),
      Button('Allow and reload', () => {

        allowPlugin(plugin)
        location.reload()

      }, 'danger'),
    ],
  })

  const watch = new MutationObserver(() => {

    if (findings.isConnected) return

    watch.disconnect()
    onClose?.()

  })

  watch.observe(document.body, { childList: true })
}

function showNext() {

  const plugin = queue.shift()

  if (!plugin) {

    showing = false
    return

  }

  showing = true
  reviewBlockedPlugin(plugin, showNext)
}

export function startPluginGate() {

  onPluginBlocked((plugin) => {

    fail(plugin.file, 'blocked until you allow it, see Settings > Plugins')

    if (isDismissed(plugin)) return

    queue.push(plugin)

    if (showing) return

    if (document.body) showNext()
    else document.addEventListener('DOMContentLoaded', showNext, { once: true })
  })
}