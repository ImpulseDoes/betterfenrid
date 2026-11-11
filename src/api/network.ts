import { createLogger } from '../core/logger'
import { Selectors } from '../core/selectors'

export interface GatewayFrame {
  op: number
  t: string
  s: number | null
  d: any
}

export const GatewayOp = {
  CLIENT_EVENT: 103,
  REQUEST_SERVER_STATS: 106,
}

export interface ApiRequest {
  url: URL
  method: string
}

export interface ApiResult extends ApiRequest {
  ok: boolean
}

type GatewayHook = (frame: GatewayFrame) => void
// Return false to stop a frame from reaching the server
type GatewaySendHook = (frame: { op: number; d?: any }) => boolean | void
type RequestHook = (request: ApiRequest) => void
type ResultHook = (result: ApiResult) => void
// Return a new body to replace what Fenrid receives
type ResponseHook = (url: URL, body: any) => unknown
// Return a new body to replace what Fenrid sends
type RequestBodyHook = (request: ApiRequest, body: any) => unknown

const log = createLogger('Network')
const gatewayHooks = new Set<GatewayHook>()
const everyFrameHooks = new Set<GatewayHook>()
const sendHooks = new Set<GatewaySendHook>()
const requestHooks = new Set<RequestHook>()
const resultHooks = new Set<ResultHook>()
const responseHooks = new Set<ResponseHook>()
const requestBodyHooks = new Set<RequestBodyHook>()

const WATCHED_FRAME = /"t"\s*:\s*"(READY|RESUMED|SUBSCRIBED|REQUEST_ERROR|TOPICS_INVALIDATED|TYPING_|VOICE_STATE_|RELATIONSHIP_|GUILD_|CHANNEL_|MEMBER_|MESSAGE_|SERVER_)/

let gatewaySeen = false
let dispatchOp = 0
let deliverFrame: ((data: string) => void) | null = null
let gatewaySend: ((data: string) => void) | null = null

function subscribe<T>(hooks: Set<T>, hook: T): () => void {

  hooks.add(hook)

  return () => hooks.delete(hook)
}

export const onGatewayFrame = (hook: GatewayHook) => subscribe(gatewayHooks, hook)
// Every frame costs a parse, so only for tools that are switched on by hand
export const onEveryGatewayFrame = (hook: GatewayHook) => subscribe(everyFrameHooks, hook)
export const onGatewaySend = (hook: GatewaySendHook) => subscribe(sendHooks, hook)
export const onApiRequest = (hook: RequestHook) => subscribe(requestHooks, hook)
export const onApiResult = (hook: ResultHook) => subscribe(resultHooks, hook)
export const onApiResponse = (hook: ResponseHook) => subscribe(responseHooks, hook)
export const onApiRequestBody = (hook: RequestBodyHook) => subscribe(requestBodyHooks, hook)

/** False when the mod was injected too late, or outside the page's own JS context */
export function isGatewaySeen(): boolean {
  return gatewaySeen
}

/** Hands Fenrid an event of our own. Without a sequence number it can't look like a gap */
export function injectGatewayEvent(t: string, topic: string, payload: object) {

  deliverFrame?.(JSON.stringify({ op: dispatchOp, t, d: { topic, payload } }))
}

/** Sends a frame of our own. False when the connection isn't open */
export function sendGatewayFrame(frame: { op: number; d?: unknown }): boolean {

  if (!gatewaySend) return false

  try {

    gatewaySend(JSON.stringify(frame))

    return true

  } catch {

    return false

  }
}

function isBlocked(data: unknown): boolean {

  if (!sendHooks.size || typeof data !== 'string') return false

  try {

    const frame = JSON.parse(data)

    for (const hook of sendHooks) {

      if (hook(frame) === false) return true

    }

  } catch (err) {

    log.error('Gateway send hook failed', err)

  }

  return false
}

function rewriteFrame(event: MessageEvent): MessageEvent {

  if (typeof event.data !== 'string') return event

  const watched = WATCHED_FRAME.test(event.data)

  if (!watched && !everyFrameHooks.size) return event

  let frame: GatewayFrame

  try {

    frame = JSON.parse(event.data)

  } catch {

    return event
  }

  for (const hook of everyFrameHooks) {

    try {

      hook(frame)

    } catch (err) {

      log.error('Gateway frame hook failed', err)
    }
  }

  if (!watched) return event

  try {

    const original = frame.t

    dispatchOp = frame.op

    for (const hook of gatewayHooks) hook(frame)

    if (frame.t !== original) return new MessageEvent('message', { data: JSON.stringify(frame) })

  } catch (err) {

    log.error('Gateway hook failed', err)

  }

  return event
}

function hookWebSocket() {

  const Native = window.WebSocket

  window.WebSocket = class extends Native {

    #gateway = false

    constructor(url: string | URL, protocols?: string | string[]) {

      super(url, protocols)

      if (!String(url).includes(Selectors.gatewayHost)) return

      gatewaySeen = true
      this.#gateway = true

      let handler: ((event: MessageEvent) => void) | null = null

      // Fenrid only ever assigns onmessage, so it's the one path to guard
      Object.defineProperty(this, 'onmessage', {
        configurable: true,
        get: () => handler,
        set: (next) => {
          handler = next
        },
      })

      this.addEventListener('message', (event) => handler?.call(this, rewriteFrame(event)))

      deliverFrame = (data) => handler?.call(this, new MessageEvent('message', { data }))
      gatewaySend = (data) => super.send(data)
    }

    send(data: Parameters<WebSocket['send']>[0]) {

      if (!this.#gateway || !isBlocked(data)) super.send(data)

    }
  }
}

async function tapResponse(url: URL, response: Response): Promise<Response> {

  if (!response.ok || !response.headers.get('content-type')?.includes('json')) return response

  try {

    const body = await response.clone().json()

    let next = body

    for (const hook of responseHooks) next = hook(url, next) ?? next

    if (next === body) return response

    const headers = new Headers(response.headers)

    headers.delete('content-length')
    headers.delete('content-encoding')

    return new Response(JSON.stringify(next), { status: response.status, statusText: response.statusText, headers })

  } catch (err) {

    log.error('API hook failed', err)

    return response
  }
}

function apiUrl(input: RequestInfo | URL): URL | null {

  try {

    const url = new URL(input instanceof Request ? input.url : String(input), location.href)

    return url.origin === location.origin && url.pathname.startsWith('/api/') ? url : null

  } catch {

    return null

  }
}

// Only JSON sent as a string, which is how Fenrid sends everything but uploads
function rewriteBody(request: ApiRequest, init: RequestInit | undefined): RequestInit | undefined {

  if (!requestBodyHooks.size || typeof init?.body !== 'string') return init

  try {

    const body = JSON.parse(init.body)

    let next = body

    for (const hook of requestBodyHooks) next = hook(request, next) ?? next

    return next === body ? init : { ...init, body: JSON.stringify(next) }

  } catch {

    return init

  }
}

function hookFetch() {

  const native = window.fetch.bind(window)

  window.fetch = async (input, init) => {

    const url = apiUrl(input)

    if (!url) return native(input, init)

    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()

    for (const hook of requestHooks) hook({ url, method })

    const response = await native(input, rewriteBody({ url, method }, init))

    for (const hook of resultHooks) hook({ url, method, ok: response.ok })

    return method === 'GET' ? tapResponse(url, response) : response
  }
}

// Must run before Fenrid's own scripts, which keep the first socket they open
export function installNetworkHooks() {

  hookWebSocket()
  hookFetch()
}