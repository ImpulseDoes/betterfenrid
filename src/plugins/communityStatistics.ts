import { openModal } from '../api/modal'
import { GatewayOp, onGatewayFrame, sendGatewayFrame } from '../api/network'
import { avatarUrl } from '../api/profiles'
import { toast } from '../api/toast'
import { h } from '../core/dom'
import { getUser } from '../core/entities'
import { definePlugin } from '../core/plugins'
import { Button } from '../ui/components'

const STATS_TIMEOUT_MS = 2_500
const CHANNEL_TYPE = { TEXT: 0, VOICE: 2, CATEGORY: 4 }

type Data = Record<string, any>

async function getJson(url: string): Promise<any> {

  try {

    const response = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } })

    return response.ok ? await response.json() : null

  } catch {

    return null

  }
}

function listFrom(data: any, key: string): Data[] | null {

  if (Array.isArray(data)) return data

  return Array.isArray(data?.[key]) ? data[key] : null
}

// Member counts only exist on the gateway, the same place Fenrid's server tooltip reads them from
function requestLiveStats(serverId: string): Promise<Data | null> {

  return new Promise((resolve) => {

    const finish = (stats: Data | null) => {

      clearTimeout(timer)
      off()
      resolve(stats)

    }

    const timer = setTimeout(() => finish(null), STATS_TIMEOUT_MS)

    const off = onGatewayFrame((frame) => {

      if (frame.t !== 'SERVER_STATS_UPDATE') return

      const stats = frame.d?.payload?.servers?.find((s: Data) => s.server_id === serverId)

      if (stats) finish(stats)

    })

    if (!sendGatewayFrame({ op: GatewayOp.REQUEST_SERVER_STATS, d: { server_ids: [serverId] } })) finish(null)
  })
}

async function loadStatistics(serverId: string) {

  const id = encodeURIComponent(serverId)

  const [channelData, roleData, emojiData, live] = await Promise.all([
    // intent=1 is what adds the server itself to the response
    getJson(`/api/servers/${id}/channels?intent=1`),
    getJson(`/api/servers/${id}/roles`),
    getJson(`/api/servers/${id}/emojis`),
    requestLiveStats(serverId),
  ])

  const server: Data = channelData?.sidebarServer ?? {}
  const ownerId = server.ownerId ?? server.owner_id
  const owner = ownerId ? (getUser(String(ownerId)) ?? (await getJson(`/api/users/${encodeURIComponent(ownerId)}`))) : null

  return {
    server,
    owner,
    live,
    channels: listFrom(channelData, 'channels'),
    roles: listFrom(roleData, 'roles'),
    emojis: listFrom(emojiData, 'emojis'),
  }
}

function count(value: number | undefined | null): string {
  return value == null ? '—' : new Intl.NumberFormat().format(value)
}

function Stat(label: string, value: string): Node {

  return h('div', { class: 'bf-stat' }, h('div', { class: 'bf-stat-value' }, value), h('div', { class: 'bf-stat-label' }, label))
}

function Detail(label: string, value: string): Node {

  return h('div', { class: 'bf-stat-detail' }, h('span', { class: 'bf-row-desc' }, label), h('span', {}, value))
}

function Statistics(serverId: string, { server, owner, live, channels, roles, emojis }: Awaited<ReturnType<typeof loadStatistics>>): Node {

  const ofType = (type: number) => channels?.filter((c) => c.type === type).length
  const iconUrl = server.iconUrl ?? server.image_url
  const ownerAvatar = avatarUrl(owner)
  const features: string[] = Array.isArray(server.features) ? server.features : []

  return h(
    'div',
    {},
    h(
      'div',
      { class: 'bf-stat-head' },
      iconUrl ? h('img', { class: 'bf-stat-icon', src: iconUrl, alt: '' }) : h('div', { class: 'bf-stat-icon' }),
      h('div', { class: 'bf-stat-name' }, server.name ?? 'Unknown community'),
    ),
    h(
      'div',
      { class: 'bf-stat-grid' },
      Stat('Members', count(live?.member_count)),
      Stat('Online', count(live?.online_count)),
      Stat('Text channels', count(ofType(CHANNEL_TYPE.TEXT))),
      Stat('Voice channels', count(ofType(CHANNEL_TYPE.VOICE))),
      Stat('Categories', count(ofType(CHANNEL_TYPE.CATEGORY))),
      Stat('Roles', count(roles?.length)),
      Stat('Emojis', count(emojis?.length)),
    ),
    h(
      'div',
      { class: 'bf-stat-details' },
      owner
        ? h(
          'div',
          { class: 'bf-stat-detail' },
          h('span', { class: 'bf-row-desc' }, 'Owner'),
          h('span', { class: 'bf-stat-owner' }, ownerAvatar ? h('img', { class: 'bf-reactor', src: ownerAvatar, alt: '' }) : null, owner.display_name ?? owner.username ?? 'Unknown'),
        )
        : null,
      server.created_at ? Detail('Created', new Date(server.created_at).toLocaleDateString()) : null,
      features.length ? Detail('Features', features.map((f) => f.toLowerCase().replaceAll('_', ' ')).join(', ')) : null,
      Detail('Community ID', serverId),
    ),
    channels ? null : h('p', { class: 'bf-row-desc' }, 'Fenrid didn\'t send some of this data, so those values are missing.'),
  )
}

export default definePlugin({
  id: 'communityStatistics',
  name: 'Community Statistics',
  description: 'Adds "Community Statistics" to the server menu, which shows the server\'s members, channels, roles and more.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    ctx.addContextMenuItem({
      id: 'statistics',
      label: 'Community Statistics',
      icon: 'stats',
      kinds: ['server'],
      action: async (target) => {

        if (!target.id) return toast('Could not read the server ID', 'error')

        const statistics = await loadStatistics(target.id)

        const close = openModal({
          title: 'Community Statistics',
          body: Statistics(target.id, statistics),
          footer: [Button('Close', () => close(), 'secondary')],
        })
      },
    })
  },
})