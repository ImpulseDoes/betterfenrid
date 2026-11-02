import { extractText } from '../api/contextMenu'
import { openModal } from '../api/modal'
import { injectGatewayEvent, isGatewaySeen, onApiRequest, onApiResponse, onApiResult, onGatewayFrame } from '../api/network'
import { h } from '../core/dom'
import { getChannel, getMessage, getUser } from '../core/entities'
import { createLogger } from '../core/logger'
import { definePlugin } from '../core/plugins'
import { Selectors } from '../core/selectors'
import { Button } from '../ui/components'
import { forgetEdits } from './editHistory'

const STORAGE_KEY = 'BetterFenrid:deletedMessages'
const SERVER_MESSAGES = '/api/chat/server/messages'
const DM_MESSAGES = '/api/dm/messages'

type RawMessage = Record<string, any>

interface LoggedMessage {
  id: string
  // Gateway topic: channel:<id> or dm:<id>
  topic: string
  raw: RawMessage | null
  text: string
  deletedAt: string
}

const log = createLogger('Deleted Messages')
const logged = loadLog()
// Deletions sent from this client, with the text on screen at that moment.
// Fenrid drops these messages from the chat straight away, without waiting for the server
const ownDeletes = new Map<string, string>()

let onLogChange: (() => void) | null = null

export function isDeletedMessage(id: string): boolean {
  return logged.has(id)
}

function loadLog(): Map<string, LoggedMessage> {

  try {

    const entries: LoggedMessage[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')

    return new Map(entries.map((entry) => [entry.id, entry]))

  } catch {

    return new Map()

  }
}

function saveLog() {

  try {

    localStorage.setItem(STORAGE_KEY, JSON.stringify([...logged.values()]))

  } catch (err) {

    log.warn('Could not save the deleted message history', err)

  }

  onLogChange?.()
}

function trimLog(max: number) {

  for (const id of logged.keys()) {

    if (logged.size <= max) break

    logged.delete(id)
  }
}

function findMessageElement(id: string): Element | null {
  return document.querySelector(`${Selectors.message.slice(0, -1)}="${CSS.escape(id)}"]`)
}

function deletedMessageId(url: URL, method: string): string | null {
  return method === 'DELETE' ? (url.pathname.match(/\/messages\/(\d+)$/)?.[1] ?? null) : null
}

// True when the message is in the log, meaning it's safe to keep it on screen
function record(id: string, topic: string, deletedAt: string, max: number): boolean {

  if (logged.has(id)) return true

  const raw = getMessage(id)
  const element = findMessageElement(id)

  if (!raw && !element) return false

  const text = typeof raw?.content === 'string' ? raw.content : extractText(element) || (ownDeletes.get(id) ?? '')

  logged.set(id, { id, topic, raw, text, deletedAt })
  trimLog(max)
  saveLog()

  return true
}

function deletedStyle(): string {

  const selector = [...logged.keys()]
    .filter((id) => /^\w+$/.test(id))
    .map((id) => `[data-message-id="${id}"]`)
    .join(',')

  if (!selector) return ''

  // Fenrid tags both a message's outer wrapper and the row inside it: only mark the row
  return `
    :is(${selector}):not(:has(:is(${selector}))) {
      background: rgb(229 72 77 / 8%);
      box-shadow: inset 3px 0 0 #e5484d;
    }
  `
}

// Puts logged messages back into a page of channel history, keeping the page's order
function withLoggedMessages(url: URL, body: { messages: RawMessage[]; hasMore?: boolean; hasNewer?: boolean }) {

  const topic = `channel:${url.searchParams.get('channelId')}`
  const candidates = [...logged.values()].filter((entry) => entry.topic === topic && entry.raw)

  if (!candidates.length) return

  const { messages } = body
  const times = messages.map((m) => String(m.created_at)).sort()
  const limit = Number(url.searchParams.get('limit') ?? 30)
  const reachedStart = body.hasMore === false || (body.hasMore === undefined && messages.length < limit)

  if (!reachedStart && !times.length) return

  // Only what falls inside this page, or it would appear in the wrong place
  const oldest = reachedStart ? '' : times[0]
  const newest = body.hasNewer ? times.at(-1)! : (url.searchParams.get('before') ?? '￿')
  const present = new Set(messages.map((m) => String(m.id)))

  const extra = candidates
    .map((entry) => entry.raw!)
    .filter((raw) => !present.has(String(raw.id)) && raw.created_at >= oldest && raw.created_at <= newest)

  if (!extra.length) return

  const newestFirst = messages.length < 2 || messages[0].created_at > messages.at(-1)!.created_at
  const merged = [...messages, ...extra].sort((a, b) => (a.created_at < b.created_at ? -1 : 1))

  return { ...body, messages: newestFirst ? merged.reverse() : merged }
}

function describeSource(entry: LoggedMessage): string {

  const [type, id] = entry.topic.split(':')

  if (type === 'dm') return 'Direct message'

  const name = getChannel(id)?.name

  return name ? `#${name}` : 'Unknown channel'
}

function describeAuthor(raw: RawMessage | null): string {

  const profile = raw?.profiles ?? (raw?.author_id ? getUser(String(raw.author_id)) : null)

  return profile?.display_name ?? profile?.username ?? 'Unknown user'
}

function HistoryItem(entry: LoggedMessage): Node {

  const attachments = entry.raw?.attachments?.length ?? 0

  return h(
    'div',
    { class: 'bf-log-item' },
    h(
      'div',
      { class: 'bf-row-desc' },
      `${describeAuthor(entry.raw)} · ${describeSource(entry)} · deleted ${new Date(entry.deletedAt).toLocaleString()}`,
    ),
    h('div', { class: 'bf-log-text' }, entry.text || '(no text)'),
    attachments ? h('div', { class: 'bf-row-desc' }, `${attachments} attachment(s)`) : null,
  )
}

function openHistory() {

  const list = h('div', { class: 'bf-log' })

  const render = () => {

    const entries = [...logged.values()].reverse()

    list.replaceChildren(...(entries.length ? entries.map(HistoryItem) : [h('div', { class: 'bf-empty' }, 'Nothing here yet.')]))
  }

  const clear = () => {

    logged.clear()
    saveLog()
    render()

  }

  render()

  const close = openModal({
    title: 'Deleted messages',
    body: h(
      'div',
      {},
      isGatewaySeen() ? null : h('p', { class: 'bf-row-desc' }, 'Better Fenrid can\'t see Fenrid\'s live connection, so new deletions aren\'t being logged. Reinstall the userscript and reload the page.'),
      list,
    ),
    footer: [Button('Clear history', clear, 'danger'), Button('Close', () => close(), 'secondary')],
  })
}

export default definePlugin({
  id: 'deletedMessages',
  name: 'Deleted Messages',
  description: 'Keeps deleted messages in the chat, marked in red, and saves them to a history. Everything stays in this browser.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,
  settings: {
    keepInChat: {
      type: 'boolean',
      label: 'Keep deleted messages in the chat',
      description: 'Turn this off to only save them to the history.',
      default: true,
    },
    logOwn: {
      type: 'boolean',
      label: 'Include messages you delete',
      description: 'Turn this off and what you delete from this browser is really gone.',
      default: true,
    },
    maxEntries: {
      type: 'number',
      label: 'History size',
      description: 'The oldest messages are dropped past this limit.',
      default: 500,
      min: 10,
      max: 2000,
      step: 10,
    },
  },

  panel: () => Button('Open history', openHistory, 'secondary'),

  start(ctx) {

    const style = ctx.addStyle('')

    const render = () => style.set(ctx.settings.keepInChat ? deletedStyle() : '')

    // Fenrid has already dropped it, so hiding the delete isn't enough. An update for a
    // message it doesn't have adds it back, without the sound and unread count of a create
    const restoreOwn = (id: string) => {

      const entry = logged.get(id)

      if (!ownDeletes.delete(id) || !entry?.raw || !ctx.settings.keepInChat) return

      // DMs can't take a message back mid-session, they stay in the history only
      if (entry.topic.startsWith('channel:')) injectGatewayEvent('MESSAGE_UPDATE', entry.topic, { message: entry.raw })
    }

    const keep = (id: string, topic: string, deletedAt: string) => {

      if (ownDeletes.has(id) && !ctx.settings.logOwn) {

        ownDeletes.delete(id)

        return false
      }

      const kept = record(id, topic, deletedAt, ctx.settings.maxEntries) && ctx.settings.keepInChat

      restoreOwn(id)

      return kept
    }

    onLogChange = render
    render()

    ctx.addContextMenuItem({
      id: 'remove',
      label: 'Remove From History',
      icon: 'close',
      danger: true,
      kinds: ['message'],
      visible: (target) => !!target.id && logged.has(target.id),
      action: (target) => {

        const entry = logged.get(target.id!)

        if (!entry) return

        logged.delete(entry.id)
        ownDeletes.delete(entry.id)
        saveLog()
        forgetEdits(entry.id)

        const deletedAt = Number.isNaN(Date.parse(entry.deletedAt)) ? new Date().toISOString() : entry.deletedAt

        injectGatewayEvent('MESSAGE_DELETE', entry.topic, { id: entry.id, deletedAt, changeCursor: { id: entry.id, updatedAt: deletedAt } })
      },
    })

    ctx.onStop(() => {
      onLogChange = null
    })

    ctx.onSettingsChange(() => {

      if (logged.size > ctx.settings.maxEntries) {

        trimLog(ctx.settings.maxEntries)
        saveLog()

      }

      render()
    })

    ctx.onStop(
      onApiRequest(({ url, method }) => {

        const id = deletedMessageId(url, method)

        if (id) ownDeletes.set(id, extractText(findMessageElement(id)))

      }),
    )

    // The gateway usually confirms a delete too, but this also works if it's slower or never does
    ctx.onStop(
      onApiResult(({ url, method, ok }) => {

        const id = deletedMessageId(url, method)

        if (!id || !ownDeletes.has(id)) return

        if (!ok) {

          ownDeletes.delete(id)

          return
        }

        const raw = getMessage(id)

        if (!raw || !ctx.settings.logOwn) return

        const topic = raw.channel_id ? `channel:${raw.channel_id}` : `dm:${raw.conversation_id}`

        keep(id, topic, new Date().toISOString())
      }),
    )

    ctx.onStop(
      onGatewayFrame((frame) => {

        if (frame.t !== 'MESSAGE_DELETE' && frame.t !== 'MESSAGE_DELETE_BULK') return

        const { topic, payload } = frame.d
        const ids: string[] = frame.t === 'MESSAGE_DELETE' ? [payload.id] : payload.ids

        // Not short-circuited: every message in a bulk delete has to reach the log
        const kept = ids.map((id) => keep(id, topic, payload.deletedAt))

        if (kept.some(Boolean)) frame.t = `BF_${frame.t}`

      }),
    )

    ctx.onStop(
      onApiResponse((url, body) => {

        if (url.pathname !== SERVER_MESSAGES && url.pathname !== DM_MESSAGES) return

        // After a reconnect Fenrid replays what it missed, including deletions
        if (url.searchParams.get('recovery') === '1' && Array.isArray(body?.items)) {

          const owner = url.pathname === SERVER_MESSAGES ? 'channel' : 'dm'
          const topic = `${owner}:${url.searchParams.get(owner === 'dm' ? 'conversationId' : 'channelId')}`
          const items = body.items.filter((item: RawMessage) => item.kind !== 'delete' || !keep(item.messageId, topic, item.deletedAt))

          return items.length === body.items.length ? undefined : { ...body, items }
        }

        // DMs are encrypted per session, so only channels get their messages back after a reload
        if (url.pathname === SERVER_MESSAGES && ctx.settings.keepInChat && Array.isArray(body?.messages)) {

          return withLoggedMessages(url, body)

        }
      }),
    )
  },
})