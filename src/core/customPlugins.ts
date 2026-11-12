import { extractText } from '../api/contextMenu'
import { openModal } from '../api/modal'
import { injectGatewayEvent, isGatewaySeen, onApiRequest, onApiResponse, onApiResult, onGatewayFrame, onGatewaySend } from '../api/network'
import { currentUserId } from '../api/profiles'
import { toast } from '../api/toast'
import { Button } from '../ui/components'
import { h } from './dom'
import { getChannel, getMessage, getUser, onMessageEdit } from './entities'
import { createLogger } from './logger'
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