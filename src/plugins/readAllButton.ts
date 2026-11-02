import { injectGatewayEvent } from '../api/network'
import { toast } from '../api/toast'
import { h } from '../core/dom'
import { createLogger } from '../core/logger'
import { definePlugin } from '../core/plugins'
import { Selectors } from '../core/selectors'

const BUTTON = 'bf-read-all'
const BOOTSTRAP = '/api/sidebar/bootstrap'

interface Unread {
  channel: string
  lastMessageId: string
}

const log = createLogger('Read All')

// Fenrid accepts these as numbers too
const idOf = (value: unknown) => (value === null || value === undefined || value === '' ? null : String(value))

function isUnread(lastMessageId: string | null, lastReadMessageId: string | null, mentions: number): boolean {

  if (!lastMessageId) return false

  return mentions > 0 || !lastReadMessageId || BigInt(lastMessageId) > BigInt(lastReadMessageId)
}

async function findUnread(): Promise<Map<string, Unread[]>> {

  const response = await fetch(BOOTSTRAP, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })

  if (!response.ok) throw new Error(`Sidebar bootstrap failed: ${response.status}`)

  const { channels = [], readStates = [] } = await response.json()
  const states = new Map<unknown, any>(readStates.map((state: any) => [state?.channelId, state]))
  const servers = new Map<string, Unread[]>()

  for (const channel of channels) {

    const state = states.get(channel?.id)
    const lastMessageId = idOf(channel?.lastMessageId)

    if (!isUnread(lastMessageId, idOf(state?.lastReadMessageId), Number(state?.mentionCount ?? 0))) continue

    servers.set(channel.serverId, [...(servers.get(channel.serverId) ?? []), { channel: channel.id, lastMessageId: lastMessageId! }])
  }

  return servers
}

async function readServer(server: string, unread: Unread[]) {

  const response = await fetch(`/api/servers/${server}/read`, { method: 'POST', credentials: 'include', cache: 'no-store' })

  if (!response.ok) throw new Error(`Could not mark ${server} as read: ${response.status}`)

  // The same update Fenrid gets from another tab, which clears the dots right away
  for (const { channel, lastMessageId } of unread) {

    injectGatewayEvent('READ_STATE_UPDATE', `channel:${channel}`, { lastReadMessageId: lastMessageId })

  }
}

async function readAll() {

  const servers = await findUnread()

  if (!servers.size) return toast('Nothing to mark as read')

  let failed = 0

  // One at a time: someone in a hundred servers shouldn't fire a hundred requests at once
  for (const [server, unread] of servers) {

    try {

      await readServer(server, unread)

    } catch (err) {

      failed++
      log.warn('Could not mark a server as read', err)

    }
  }

  if (failed) toast(`Could not mark ${failed} of ${servers.size} servers as read`, 'error')
  else toast(`Marked ${servers.size} ${servers.size === 1 ? 'server' : 'servers'} as read`, 'success')
}

export default definePlugin({
  id: 'readAllButton',
  name: 'Read All Button',
  description: 'Adds a button above the server list that marks every server as read. Direct messages stay unread.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    let busy = false

    const button = h('button', { class: BUTTON, type: 'button' }, 'Read All') as HTMLButtonElement

    button.addEventListener('click', async () => {

      if (busy) return

      busy = true
      button.disabled = true

      try {

        await readAll()

      } catch (err) {

        log.error('Could not mark everything as read', err)
        toast('Could not mark everything as read', 'error')

      }

      busy = false
      button.disabled = false
    })

    const place = () => {

      const list = document.querySelector(Selectors.serverRail)?.querySelector(Selectors.serverList)

      if (list && list.previousElementSibling !== button) list.before(button)

    }

    ctx.onDomChange(place)
    ctx.onStop(() => button.remove())

    place()
  },
})