import { openModal } from '../api/modal'
import { h } from '../core/dom'
import { getMessage, onMessageEdit } from '../core/entities'
import { createLogger } from '../core/logger'
import { definePlugin } from '../core/plugins'
import { Selectors } from '../core/selectors'
import { Button } from '../ui/components'
import { isDeletedMessage } from './deletedMessages'

const STORAGE_KEY = 'BetterFenrid:editHistory'
const MARK = 'data-bf-edits'

interface Version {
  content: string
  at: string
}

const log = createLogger('Edit History')
const history = loadHistory()

let refresh: ((id: string) => void) | null = null

function loadHistory(): Map<string, Version[]> {

  try {

    return new Map(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))

  } catch {

    return new Map()

  }
}

function saveHistory() {

  try {

    localStorage.setItem(STORAGE_KEY, JSON.stringify([...history]))

  } catch (err) {

    log.warn('Could not save the edit history', err)

  }
}

function trimHistory(max: number) {

  for (const id of history.keys()) {

    if (history.size <= max) break

    history.delete(id)
  }
}

function record(id: string, before: Record<string, any>, max: number) {

  const versions = history.get(id) ?? []

  if (versions.at(-1)?.content !== before.content) versions.push({ content: before.content, at: before.edited_at ?? before.created_at })

  // Newest last, so trimming drops the messages edited longest ago
  history.delete(id)
  history.set(id, versions)

  trimHistory(max)
  saveHistory()
}

export function forgetEdits(id: string) {

  if (!history.delete(id)) return

  saveHistory()
  refresh?.(id)
}

const formatTime = (at: string) => new Date(at).toLocaleString()

// Fenrid tags both a message's outer wrapper and the row inside it: only the row gets the history
function messageRows(id: string): Element[] {

  const selector = `${Selectors.message.slice(0, -1)}="${CSS.escape(id)}"]`

  return [...document.querySelectorAll(selector)].filter((el) => !el.querySelector(Selectors.message))
}

function InlineHistory(id: string, versions: Version[]): Element {

  return h(
    'div',
    { class: 'bf-edit-history', [MARK]: id },
    ...versions.map((version) =>
      h(
        'div',
        { class: 'bf-edit-old' },
        version.content || '(no text)',
        h('span', { class: 'bf-edit-tag', title: formatTime(version.at) }, '(edited)'),
      ),
    ),
  )
}

function renderRow(row: Element, id: string, show: boolean) {

  const existing = row.querySelector(`[${MARK}]`)
  const versions = history.get(id)
  const content = row.querySelector(Selectors.messageContent)

  if (!show || !versions?.length || !content) return void existing?.remove()

  const next = InlineHistory(id, versions)

  if (existing) existing.replaceWith(next)
  else content.before(next)
}

function HistoryEntry(label: string, content: string): Node {

  return h(
    'div',
    { class: 'bf-log-item' },
    h('div', { class: 'bf-row-desc' }, label),
    h('div', { class: 'bf-log-text' }, content || '(no text)'),
  )
}

function openHistory(id: string) {

  const versions = history.get(id) ?? []
  const current = getMessage(id)

  const entries = versions.map((version, i) => HistoryEntry(i === 0 ? `Original · ${formatTime(version.at)}` : `Edited · ${formatTime(version.at)}`, version.content))

  if (typeof current?.content === 'string') {

    entries.push(HistoryEntry(`Current${current.edited_at ? ` · ${formatTime(current.edited_at)}` : ''}`, current.content))

  }

  const close = openModal({
    title: 'Edit history',
    body: h('div', { class: 'bf-log' }, ...entries),
    footer: [Button('Close', () => close(), 'secondary')],
  })
}

export default definePlugin({
  id: 'editHistory',
  name: 'Edit History',
  description: 'Keeps earlier versions of edited messages and shows them above the message. Only edits made while Fenrid is open in this browser are saved.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,
  settings: {
    inline: {
      type: 'boolean',
      label: 'Show earlier versions in the chat',
      description: 'Turn this off to only see them through "Edit History" in the message menu.',
      default: true,
    },
    maxEntries: {
      type: 'number',
      label: 'History size',
      description: 'How many edited messages to remember. The ones edited longest ago are dropped first.',
      default: 500,
      min: 10,
      max: 2000,
      step: 10,
    },
  },

  panel: () => Button('Clear history', () => {

    history.clear()
    saveHistory()
    document.querySelectorAll(`[${MARK}]`).forEach((el) => el.remove())

  }, 'danger'),

  start(ctx) {

    const render = (id: string) => messageRows(id).forEach((row) => renderRow(row, id, ctx.settings.inline))

    const renderAll = () => {

      for (const row of document.querySelectorAll(Selectors.message)) {

        const id = (row as HTMLElement).dataset.messageId

        if (id && !row.querySelector(Selectors.message)) renderRow(row, id, ctx.settings.inline)

      }
    }

    refresh = render

    ctx.onStop(() => {

      refresh = null
      document.querySelectorAll(`[${MARK}]`).forEach((el) => el.remove())

    })

    ctx.onStop(
      onMessageEdit((id, before) => {

        // Encrypted DMs only carry ciphertext, which is no use to anyone
        if (!before.channel_id) return

        record(id, before, ctx.settings.maxEntries)

        // After Fenrid has drawn the new text
        setTimeout(() => refresh?.(id), 50)
      }),
    )

    ctx.onDomChange((added) => {

      if (!history.size) return

      const rows = new Set<Element>()

      for (const el of added) {

        if (el.closest(`[${MARK}]`)) continue

        // Fenrid may redraw just the text of a message, which takes our history with it
        const around = el.closest(Selectors.message)

        if (around) rows.add(around)

        el.querySelectorAll(Selectors.message).forEach((row) => rows.add(row))
      }

      for (const row of rows) {

        const id = (row as HTMLElement).dataset.messageId

        if (id && history.has(id) && !row.querySelector(Selectors.message) && !row.querySelector(`[${MARK}]`)) renderRow(row, id, ctx.settings.inline)

      }
    })

    ctx.onSettingsChange(() => {

      if (history.size > ctx.settings.maxEntries) {

        trimHistory(ctx.settings.maxEntries)
        saveHistory()

      }

      renderAll()
    })

    ctx.addContextMenuItem({
      id: 'view',
      label: 'Edit History',
      icon: 'history',
      kinds: ['message'],
      visible: (target) => !!target.id && history.has(target.id),
      action: (target) => openHistory(target.id!),
    })

    // A deleted message has its own item, which clears this too
    ctx.addContextMenuItem({
      id: 'remove',
      label: 'Remove From History',
      icon: 'close',
      kinds: ['message'],
      visible: (target) => !!target.id && history.has(target.id) && !isDeletedMessage(target.id),
      action: (target) => forgetEdits(target.id!),
    })

    renderAll()
  },
})