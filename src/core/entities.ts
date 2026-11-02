import { onApiResponse, onGatewayFrame } from '../api/network'

type Entity = Record<string, any>

const LIMIT = 5000
const MAX_DEPTH = 8

// Newest last, so the oldest entry is always the first key
function createCache() {

  const entries = new Map<string, Entity>()

  return {
    get: (id: string) => entries.get(id) ?? null,
    set(id: string, value: Entity) {

      const merged = { ...entries.get(id), ...value }

      entries.delete(id)
      entries.set(id, merged)

      if (entries.size > LIMIT) entries.delete(entries.keys().next().value!)
    },
  }
}

const messages = createCache()
const channels = createCache()
const users = createCache()
const memberTimeouts = new Map<string, string | null>()

type EditHook = (id: string, before: Entity, after: Entity) => void

const editHooks = new Set<EditHook>()

/** Runs when a message's text changes, with the version seen before it */
export function onMessageEdit(hook: EditHook): () => void {

  editHooks.add(hook)

  return () => editHooks.delete(hook)
}

export const getMessage = (id: string) => messages.get(id)
export const getChannel = (id: string) => channels.get(id)
export const getUser = (id: string) => users.get(id)

/** When a member's timeout ends. Null means none, undefined that Fenrid hasn't sent it */
export const getMemberTimeout = (serverId: string, profileId: string) => memberTimeouts.get(`${serverId}:${profileId}`)

function rememberTimeout(value: Entity, serverId: string | undefined) {

  if (!serverId || typeof value.profile_id !== 'string' || !('communication_disabled_until' in value)) return

  const key = `${serverId}:${value.profile_id}`

  memberTimeouts.delete(key)
  memberTimeouts.set(key, value.communication_disabled_until ?? null)

  if (memberTimeouts.size > LIMIT) memberTimeouts.delete(memberTimeouts.keys().next().value!)
}

// A new edit time too, so a shortened copy of a message (in a reply preview, say) doesn't count
function isEdit(before: Entity, after: Entity): boolean {

  return typeof before.content === 'string' &&
    typeof after.content === 'string' &&
    before.content !== after.content &&
    after.edited_at != null &&
    after.edited_at !== before.edited_at &&
    !after.deleted_at
}

function classify(value: Entity) {

  const id = String(value.id)

  if ('created_at' in value && ('channel_id' in value || 'conversation_id' in value) && !('name' in value)) {

    const before = messages.get(id)

    messages.set(id, value)

    if (before && isEdit(before, value)) {

      const after = messages.get(id)!

      for (const hook of editHooks) {

        try {

          hook(id, before, after)

        } catch (err) {

          console.error('[Better Fenrid] Edit hook failed', err)

        }
      }
    }

  } else if ('username' in value) {

    users.set(id, value)

    // Copy User ID gives the public id, messages reference the internal one
    if (value.public_id != null) users.set(String(value.public_id), value)

  } else if (typeof value.name === 'string' && 'type' in value && ('server_id' in value || 'position' in value)) {

    channels.set(id, value)

  }
}

// A list of members names its server once, on the object around them
function index(value: unknown, parentServerId: string | undefined, depth = 0) {

  if (!value || typeof value !== 'object' || depth > MAX_DEPTH) return

  if (Array.isArray(value)) {

    for (const item of value) index(item, parentServerId, depth + 1)

    return
  }

  const entity = value as Entity
  const serverId = entity.server_id ?? entity.guild_id ?? parentServerId

  rememberTimeout(entity, serverId)

  if (typeof entity.id === 'string' || typeof entity.id === 'number') classify(entity)

  for (const child of Object.values(entity)) index(child, serverId, depth + 1)
}

export function startEntityCache() {

  onGatewayFrame((frame) => index(frame.d, frame.d?.topic?.match(/^guild:(\d+)/)?.[1]))
  onApiResponse((url, body) => index(body, url.pathname.match(/^\/api\/servers\/(\d+)/)?.[1]))
}