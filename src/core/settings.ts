const STORAGE_KEY = 'BetterFenrid:settings'

export interface CoreSettings {
  debug: boolean
  showFooterVersion: boolean
  updateNotices: boolean
  lastCommit: string | null
  font: string
}

export interface ThemeSettings {
  preset: string
  enabled: boolean
  css: string
}

export interface PluginState {
  enabled: boolean
  settings: Record<string, unknown>
}

export interface Settings {
  core: CoreSettings
  theme: ThemeSettings
  plugins: Record<string, PluginState>
}

const DEFAULTS: Settings = {
  core: { debug: false, showFooterVersion: true, updateNotices: true, lastCommit: null, font: '' },
  theme: { preset: 'onyx', enabled: true, css: '' },
  plugins: {},
}

type Listener = (s: Settings) => void

function normalize(raw: Partial<Settings> | null | undefined): Settings {

  return {
    core: { ...DEFAULTS.core, ...raw?.core },
    theme: { ...DEFAULTS.theme, ...raw?.theme },
    plugins: raw?.plugins && typeof raw.plugins === 'object' ? raw.plugins : {},
  }
}

function load(): Settings {
  try {

    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))

  } catch {

    return normalize(null)

  }
}

class SettingsStore {

  private state = load()
  private listeners = new Set<Listener>()

  get(): Settings {
    return this.state
  }

  update(fn: (s: Settings) => void) {

    fn(this.state)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))

    for (const l of this.listeners) l(this.state)
  }

  subscribe(l: Listener): () => void {

    this.listeners.add(l)

    return () => this.listeners.delete(l)
  }

  export(): string {

    return JSON.stringify(this.state, null, 2)

  }

  import(json: string) {

    const parsed = JSON.parse(json)

    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid settings file')

    const next = normalize(parsed)

    this.update((s) => Object.assign(s, next))
  }

  reset() {
    this.update((s) => Object.assign(s, normalize(null)))
  }
}

export const settings = new SettingsStore()