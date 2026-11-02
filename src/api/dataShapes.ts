import { onApiResponse, onEveryGatewayFrame } from './network'

const STORAGE_KEY = 'BetterFenrid:dataShapes'
const MAX_DEPTH = 6
const MAX_SOURCES = 500
const MAX_FIELDS = 400
const SAVE_DELAY_MS = 5000
const PRIVATE_AFTER = new Set(['users', 'invites', 'user-memos', 'profile-comments'])
const FIELD = /^[A-Za-z_][A-Za-z0-9_-]{0,40}$/
// Ids: a run of digits, or a long hex string like a UUID. Short ones are real names, like e2ee
const LOOKS_LIKE_ID = /\d{4,}|^[0-9a-f-]{16,}$/i

type Shapes = Record<string, Record<string, string[]>>

let shapes: Shapes = {}
let saveTimer: ReturnType<typeof setTimeout> | null = null

function load() {

  try {

    shapes = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')

  } catch {

    shapes = {}

  }
}

function save() {

  saveTimer = null

  try {

    localStorage.setItem(STORAGE_KEY, JSON.stringify(shapes))

  } catch { }
}

const saveSoon = () => {
  saveTimer ??= setTimeout(save, SAVE_DELAY_MS)
}

export function routeOf(pathname: string): string {

  const parts = pathname.split('/')

  return parts
    .map((part, i) => {

      if (part === 'me') return part
      if (PRIVATE_AFTER.has(parts[i - 1])) return ':id'

      return LOOKS_LIKE_ID.test(part) ? ':id' : part
    })
    .join('/')
}

const fieldName = (key: string) => (FIELD.test(key) && !LOOKS_LIKE_ID.test(key) ? key : ':key')

const typeOf = (value: unknown) => (value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value)

// Only names and types are kept. A value is never read past its type, so no text can end up in a report
function record(source: string, value: unknown) {

  if (!shapes[source] && Object.keys(shapes).length >= MAX_SOURCES) return

  const fields = (shapes[source] ??= {})
  const before = JSON.stringify(fields).length

  const walk = (node: unknown, path: string, depth: number) => {

    if (path && (fields[path] || Object.keys(fields).length < MAX_FIELDS)) {

      const types = (fields[path] ??= [])
      const type = typeOf(node)

      if (!types.includes(type)) types.push(type)
    }

    if (depth >= MAX_DEPTH || !node || typeof node !== 'object') return

    if (Array.isArray(node)) {

      for (const item of node.slice(0, 20)) walk(item, `${path}[]`, depth + 1)

      return
    }

    // Some objects are maps keyed by an id or a name, which isn't a field
    for (const [key, item] of Object.entries(node)) {

      walk(item, path ? `${path}.${fieldName(key)}` : fieldName(key), depth + 1)
    }
  }

  walk(value, '', 0)

  if (JSON.stringify(fields).length !== before) saveSoon()
}

export function startRecording(): () => void {

  load()

  const stopApi = onApiResponse((url, body) => {

    record(`GET ${routeOf(url.pathname)}`, body)
  })

  const stopGateway = onEveryGatewayFrame((frame) => {

    if (frame.t) record(`WS ${frame.t}`, frame.d)
  })

  window.addEventListener('pagehide', save)

  return () => {

    stopApi()
    stopGateway()
    window.removeEventListener('pagehide', save)

    if (saveTimer) clearTimeout(saveTimer)

    saveTimer = null
    save()
  }
}

export function clearRecording() {

  shapes = {}
  localStorage.removeItem(STORAGE_KEY)
}

export function recordedCount(): { sources: number; fields: number } {

  if (!Object.keys(shapes).length) load()

  return { sources: Object.keys(shapes).length, fields: Object.values(shapes).reduce((sum, fields) => sum + Object.keys(fields).length, 0) }
}

function loadedScripts(): string[] {

  return performance.getEntriesByType('resource')
    .map((entry) => new URL(entry.name).pathname)
    .filter((path) => path.startsWith('/_next/static/') && path.endsWith('.js'))
}

export function downloadReport() {

  if (!Object.keys(shapes).length) load()

  const report = JSON.stringify({ page: routeOf(location.pathname), scripts: loadedScripts(), shapes }, null, 2)
  const url = URL.createObjectURL(new Blob([report], { type: 'application/json' }))
  const link = document.createElement('a')

  link.href = url
  link.download = 'better-fenrid-data-report.json'
  link.click()

  setTimeout(() => URL.revokeObjectURL(url), 1000)
}