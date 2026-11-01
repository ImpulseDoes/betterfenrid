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

export const getMessage = (id: string) => messages.get(id)
export const getChannel = (id: string) => channels.get(id)
export const getUser = (id: string) => users.get(id)

function classify(value: Entity) {

  const id = String(value.id)

  if ('created_at' in value && ('channel_id' in value || 'conversation_id' in value) && !('name' in value)) {

    messages.set(id, value)

  } else if ('username' in value) {

    users.set(id, value)

    // Copy User ID gives the public id, messages reference the internal one
    if (value.public_id != null) users.set(String(value.public_id), value)

  } else if (typeof value.name === 'string' && 'type' in value && ('server_id' in value || 'position' in value)) {

    channels.set(id, value)

  }
}

function index(value: unknown, depth = 0) {

  if (!value || typeof value !== 'object' || depth > MAX_DEPTH) return

  if (Array.isArray(value)) {

    for (const item of value) index(item, depth + 1)

    return
  }

  const entity = value as Entity

  if (typeof entity.id === 'string' || typeof entity.id === 'number') classify(entity)

  for (const child of Object.values(entity)) index(child, depth + 1)
}

export function startEntityCache() {

  onGatewayFrame((frame) => index(frame.d))
  onApiResponse((_, body) => index(body))
}