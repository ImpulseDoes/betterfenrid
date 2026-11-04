import { openModal } from '../api/modal'
import { toast } from '../api/toast'
import { h } from '../core/dom'
import { createLogger } from '../core/logger'
import { definePlugin } from '../core/plugins'
import { Button } from '../ui/components'
import { icon } from '../ui/icons'

interface Server {
  id: string
  name: string
  imageUrl: string | null
}

type LayoutItem = { type: 'server'; serverId: unknown } | { type: 'folder'; serverIds?: unknown[] }

const LAYOUT = '/api/users/me/server-layout'
const GAP_MS = 400
const CONFIRM_MS = 4_000

const log = createLogger('Bulk Leave Servers')
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function loadServers(): Promise<Server[]> {

  const response = await fetch(LAYOUT, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })

  if (!response.ok) throw new Error(`Server layout failed: ${response.status}`)

  const { items = [], servers = [] } = await response.json()
  const byId = new Map<string, Server>()

  for (const server of servers) {

    const id = server?.id == null ? '' : String(server.id)

    if (!id || byId.has(id)) continue

    byId.set(id, {
      id,
      name: String(server.name ?? '').trim() || `Server ${id}`,
      imageUrl: typeof server.imageUrl === 'string' && server.imageUrl ? server.imageUrl : null,
    })
  }

  const order = (items as LayoutItem[]).flatMap((item) => (item?.type === 'server' ? [item.serverId] : (item?.serverIds ?? [])))
  const sorted = new Set([...order.map(String), ...byId.keys()])

  return [...sorted].flatMap((id) => byId.get(id) ?? [])
}

async function leave(server: Server): Promise<void> {

  for (let attempt = 0; ; attempt++) {

    const response = await fetch(`/api/servers/${server.id}/leave`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })

    if (response.status === 429 && attempt < 2) {

      await wait(Math.min(Number(response.headers.get('Retry-After')) * 1000 || 2_000, 10_000))
      continue

    }

    const body = await response.json().catch(() => null)

    if (!response.ok) throw new Error(body?.error || `Failed with ${response.status}`)

    window.dispatchEvent(new CustomEvent('fenrid:server-left', { detail: { serverId: server.id } }))

    return
  }
}

function ServerIcon(server: Server): Node {

  if (server.imageUrl) return h('img', { class: 'bf-bulk-leave-icon', src: server.imageUrl, alt: '', loading: 'lazy' })

  const initials = server.name.split(/\s+/).map((word) => [...word][0] ?? '').join('').slice(0, 3)

  return h('span', { class: 'bf-bulk-leave-icon' }, initials)
}

async function openBulkLeave(preselect?: string | null) {

  let servers: Server[]

  try {

    servers = await loadServers()

  } catch (err) {

    log.error('Could not load your servers', err)
    return toast('Could not load your servers', 'error')

  }

  if (!servers.length) return toast('You are not in any servers')

  const selected = new Set<string>(preselect && servers.some((s) => s.id === preselect) ? [preselect] : [])
  const rows = new Map<string, { row: HTMLElement; box: HTMLInputElement; status: HTMLElement }>()

  let busy = false
  let confirming = false
  let confirmTimer = 0
  let lastClicked: string | null = null

  const search = h('input', {
    class: 'bf-input',
    type: 'search',
    placeholder: 'Search your servers',
    'aria-label': 'Search your servers',
    onInput: () => filter(),
  })

  const count = h('span', { class: 'bf-bulk-leave-count' })
  const list = h('div', { class: 'bf-bulk-leave-list', role: 'list' })
  const empty = h('div', { class: 'bf-empty', hidden: true }, 'No servers match your search.')

  const visible = () => servers.filter((s) => !rows.get(s.id)!.row.hidden)

  const selectShown = Button('Select shown', () => {

    for (const server of visible()) selected.add(server.id)

    update()

  }, 'secondary')

  const clear = Button('Clear', () => {

    selected.clear()
    update()

  }, 'secondary')

  const cancel = Button('Cancel', () => close(), 'secondary')
  const confirm = Button('', () => leaveSelected(), 'danger')

  const resetConfirm = () => {

    confirming = false
    clearTimeout(confirmTimer)

  }

  const update = () => {

    for (const [id, { row, box }] of rows) {

      box.checked = selected.has(id)
      box.disabled = busy || row.classList.contains('bf-bulk-leave-left')
      row.classList.toggle('bf-bulk-leave-selected', box.checked)

    }

    const n = selected.size
    const noun = n === 1 ? 'server' : 'servers'

    count.textContent = `${n} selected`
    confirm.textContent = busy ? confirm.textContent : confirming ? `Click again to leave ${n} ${noun}` : n ? `Leave ${n} ${noun}` : 'Leave servers'
      ; (confirm as HTMLButtonElement).disabled = busy || !n
      ; (selectShown as HTMLButtonElement).disabled = busy
      ; (clear as HTMLButtonElement).disabled = busy || !n
    search.disabled = busy
  }

  const filter = () => {

    const q = search.value.trim().toLowerCase()

    for (const server of servers) rows.get(server.id)!.row.hidden = !!q && !`${server.name} ${server.id}`.toLowerCase().includes(q)

    empty.hidden = visible().length > 0
  }

  const toggle = (server: Server, checked: boolean, range: boolean) => {

    const shown = visible()
    const from = range && lastClicked ? shown.findIndex((s) => s.id === lastClicked) : -1
    const to = shown.findIndex((s) => s.id === server.id)
    const targets = from >= 0 && to >= 0 ? shown.slice(Math.min(from, to), Math.max(from, to) + 1) : [server]

    for (const target of targets) {

      if (rows.get(target.id)!.row.classList.contains('bf-bulk-leave-left')) continue

      if (checked) selected.add(target.id)
      else selected.delete(target.id)

    }

    lastClicked = server.id
    resetConfirm()
    update()
  }

  for (const server of servers) {

    const box = h('input', { type: 'checkbox', 'aria-label': `Leave ${server.name}` })
    const status = h('span', { class: 'bf-bulk-leave-status' })

    const row = h('div', {
      class: 'bf-bulk-leave-row',
      role: 'listitem',
      onClick: (e: MouseEvent) => {

        if (box.disabled) return

        toggle(server, e.target === box ? box.checked : !selected.has(server.id), e.shiftKey)

      },
    },
      box,
      ServerIcon(server),
      h('span', { class: 'bf-bulk-leave-name' }, server.name),
      status,
    )

    rows.set(server.id, { row, box, status })
    list.append(row)
  }

  const leaveSelected = async () => {

    if (busy || !selected.size) return

    if (!confirming) {

      confirming = true
      confirmTimer = window.setTimeout(() => {

        confirming = false
        update()

      }, CONFIRM_MS)

      return update()
    }

    resetConfirm()
    busy = true

    const queue = servers.filter((s) => selected.has(s.id))
    let left = 0
    let failed = 0

    for (const [i, server] of queue.entries()) {

      const { row, status } = rows.get(server.id)!

      confirm.textContent = `Leaving ${i + 1} of ${queue.length}...`
      status.textContent = 'Leaving...'
      status.className = 'bf-bulk-leave-status'
      update()

      try {

        await leave(server)

        left++
        selected.delete(server.id)
        row.classList.add('bf-bulk-leave-left')
        status.textContent = 'Left'

      } catch (err) {

        failed++
        log.warn(`Could not leave ${server.name}`, err)
        status.textContent = err instanceof Error ? err.message : 'Failed'
        status.classList.add('bf-bulk-leave-failed')

      }

      if (i < queue.length - 1) await wait(GAP_MS)
    }

    busy = false
    update()

    const noun = (n: number) => (n === 1 ? 'server' : 'servers')

    if (failed) toast(`Left ${left} ${noun(left)}, could not leave ${failed}`, 'error', 4_000)
    else toast(`Left ${left} ${noun(left)}`, 'success')
  }

  const body = h('div', { class: 'bf-bulk-leave' },
    h('div', { class: 'bf-search' }, icon('search', 18), search),
    h('div', { class: 'bf-bulk-leave-toolbar' }, count, selectShown, clear),
    list,
    empty,
  )

  const close = openModal({ title: 'Bulk Leave Servers', body, footer: [cancel, confirm] })

  update()
  search.focus()
}

export default definePlugin({
  id: 'bulkLeaveServers',
  name: 'Bulk Leave Servers',
  description: 'Leave many servers at once. Pick them from a searchable list, opened from any server\'s right click menu or from here.',
  authors: ['Better Fenrid'],

  panel: () => Button('Open', () => void openBulkLeave(), 'secondary'),

  start(ctx) {

    ctx.addContextMenuItem({
      id: 'bulkLeave',
      label: 'Bulk Leave Servers',
      icon: 'leave',
      danger: true,
      kinds: ['server'],
      action: (target) => void openBulkLeave(target.id),
    })
  },
})