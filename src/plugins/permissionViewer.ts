import type { MenuTarget } from '../api/contextMenu'
import { openModal } from '../api/modal'
import { memberOf } from '../api/profiles'
import { toast } from '../api/toast'
import { h } from '../core/dom'
import { getChannel, getUser } from '../core/entities'
import { definePlugin } from '../core/plugins'
import { Button } from '../ui/components'

type Data = Record<string, any>

const PERMISSIONS: [key: string, bit: number, label: string][] = [
  ['ADMINISTRATOR', 3, 'Administrator'],
  ['VIEW_CHANNEL', 10, 'View Channels'],
  ['MANAGE_CHANNELS', 4, 'Manage Channels'],
  ['MANAGE_ROLES', 28, 'Manage Roles'],
  ['MANAGE_GUILD', 5, 'Manage Server'],
  ['MANAGE_GUILD_EXPRESSIONS', 30, 'Manage Server Expressions'],
  ['CREATE_GUILD_EXPRESSIONS', 43, 'Create Server Expressions'],
  ['MANAGE_WEBHOOKS', 29, 'Manage Webhooks'],
  ['VIEW_AUDIT_LOG', 7, 'View Audit Log'],
  ['VIEW_GUILD_INSIGHTS', 19, 'View Server Insights'],
  ['MANAGE_SHARED_CHANNELS', 59, 'Manage Shared Channels'],
  ['CREATE_INSTANT_INVITE', 0, 'Create Instant Invite'],
  ['CHANGE_NICKNAME', 26, 'Change Nickname'],
  ['MANAGE_NICKNAMES', 27, 'Manage Nicknames'],
  ['KICK_MEMBERS', 1, 'Kick Members'],
  ['BAN_MEMBERS', 2, 'Ban Members'],
  ['MODERATE_MEMBERS', 40, 'Moderate Members'],
  ['SEND_MESSAGES', 11, 'Send Messages'],
  ['SEND_VOICE_MESSAGES', 46, 'Send Voice Messages'],
  ['SEND_POLLS', 49, 'Send Polls'],
  ['EMBED_LINKS', 14, 'Embed Links'],
  ['ATTACH_FILES', 15, 'Attach Files'],
  ['ADD_REACTIONS', 6, 'Add Reactions'],
  ['USE_EXTERNAL_EMOJIS', 18, 'Use External Emojis'],
  ['MENTION_EVERYONE', 17, 'Mention Everyone'],
  ['MANAGE_MESSAGES', 13, 'Manage Messages'],
  ['PIN_MESSAGES', 51, 'Pin Messages'],
  ['READ_MESSAGE_HISTORY', 16, 'Read Message History'],
  ['BYPASS_SLOWMODE', 52, 'Bypass Slowmode'],
  ['CONNECT', 20, 'Connect'],
  ['SPEAK', 21, 'Speak'],
  ['STREAM', 9, 'Video'],
  ['USE_EMBEDDED_ACTIVITIES', 39, 'Use Activities'],
  ['USE_SOUNDBOARD', 42, 'Use Soundboard'],
  ['USE_EXTERNAL_SOUNDS', 45, 'Use External Sounds'],
  ['USE_VAD', 25, 'Use Voice Activity'],
  ['PRIORITY_SPEAKER', 8, 'Priority Speaker'],
  ['MUTE_MEMBERS', 22, 'Mute Members'],
  ['DEAFEN_MEMBERS', 23, 'Deafen Members'],
  ['MOVE_MEMBERS', 24, 'Move Members'],
  ['SET_VOICE_CHANNEL_STATUS', 48, 'Set Voice Channel Status'],
  ['REQUEST_TO_SPEAK', 32, 'Request to Speak'],
  ['CREATE_EVENTS', 44, 'Create Events'],
  ['MANAGE_EVENTS', 33, 'Manage Events'],
  ['CREATE_GIVEAWAYS', 57, 'Create Giveaways'],
  ['MANAGE_GIVEAWAYS', 58, 'Manage Giveaways'],
  ['VIEW_LEADERBOARD', 56, 'View Leaderboard'],
]

const ADMINISTRATOR = 1n << 3n
const CACHE_MS = 30_000

const cache = new Map<string, { at: number; data: Promise<any> }>()

function getJson(url: string): Promise<any> {

  const hit = cache.get(url)

  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const data = fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } })
    .then(async (response) => (response.ok ? response.json() : { error: response.status }))
    .catch(() => ({ error: 0 }))

  cache.set(url, { at: Date.now(), data })

  return data
}

function bits(value: unknown): bigint {

  try {

    return value == null || value === '' ? 0n : BigInt(String(value))

  } catch {

    return 0n

  }
}

const has = (perms: bigint, bit: number) => (perms & (1n << BigInt(bit))) !== 0n

const isEveryone = (role: Data) => String(role.id) === String(role.server_id)

function listFrom(data: any, key: string): Data[] {
  return Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : []
}

function currentServerId(): string | null {
  return location.pathname.match(/^\/channels\/(\d+)/)?.[1] ?? null
}

async function loadRoles(serverId: string): Promise<Data[]> {

  const roles = listFrom(await getJson(`/api/servers/${serverId}/roles`), 'roles')

  return [...roles].sort((a, b) => (b.position ?? 0) - (a.position ?? 0))
}

function roleColor(role: Data): string {

  const color = typeof role.color === 'number' ? role.color : parseInt(String(role.color ?? '').replace('#', ''), 16)

  return color ? `#${color.toString(16).padStart(6, '0')}` : '#99aab5'
}

function RoleChip(role: Data): Element {

  const dot = h('span', { class: 'bf-role-dot' })

  dot.style.background = roleColor(role)

  return h('span', { class: 'bf-role-chip' }, dot, isEveryone(role) ? '@everyone' : role.name ?? 'Unknown role')
}

function PermissionRow(label: string, state: 'allow' | 'deny' | 'none', note?: string): Element {

  const mark = state === 'allow' ? '✓' : state === 'deny' ? '✕' : '–'

  return h(
    'div',
    { class: `bf-perm bf-perm-${state}` },
    h('span', { class: 'bf-perm-mark', 'aria-hidden': 'true' }, mark),
    h('span', { class: 'bf-perm-label' }, label),
    note ? h('span', { class: 'bf-perm-note' }, note) : null,
  )
}

function Search(list: Element): Element {

  return h('input', {
    class: 'bf-input bf-perm-search',
    type: 'search',
    placeholder: 'Search permissions…',
    onInput: (e: Event) => {

      const query = (e.target as HTMLInputElement).value.trim().toLowerCase()

      for (const row of list.querySelectorAll<HTMLElement>('.bf-perm')) {

        row.hidden = !!query && !row.textContent?.toLowerCase().includes(query)

      }
    },
  })
}

function show(title: string, ...body: (Node | null)[]) {

  const close = openModal({
    title,
    body: h('div', { class: 'bf-perms' }, ...body),
    footer: [Button('Close', () => close(), 'secondary')],
  })
}

const note = (text: string) => h('p', { class: 'bf-row-desc' }, text)

async function memberRoleIds(serverId: string, member: Data): Promise<string[]> {

  if (Array.isArray(member.assignedRoleIds)) return member.assignedRoleIds.map(String)

  if (member.id == null) return []

  return listFrom(await getJson(`/api/servers/${serverId}/members/${member.id}/roles`), 'roles').map((entry) => String(entry.role_id ?? entry.id))
}

async function showMember(target: MenuTarget) {

  const member = target.source ? memberOf(target.source) : null
  const serverId = member?.serverId ?? currentServerId()

  if (!serverId) return toast('Open this inside a server', 'error')

  if (!member) {

    return show('Permissions', note('Fenrid didn\'t pass the member here. Right-click their name in the chat or the member list instead.'))

  }

  const [allRoles, assigned] = await Promise.all([loadRoles(serverId), memberRoleIds(serverId, member)])
  const roles = allRoles.filter((role) => isEveryone(role) || assigned.includes(String(role.id)))
  const owner = member.isServerOwner === true
  const total = roles.reduce((sum, role) => sum | bits(role.permissions), 0n)
  const admin = owner || (total & ADMINISTRATOR) !== 0n
  const name = member.profiles?.display_name ?? member.profiles?.username ?? getUser(String(member.profile_id))?.username ?? 'this member'

  const list = h(
    'div',
    { class: 'bf-perm-list' },
    ...PERMISSIONS.map(([, bit, label]) => {

      const from = roles.filter((role) => has(bits(role.permissions), bit)).map((role) => (isEveryone(role) ? '@everyone' : role.name))

      if (owner) return PermissionRow(label, 'allow', 'Server owner')
      if (from.length) return PermissionRow(label, 'allow', from.join(', '))
      if (admin) return PermissionRow(label, 'allow', 'Administrator')

      return PermissionRow(label, 'none')
    }),
  )

  show(
    `Permissions of ${name}`,
    allRoles.length ? null : note('Fenrid didn\'t send the server\'s roles.'),
    owner ? note('Server owners have every permission.') : admin ? note('Administrator grants every permission.') : null,
    h('div', { class: 'bf-role-chips' }, ...roles.map(RoleChip)),
    Search(list),
    list,
  )
}

async function showServer(target: MenuTarget) {

  const serverId = target.id ?? currentServerId()

  if (!serverId) return toast('Could not read the server ID', 'error')

  const roles = await loadRoles(serverId)

  if (!roles.length) return show('Server roles', note('Fenrid didn\'t send this server\'s roles.'))

  const sections = roles.map((role) => {

    const perms = bits(role.permissions)
    const granted = PERMISSIONS.filter(([, bit]) => has(perms, bit))

    return h(
      'details',
      { class: 'bf-perm-role' },
      h('summary', {}, RoleChip(role), h('span', { class: 'bf-perm-note' }, (perms & ADMINISTRATOR) !== 0n ? 'Administrator' : `${granted.length} permissions`)),
      h('div', { class: 'bf-perm-list' }, ...(granted.length ? granted.map(([, , label]) => PermissionRow(label, 'allow')) : [note('No permissions.')])),
    )
  })

  show('Server roles', note('From the highest role down. Open one to see what it allows.'), ...sections)
}

async function showChannel(target: MenuTarget) {

  if (!target.id) return toast(`Could not read the ${target.kind} ID`, 'error')

  const channel = getChannel(target.id)
  const serverId = channel?.server_id ? String(channel.server_id) : currentServerId()
  const [data, roles] = await Promise.all([getJson(`/api/channels/${target.id}/overwrites`), serverId ? loadRoles(serverId) : Promise.resolve([])])
  const title = `Permissions of ${channel?.name ? (target.kind === 'category' ? channel.name : `#${channel.name}`) : `this ${target.kind}`}`

  if (data?.error) {

    return show(title, note(data.error === 403 ? 'You need the Manage Roles or Manage Channels permission to see this.' : 'Fenrid didn\'t send this channel\'s permissions.'))

  }

  const overwrites = listFrom(data, 'overwrites')

  if (!overwrites.length) {

    return show(title, note(`Nothing is changed here, so everyone has their usual server permissions${channel?.parent_id ? ' (or the category\'s)' : ''}.`))

  }

  const sections = overwrites.map((overwrite) => {

    const allow = bits(overwrite.allow)
    const deny = bits(overwrite.deny)
    const role = overwrite.target_type === 'role' ? roles.find((r) => String(r.id) === String(overwrite.target_role_id)) : null
    const user = overwrite.target_type === 'member' ? getUser(String(overwrite.target_profile_id)) : null

    const who = role
      ? RoleChip(role)
      : h('span', { class: 'bf-role-chip' }, user?.display_name ?? user?.username ?? (overwrite.target_type === 'member' ? 'A member' : 'Unknown role'))

    const rows = PERMISSIONS
      .filter(([, bit]) => has(allow, bit) || has(deny, bit))
      .map(([, bit, label]) => PermissionRow(label, has(allow, bit) ? 'allow' : 'deny'))

    return h(
      'details',
      { class: 'bf-perm-role', open: true },
      h('summary', {}, who, h('span', { class: 'bf-perm-note' }, `${rows.length} changed`)),
      h('div', { class: 'bf-perm-list' }, ...(rows.length ? rows : [note('Nothing changed.')])),
    )
  })

  show(title, note('✓ allowed here, ✕ denied here. Anything not listed follows the server permissions.'), ...sections)
}

export default definePlugin({
  id: 'permissionViewer',
  name: 'Permission Viewer',
  description: 'Adds "Permissions" to the user, server, channel and category menus: see a member\'s permissions and which roles give them, every role\'s permissions, and what a channel changes.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    ctx.addContextMenuItem({
      id: 'permissions',
      label: 'Permissions',
      icon: 'lock',
      kinds: ['user', 'server', 'channel', 'category'],
      visible: (target) => target.kind !== 'user' || !!currentServerId(),
      action: (target) => {

        const run = target.kind === 'user' ? showMember : target.kind === 'server' ? showServer : showChannel

        run(target).catch((err) => {

          ctx.log.error('Could not show permissions', err)
          toast('Could not load the permissions', 'error')

        })
      },
    })
  },
})