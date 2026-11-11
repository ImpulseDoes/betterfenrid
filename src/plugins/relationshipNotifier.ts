import { onApiRequest, onGatewayFrame } from '../api/network'
import { currentUserId } from '../api/profiles'
import { toast } from '../api/toast'
import { definePlugin } from '../core/plugins'

const STORAGE_KEY = 'BetterFenrid:relationships'
const FRIENDS = '/api/friends'
const REQUESTS = '/api/friends/requests'
const SERVERS = '/api/users/me/server-layout'
const START_DELAY_MS = 4_000
const DEBOUNCE_MS = 1_500
const ACCOUNT_WAIT_MS = 60_000
const TOAST_MS = 10_000
const MAX_AT_ONCE = 5

type Names = Record<string, string>

interface Snapshot {
  friends?: Names
  requests?: Record<string, { user: string; name: string }>
  servers?: Names
}

type Part = keyof Snapshot

function loadAll(): Record<string, Snapshot> {

  try {

    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')

    return all && typeof all === 'object' && !Array.isArray(all) ? all : {}

  } catch {

    return {}

  }
}

function nameOf(user: any, fallback: string): string {

  const name = [user?.friend_nickname, user?.nickname, user?.display_name, user?.username].find((n) => typeof n === 'string' && n.trim())

  return name ? String(name).trim() : fallback
}

async function getJson(url: string): Promise<any | null> {

  const response = await fetch(url, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })

  return response.ok ? response.json() : null
}

export default definePlugin({
  id: 'relationshipNotifier',
  name: 'Relationship Notifier',
  description: 'Tells you when someone removes you from their friends, takes back a friend request, or when you are removed from a server.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    friends: {
      type: 'boolean',
      label: 'Friends',
      description: 'When someone removes you from their friends.',
      default: true,
    },
    requests: {
      type: 'boolean',
      label: 'Friend requests',
      description: 'When someone takes back a friend request they sent you.',
      default: true,
    },
    servers: {
      type: 'boolean',
      label: 'Servers',
      description: 'When you are kicked or banned from a server, or the server is deleted.',
      default: true,
    },
    offline: {
      type: 'boolean',
      label: 'While you were away',
      description: 'Also tells you about changes that happened while Fenrid was closed.',
      default: true,
    },
  },

  start(ctx) {

    let stopped = false
    let account: string | null = null
    let snapshot: Snapshot = {}
    // The first read of eac list after start compares against what was saved last time
    const seen = new Set<Part>()
    const timers = new Map<string, number>()
    const waiting: string[] = []

    // Things you did yourself are never news
    const ownFriends = new Set<string>()
    const ownRequests = new Set<string>()
    const ownServers = new Set<string>()
    let blockedSomeone = false

    const save = () => {

      if (!account) return

      try {

        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadAll(), [account]: snapshot }))

      } catch (error) {

        ctx.log.warn('Could not save the lists', error)

      }
    }

    const flush = () => {

      if (document.hidden || stopped) return

      const shown = waiting.splice(0, MAX_AT_ONCE)

      if (waiting.length) shown.push(`…and ${waiting.length} more ${waiting.length === 1 ? 'change' : 'changes'}`)

      waiting.length = 0

      for (const message of shown) toast(message, 'info', TOAST_MS)
    }

    const notify = (message: string) => {

      ctx.log.info(message)
      waiting.push(message)
      flush()
    }

    // Returns what's gone since the last time this list was read
    const replace = <P extends Part>(part: P, next: NonNullable<Snapshot[P]>): [string, any][] => {

      const before = snapshot[part]
      const first = !seen.has(part)

      seen.add(part)
      snapshot = { ...snapshot, [part]: next }
      save()

      if (!before || (first && !ctx.settings.offline)) return []

      return Object.entries(before).filter(([id]) => !(id in next))
    }

    const syncFriends = async () => {

      const [friendData, requestData] = await Promise.all([getJson(FRIENDS), getJson(REQUESTS)])

      if (stopped || !account) return

      const friends: Names = {}

      if (Array.isArray(friendData?.friends)) {

        for (const friend of friendData.friends) {

          if (friend?.friend_id != null) friends[String(friend.friend_id)] = nameOf(friend, 'Someone')

        }

        const quiet = blockedSomeone

        blockedSomeone = false

        for (const [id, name] of replace('friends', friends)) {

          if (!ownFriends.delete(id) && !quiet && ctx.settings.friends) notify(`${name} removed you from their friends`)

        }
      }

      if (Array.isArray(requestData?.incoming)) {

        const requests: NonNullable<Snapshot['requests']> = {}

        for (const request of requestData.incoming) {

          const user = request?.sender?.id ?? request?.sender_id

          if (request?.id != null && user != null) requests[String(request.id)] = { user: String(user), name: nameOf(request.sender, 'Someone') }

        }

        const nowFriends = snapshot.friends ?? friends

        for (const [id, request] of replace('requests', requests)) {

          // Accepted ones turn into friends
          if (!ownRequests.delete(id) && !(request.user in nowFriends) && ctx.settings.requests) notify(`${request.name} took back their friend request`)

        }
      }
    }

    const syncServers = async () => {

      const data = await getJson(SERVERS)

      if (stopped || !account || !Array.isArray(data?.servers)) return

      const servers: Names = {}

      for (const server of data.servers) {

        if (server?.id != null) servers[String(server.id)] = String(server.name ?? '').trim() || 'a server'

      }

      for (const [id, name] of replace('servers', servers)) {

        if (!ownServers.delete(id) && ctx.settings.servers) notify(`You are no longer in ${name}. You were kicked or banned, or it was deleted`)

      }
    }

    const soon = (key: string, run: () => Promise<void>, delay = DEBOUNCE_MS) => {

      clearTimeout(timers.get(key))

      timers.set(key, window.setTimeout(() => {

        if (!stopped && account) run().catch((error) => ctx.log.warn(`Could not read ${key}`, error))

      }, delay))
    }

    const begin = (id: string) => {

      if (account || stopped) return

      account = id
      snapshot = loadAll()[id] ?? {}

      soon('friends', syncFriends, 0)
      soon('servers', syncServers, 0)
    }

    // Lists are saved per account, so nothing is compared before we know whose they are
    const startedAt = Date.now()

    const findAccount = () => {

      if (account || stopped) return

      const id = currentUserId()

      if (id) return begin(id)

      if (Date.now() - startedAt < ACCOUNT_WAIT_MS) timers.set('account', window.setTimeout(findAccount, 2_000))
      else ctx.log.warn('Could not tell which account this is, so nothing is being watched')
    }

    timers.set('account', window.setTimeout(findAccount, START_DELAY_MS))

    ctx.onStop(onGatewayFrame((frame) => {

      if (frame.t === 'RELATIONSHIP_UPDATE') soon('friends', syncFriends)
      else if (frame.t === 'SERVER_LIST_UPDATE' || (frame.t === 'GUILD_DELETE' && frame.d?.payload?.unavailable !== true)) soon('servers', syncServers)
    }))

    ctx.onStop(onApiRequest(({ url, method }) => {

      const path = url.pathname.split('/').slice(2).map(decodeURIComponent)

      if (path[0] === 'friends' && path[1] === 'requests' && path[2] && method !== 'GET') ownRequests.add(path[2])
      else if (path[0] === 'friends' && path[1] && method === 'DELETE') ownFriends.add(path[1])
      else if (path[0] === 'blocks' && method === 'POST') blockedSomeone = true
      else if (path[0] === 'servers' && path[1] && method === 'DELETE' && (!path[2] || path[2] === 'leave')) ownServers.add(path[1])
    }))

    const onLeft = (event: Event) => {

      const id = (event as CustomEvent).detail?.serverId

      if (id != null) ownServers.add(String(id))

      soon('servers', syncServers)
    }

    window.addEventListener('fenrid:server-left', onLeft)
    document.addEventListener('visibilitychange', flush)

    ctx.onStop(() => {

      stopped = true
      timers.forEach((timer) => clearTimeout(timer))
      window.removeEventListener('fenrid:server-left', onLeft)
      document.removeEventListener('visibilitychange', flush)
    })
  },
})