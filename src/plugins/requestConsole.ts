import { isGatewaySeen, sendGatewayFrame } from '../api/network'
import { toast } from '../api/toast'
import { h } from '../core/dom'
import { definePlugin, isRunning } from '../core/plugins'
import { Button } from '../ui/components'
import { icon } from '../ui/icons'

const STORAGE_KEY = 'BetterFenrid:requestConsole'
const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const
const MAX_HISTORY = 20

type Kind = 'http' | 'gateway'
type Method = (typeof METHODS)[number]

interface SavedRequest {
  kind: Kind
  method: Method
  url: string
  headers: string
  body: string
}

interface HistoryFile {
  requests: SavedRequest[]
  last: SavedRequest
}

const CSS = `
.bf-req-launch {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 10040;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--bf-border);
  border-radius: 999px;
  background: var(--bf-bg);
  color: var(--bf-text);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.4);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.bf-req-launch:hover { filter: brightness(1.12); }
.bf-req-win {
  position: fixed;
  z-index: 10050;
  display: flex;
  flex-direction: column;
  width: 440px;
  height: 560px;
  min-width: 360px;
  min-height: 360px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
  border: 1px solid var(--bf-border);
  border-radius: 14px;
  background: var(--bf-bg);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  resize: both;
  color: var(--bf-text);
  font-family: inherit;
}
.bf-req-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  padding: 10px 10px 10px 16px;
  border-bottom: 1px solid var(--bf-border);
  cursor: grab;
  user-select: none;
}
.bf-req-head:active { cursor: grabbing; }
.bf-req-title {
  flex: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}
.bf-req-body {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px 14px;
}
.bf-req-tabs, .bf-req-row {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}
.bf-req-tab {
  flex: 1;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  background: transparent;
  color: var(--bf-text-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.bf-req-tab[aria-selected="true"] {
  background: var(--bf-bg-secondary);
  color: var(--bf-text);
}
.bf-req-select, .bf-req-input, .bf-req-area {
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  background: var(--bf-bg-input);
  color: var(--bf-text);
  font: inherit;
}
.bf-req-select {
  flex-shrink: 0;
  width: 108px;
  min-height: 36px;
  padding: 0 8px;
  font-size: 13px;
}
.bf-req-input {
  flex: 1;
  min-width: 0;
  min-height: 36px;
  padding: 0 10px;
  font-size: 13px;
}
.bf-req-area {
  width: 100%;
  min-height: 0;
  padding: 8px 10px;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  resize: none;
  box-sizing: border-box;
}
.bf-req-headers {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 8px;
}
.bf-req-area-body { flex: 1; }
.bf-req-area-headers { height: 64px; flex: none; }
.bf-req-label {
  flex-shrink: 0;
  color: var(--bf-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.bf-req-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}
.bf-req-status {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--bf-text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bf-req-status.ok { color: var(--bf-success); }
.bf-req-status.err { color: var(--bf-danger); }
.bf-req-out {
  flex: 1;
  min-height: 0;
  margin: 0;
  overflow: auto;
  padding: 8px 10px;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  background: var(--bf-bg-input);
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
.bf-req-history {
  flex: 1;
  min-width: 0;
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid var(--bf-border);
  border-radius: 8px;
  background: var(--bf-bg-input);
  color: var(--bf-text);
  font: inherit;
  font-size: 12px;
}
`

const emptyHttp = (): SavedRequest => ({
  kind: 'http',
  method: 'GET',
  url: '/api/',
  headers: '{\n  \n}',
  body: '{\n  \n}',
})

function loadHistory(): HistoryFile {

  try {

    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as HistoryFile

    if (parsed && Array.isArray(parsed.requests)) return parsed

  } catch { }

  return { requests: [], last: emptyHttp() }
}

function saveHistory(file: HistoryFile) {

  try {

    localStorage.setItem(STORAGE_KEY, JSON.stringify(file))

  } catch { }
}

function pretty(value: unknown): string {

  if (typeof value === 'string') return value

  try {

    return JSON.stringify(value, null, 2)

  } catch {

    return String(value)
  }
}

function parseJson(text: string, label: string): { ok: true; value: unknown } | { ok: false } {

  const trimmed = text.trim()

  if (!trimmed) return { ok: true, value: undefined }

  try {

    return { ok: true, value: JSON.parse(trimmed) }

  } catch {

    toast(`${label} is not valid JSON`, 'error')

    return { ok: false }
  }
}

function resolveUrl(input: string): URL | null {

  const trimmed = input.trim()

  if (!trimmed) {

    toast('Enter a path, for example /api/users/@me', 'error')

    return null
  }

  try {

    const url = trimmed.startsWith('/') ? new URL(trimmed, location.origin) : new URL(trimmed)

    if (url.origin !== location.origin) {

      toast('Only Fenrid URLs on this site are allowed', 'error')

      return null
    }

    return url

  } catch {

    toast('That URL is not valid', 'error')

    return null
  }
}

function historyLabel(entry: SavedRequest): string {

  if (entry.kind === 'gateway') return `GW  ${entry.body.replace(/\s+/g, ' ').slice(0, 48)}`

  return `${entry.method}  ${entry.url}`
}

let win: HTMLElement | null = null
let launch: HTMLElement | null = null

function closeWindow() {

  win?.remove()
  win = null
}

function setKindUi(kind: Kind, httpRow: HTMLElement, headersBlock: HTMLElement, url: HTMLInputElement) {

  httpRow.hidden = kind !== 'http'
  headersBlock.hidden = kind !== 'http'
  url.disabled = kind !== 'http'
}

function readForm(
  kind: Kind,
  method: HTMLSelectElement,
  url: HTMLInputElement,
  headers: HTMLTextAreaElement,
  body: HTMLTextAreaElement,
): SavedRequest {

  return {
    kind,
    method: METHODS.includes(method.value as Method) ? method.value as Method : 'GET',
    url: url.value,
    headers: headers.value,
    body: body.value,
  }
}

function writeForm(
  entry: SavedRequest,
  method: HTMLSelectElement,
  url: HTMLInputElement,
  headers: HTMLTextAreaElement,
  body: HTMLTextAreaElement,
) {

  method.value = entry.method
  url.value = entry.url
  headers.value = entry.headers
  body.value = entry.body
}

async function sendHttp(entry: SavedRequest, status: HTMLElement, out: HTMLElement) {

  const url = resolveUrl(entry.url)

  if (!url) return

  const headersJson = parseJson(entry.headers, 'Headers')

  if (!headersJson.ok) return

  const hasBody = entry.method === 'GET' ? { ok: true as const, value: undefined } : parseJson(entry.body, 'Body')

  if (!hasBody.ok) return

  const headers = new Headers({ Accept: 'application/json' })

  if (hasBody.value !== undefined) headers.set('Content-Type', 'application/json')

  if (headersJson.value && typeof headersJson.value === 'object' && !Array.isArray(headersJson.value)) {

    for (const [key, value] of Object.entries(headersJson.value as Record<string, unknown>)) {

      if (value != null) headers.set(key, String(value))

    }
  }

  const started = performance.now()

  status.textContent = 'Sending…'
  status.className = 'bf-req-status'
  out.textContent = ''

  try {

    const response = await fetch(url, {
      method: entry.method,
      credentials: 'include',
      headers,
      body: hasBody.value === undefined ? undefined : JSON.stringify(hasBody.value),
    })

    const ms = Math.round(performance.now() - started)
    const text = await response.text()
    let displayed = text

    try {

      displayed = pretty(JSON.parse(text))

    } catch { }

    status.textContent = `${response.status} ${response.statusText} · ${ms}ms`
    status.className = `bf-req-status ${response.ok ? 'ok' : 'err'}`
    out.textContent = displayed || '(empty)'

  } catch (err) {

    status.textContent = 'Request failed'
    status.className = 'bf-req-status err'
    out.textContent = err instanceof Error ? err.message : String(err)
  }
}

function sendGateway(entry: SavedRequest, status: HTMLElement, out: HTMLElement) {

  if (!isGatewaySeen()) {

    toast('The gateway is not connected yet', 'error')

    return
  }

  const parsed = parseJson(entry.body, 'Gateway JSON')

  if (!parsed.ok) return

  if (!parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value) || !('op' in parsed.value)) {

    toast('Gateway JSON needs an "op" field', 'error')

    return
  }

  const frame = parsed.value as { op: number; d?: unknown }

  if (typeof frame.op !== 'number') {

    toast('"op" must be a number', 'error')

    return
  }

  status.textContent = 'Sending…'
  status.className = 'bf-req-status'
  out.textContent = ''

  const ok = sendGatewayFrame(frame)

  if (!ok) {

    status.textContent = 'Gateway send failed'
    status.className = 'bf-req-status err'
    out.textContent = 'The socket is not open.'

    return
  }

  status.textContent = `Sent op ${frame.op}`
  status.className = 'bf-req-status ok'
  out.textContent = pretty(frame)
}

function remember(file: HistoryFile, entry: SavedRequest): HistoryFile {

  const key = JSON.stringify(entry)
  const requests = [entry, ...file.requests.filter((item) => JSON.stringify(item) !== key)].slice(0, MAX_HISTORY)

  return { requests, last: entry }
}

function fillHistory(select: HTMLSelectElement, file: HistoryFile) {

  select.replaceChildren(
    h('option', { value: '' }, 'History'),
    ...file.requests.map((entry, index) => h('option', { value: String(index) }, historyLabel(entry))),
  )
}

function makeDraggable(handle: HTMLElement, windowEl: HTMLElement) {

  handle.addEventListener('pointerdown', (event) => {

    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('button')) return

    const rect = windowEl.getBoundingClientRect()
    const dx = event.clientX - rect.left
    const dy = event.clientY - rect.top

    handle.setPointerCapture(event.pointerId)

    const onMove = (move: PointerEvent) => {

      const left = Math.min(window.innerWidth - 80, Math.max(8, move.clientX - dx))
      const top = Math.min(window.innerHeight - 40, Math.max(8, move.clientY - dy))

      windowEl.style.left = `${left}px`
      windowEl.style.top = `${top}px`
      windowEl.style.right = 'auto'
      windowEl.style.bottom = 'auto'
    }

    const onUp = () => {

      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
    }

    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
  })
}

function openWindow() {

  if (!isRunning('requestConsole')) {

    toast('Turn Request Console on first', 'error')

    return
  }

  if (win?.isConnected) {

    win.querySelector<HTMLInputElement>('.bf-req-input')?.focus()

    return
  }

  let file = loadHistory()
  let kind: Kind = file.last.kind

  const method = h('select', { class: 'bf-req-select', 'aria-label': 'Method' }, ...METHODS.map((name) => h('option', { value: name }, name))) as HTMLSelectElement
  const url = h('input', { class: 'bf-req-input', type: 'text', spellcheck: 'false', placeholder: '/api/users/@me', 'aria-label': 'Path' }) as HTMLInputElement
  const headers = h('textarea', { class: 'bf-req-area bf-req-area-headers', spellcheck: 'false', placeholder: '{ "X-Custom": "value" }', 'aria-label': 'Headers JSON' }) as HTMLTextAreaElement
  const body = h('textarea', { class: 'bf-req-area bf-req-area-body', spellcheck: 'false', placeholder: '{ }', 'aria-label': 'JSON' }) as HTMLTextAreaElement
  const history = h('select', { class: 'bf-req-history', 'aria-label': 'History' }) as HTMLSelectElement
  const status = h('div', { class: 'bf-req-status' }, 'Ready')
  const out = h('pre', { class: 'bf-req-out' }, 'Response shows up here.')
  const headersBlock = h('div', { class: 'bf-req-headers' }, h('div', { class: 'bf-req-label' }, 'Headers (JSON)'), headers)
  const httpRow = h('div', { class: 'bf-req-row' }, method, url)

  const httpTab = h('button', { class: 'bf-req-tab', type: 'button', 'aria-selected': 'true' }, 'HTTP')
  const gatewayTab = h('button', { class: 'bf-req-tab', type: 'button', 'aria-selected': 'false' }, 'Gateway')

  const applyKind = (next: Kind) => {

    if (next === 'gateway' && kind !== 'gateway') {

      const trimmed = body.value.trim()

      if (!trimmed || trimmed === '{}' || trimmed === '{\n  \n}') body.value = '{\n  "op": 103,\n  "d": {}\n}'

    }

    kind = next
    httpTab.setAttribute('aria-selected', String(next === 'http'))
    gatewayTab.setAttribute('aria-selected', String(next === 'gateway'))
    setKindUi(next, httpRow, headersBlock, url)
  }

  httpTab.addEventListener('click', () => applyKind('http'))
  gatewayTab.addEventListener('click', () => applyKind('gateway'))

  writeForm(file.last, method, url, headers, body)
  applyKind(kind)
  fillHistory(history, file)

  history.addEventListener('change', () => {

    const index = Number(history.value)

    if (!Number.isInteger(index) || !file.requests[index]) return

    const entry = file.requests[index]

    writeForm(entry, method, url, headers, body)
    applyKind(entry.kind)
  })

  const send = () => {

    const entry = readForm(kind, method, url, headers, body)

    file = remember(file, entry)
    saveHistory(file)
    fillHistory(history, file)
    history.value = '0'

    if (kind === 'gateway') sendGateway(entry, status, out)
    else void sendHttp(entry, status, out)
  }

  const copy = async () => {

    const text = out.textContent ?? ''

    if (!text) return

    await navigator.clipboard.writeText(text)
    toast('Copied response', 'success')
  }

  const onKey = (event: KeyboardEvent) => {

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {

      event.preventDefault()
      send()
    }
  }

  const closeBtn = h('button', { class: 'bf-icon-btn', type: 'button', 'aria-label': 'Close' }, icon('close', 16))

  closeBtn.addEventListener('click', closeWindow)

  const header = h(
    'header',
    { class: 'bf-req-head' },
    h('h2', { class: 'bf-req-title' }, 'Request Console'),
    closeBtn,
  )

  win = h(
    'div',
    { class: 'bf-root bf-req-win', role: 'dialog', 'aria-label': 'Request Console' },
    header,
    h(
      'div',
      { class: 'bf-req-body' },
      h('div', { class: 'bf-req-tabs' }, httpTab, gatewayTab),
      httpRow,
      headersBlock,
      h('div', { class: 'bf-req-label' }, 'Body (JSON)'),
      body,
      h(
        'div',
        { class: 'bf-req-actions' },
        history,
        Button('Copy', () => void copy(), 'secondary'),
        Button('Send', send),
      ),
      status,
      out,
    ),
  )

  win.addEventListener('keydown', onKey)

  const left = Math.max(16, window.innerWidth - 468)
  const top = Math.max(16, window.innerHeight - 620)

  win.style.left = `${left}px`
  win.style.top = `${top}px`

  makeDraggable(header, win)
  document.body.append(win)
  url.focus()
}

export default definePlugin({
  id: 'requestConsole',
  name: 'Request Console',
  description: 'A floating window to send Fenrid HTTP requests and gateway frames with your own JSON.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,

  panel: () => Button('Open window', openWindow, 'secondary'),

  start(ctx) {

    ctx.addStyle(CSS)

    launch = h(
      'button',
      {
        class: 'bf-root bf-req-launch',
        type: 'button',
        'aria-label': 'Open Request Console',
      },
      icon('code', 16),
      'Requests',
    )

    launch.addEventListener('click', openWindow)
    document.body.append(launch)
    openWindow()

    return () => {

      closeWindow()
      launch?.remove()
      launch = null
    }
  },
})