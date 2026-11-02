import { createLogger } from '../core/logger'
import { injectGatewayEvent, onGatewayFrame, onGatewaySend, sendGatewayFrame } from './network'

const Op = { SUBSCRIBE: 100, UNSUBSCRIBE: 101 }
const NONCE_PREFIX = 'bf:'
const ACK_TIMEOUT_MS = 10_000

interface Pending {
  nonce: string
  topic: string
  timer: ReturnType<typeof setTimeout>
}

type Frame = { op: number; d?: any }

const log = createLogger('Topics')
const refs = new Map<string, number>()
const confirmed = new Set<string>()
const fenrid = new Set<string>()

let queue: string[] = []
let held: Frame[] = []
let ours: Pending | null = null
let theirs: Pending | null = null
let started = false

const isOurs = (nonce: unknown) => typeof nonce === 'string' && nonce.startsWith(NONCE_PREFIX)
const makeNonce = () => `${NONCE_PREFIX}${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`

/**
 * Subscribes to a gateway topic for as long as something holds it. Fenrid
 * waits for each subscription to be confirmed before sending the next one, so
 * ours go one at a time too, never overlapping with Fenrid's, and their replies
 * are hidden from it
 */
export function retainTopic(topic: string): () => void {

  startTopics()

  refs.set(topic, (refs.get(topic) ?? 0) + 1)

  if (!queue.includes(topic)) queue.push(topic)

  pump()

  let released = false

  return () => {

    if (released) return

    released = true
    release(topic)
  }
}

function release(topic: string) {

  const left = (refs.get(topic) ?? 1) - 1

  if (left > 0) return void refs.set(topic, left)

  refs.delete(topic)
  queue = queue.filter((t) => t !== topic)

  if (confirmed.delete(topic) && !fenrid.has(topic)) sendGatewayFrame({ op: Op.UNSUBSCRIBE, d: { topic, nonce: makeNonce() } })
}

function wait(topic: string, nonce: string, onTimeout: () => void): Pending {
  return { topic, nonce, timer: setTimeout(onTimeout, ACK_TIMEOUT_MS) }
}

function settleOurs() {

  if (ours) clearTimeout(ours.timer)

  ours = null
}

function settleTheirs() {

  if (theirs) clearTimeout(theirs.timer)

  theirs = null
}

function pump() {

  if (ours || theirs) return

  const next = held.shift()

  if (next) {

    theirs = wait(next.d.topic, next.d.nonce, () => {
      theirs = null
      pump()
    })

    sendGatewayFrame(next)

    return
  }

  while (queue.length) {

    const topic = queue.shift()!

    if (!refs.has(topic) || confirmed.has(topic)) continue

    if (fenrid.has(topic)) {

      confirmed.add(topic)

      continue
    }

    const nonce = makeNonce()

    ours = wait(topic, nonce, () => {
      log.debug(`No reply for ${topic}`)
      ours = null
      pump()
    })

    if (sendGatewayFrame({ op: Op.SUBSCRIBE, d: { topic, nonce } })) return

    // Not connected: try again once the gateway is ready
    settleOurs()
    queue.unshift(topic)

    return
  }
}

function resubscribeAll() {

  confirmed.clear()
  fenrid.clear()
  queue = [...refs.keys()]
}

function onSend({ op, d }: Frame): boolean | void {

  if (typeof d?.topic !== 'string' || isOurs(d.nonce)) return

  if (op === Op.SUBSCRIBE) {

    fenrid.add(d.topic)

    // Already on the server for us, so answer in its place
    if (confirmed.has(d.topic)) {

      queueMicrotask(() => injectGatewayEvent('SUBSCRIBED', d.topic, { topic: d.topic, nonce: d.nonce }))

      return false
    }

    if (ours) {

      held.push({ op, d })

      return false
    }

    settleTheirs()

    theirs = wait(d.topic, d.nonce, () => {
      theirs = null
      pump()
    })

    return
  }

  if (op === Op.UNSUBSCRIBE) {

    fenrid.delete(d.topic)
    held = held.filter((frame) => frame.d.topic !== d.topic)

    // Keep it on the server while we still use it
    if (refs.has(d.topic)) return false
  }
}

// Runs at startup, so it knows which topics Fenrid subscribes to from the first one
export function startTopics() {

  if (started) return

  started = true

  onGatewaySend(onSend)

  onGatewayFrame((frame) => {

    const payload = frame.d?.payload

    switch (frame.t) {

      case 'READY':

        settleOurs()
        settleTheirs()
        held = []
        resubscribeAll()
        setTimeout(pump)

        break

      case 'RESUMED':

        if (ours) queue.unshift(ours.topic)

        settleOurs()
        settleTheirs()
        setTimeout(pump)

        break

      case 'TOPICS_INVALIDATED':

        resubscribeAll()
        setTimeout(pump)

        break

      case 'SUBSCRIBED':

        if (isOurs(payload?.nonce)) {

          if (ours && ours.nonce === payload.nonce) {

            confirmed.add(ours.topic)
            settleOurs()

          }

          frame.t = 'BF_SUBSCRIBED'

        } else if (theirs && payload?.nonce === theirs.nonce) {

          settleTheirs()

        }

        pump()

        break

      case 'REQUEST_ERROR':

        // Fenrid matches a failed subscription to the one it's waiting for, nonce or not
        if (isOurs(payload?.nonce) || (payload?.nonce == null && ours && !theirs)) {

          log.debug(`Subscription refused: ${ours?.topic}`, payload)
          settleOurs()
          frame.t = 'BF_REQUEST_ERROR'

        } else if (theirs && (payload?.nonce == null || payload.nonce === theirs.nonce)) {

          settleTheirs()

        }

        pump()

        break
    }
  })
}