import { addContextMenuItem, type ContextMenuItem } from '../api/contextMenu'
import { onDomChange } from './dom'
import { createLogger, type Logger } from './logger'
import { settings } from './settings'
import { createStyle, type ManagedStyle } from './styles'

interface BaseSetting<T> {
  label: string
  description?: string
  default: T
}

export interface BooleanSetting extends BaseSetting<boolean> {
  type: 'boolean'
}
export interface StringSetting extends BaseSetting<string> {
  type: 'string'
  placeholder?: string
  multiline?: boolean
}
export interface NumberSetting extends BaseSetting<number> {
  type: 'number'
  min?: number
  max?: number
  step?: number
}
export interface SelectSetting extends BaseSetting<string> {
  type: 'select'
  options: { label: string; value: string }[]
}

export type SettingDef = BooleanSetting | StringSetting | NumberSetting | SelectSetting
export type SettingsSchema = Record<string, SettingDef>
export type SettingsValues<S extends SettingsSchema> = { [K in keyof S]: S[K]['default'] }

export interface PluginContext<S extends SettingsSchema = SettingsSchema> {

  readonly settings: SettingsValues<S>
  setSetting<K extends keyof S>(key: K, value: S[K]['default']): void
  log: Logger
  // Everything registered through these helpers is cleaned up when the plugin stops
  addContextMenuItem(item: ContextMenuItem): void
  addStyle(css: string): ManagedStyle
  onDomChange(handler: (added: Element[]) => void): void
  onSettingsChange(handler: (values: SettingsValues<S>) => void): void
  onStop(fn: () => void): void
}

export interface Plugin<S extends SettingsSchema = SettingsSchema> {
  // Stable id used as the storage key. NEVER rename it after release
  id: string
  name: string
  description: string
  authors: string[]
  enabledByDefault?: boolean
  settings?: S
  // Extra controls shown under the plugin's settings. Available while it's stopped too
  panel?(): Node
  start(ctx: PluginContext<S>): void | (() => void)
}

export function definePlugin<S extends SettingsSchema>(plugin: Plugin<S>): Plugin<S> {
  return plugin
}

const log = createLogger('Plugins')
const registry = new Map<string, Plugin>()
const running = new Map<string, (() => void)[]>()

export function getPlugins(): Plugin[] {

  return [...registry.values()].sort((a, b) => a.name.localeCompare(b.name))

}

export function isEnabled(id: string): boolean {

  const plugin = registry.get(id)
  const state = settings.get().plugins[id]

  return state?.enabled ?? plugin?.enabledByDefault ?? false
}

export function isRunning(id: string): boolean {
  return running.has(id)
}

export function getPluginSetting(plugin: Plugin, key: string): unknown {

  const stored = settings.get().plugins[plugin.id]?.settings?.[key]

  return stored === undefined ? plugin.settings?.[key]?.default : stored
}

export function setPluginSetting(plugin: Plugin, key: string, value: unknown) {
  settings.update((s) => {
    const state = (s.plugins[plugin.id] ??= { enabled: isEnabled(plugin.id), settings: {} })
    state.settings ??= {}
    state.settings[key] = value
  })
}

function makeContext(plugin: Plugin, disposers: (() => void)[]): PluginContext {

  const values = new Proxy({} as SettingsValues<SettingsSchema>, {
    get: (_, key) => (typeof key === 'string' ? getPluginSetting(plugin, key) : undefined),
    ownKeys: () => Object.keys(plugin.settings ?? {}),
    getOwnPropertyDescriptor: (_, key) =>
      typeof key === 'string' && plugin.settings && key in plugin.settings
        ? { enumerable: true, configurable: true, value: getPluginSetting(plugin, key) }
        : undefined,
  })

  return {
    settings: values,
    setSetting: (key, value) => setPluginSetting(plugin, key as string, value),
    log: createLogger(plugin.name),
    addContextMenuItem: (item) => disposers.push(addContextMenuItem({ ...item, id: `${plugin.id}.${item.id}` })),
    addStyle: (css) => {
      const style = createStyle(css)
      disposers.push(() => style.remove())
      return style
    },
    onDomChange: (handler) => disposers.push(onDomChange(handler)),
    onSettingsChange: (handler) => disposers.push(settings.subscribe(() => handler(values))),
    onStop: (fn) => disposers.push(fn),
  }
}

export function startPlugin(id: string) {

  const plugin = registry.get(id)

  if (!plugin || running.has(id)) return

  const disposers: (() => void)[] = []

  running.set(id, disposers)

  try {

    const cleanup = plugin.start(makeContext(plugin, disposers))

    if (typeof cleanup === 'function') disposers.push(cleanup)

    log.debug(`Started ${plugin.name}`)

  } catch (err) {

    log.error(`Failed to start ${plugin.name}`, err)

    stopPlugin(id)
  }
}

export function stopPlugin(id: string) {

  const disposers = running.get(id)

  if (!disposers) return

  running.delete(id)

  for (const dispose of disposers.reverse()) {

    try {

      dispose()

    } catch (err) {

      log.error(`Error while stopping ${id}`, err)

    }
  }

  log.debug(`Stopped ${registry.get(id)?.name ?? id}`)

}

export function setEnabled(id: string, enabled: boolean) {

  settings.update((s) => {

    const state = (s.plugins[id] ??= { enabled, settings: {} })

    state.enabled = enabled
  })

  if (enabled) startPlugin(id)

  else stopPlugin(id)
}

export function registerPlugins(plugins: Plugin<any>[]) {

  for (const plugin of plugins) {

    if (registry.has(plugin.id)) {

      log.warn(`Duplicate plugin id "${plugin.id}", skipping`)
      continue

    }

    registry.set(plugin.id, plugin as Plugin)
  }
}

// Start/stop plugins so they match the saved settings (after import or reset too)
export function syncPlugins() {

  for (const plugin of registry.values()) {

    if (isEnabled(plugin.id)) startPlugin(plugin.id)
    else stopPlugin(plugin.id)

  }
}