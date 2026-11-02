import type { MenuTarget } from '../api/contextMenu'
import { openModal } from '../api/modal'
import { toast } from '../api/toast'
import { h } from '../core/dom'
import { createLogger } from '../core/logger'
import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'
import { tooltip } from '../ui/tooltip'

const log = createLogger('Expression Manager')

const ADMINISTRATOR = 1n << 3n
const MANAGE_EXPRESSIONS = 1n << 30n
const CREATE_EXPRESSIONS = 1n << 43n
const MAX_BYTES = 262144
const RESIZED_PX = 128
const SERVER_CACHE_MS = 60_000
const REQUESTS_AT_ONCE = 4
const EMOJI_ID = /\/emojis\/([1-9][0-9]*)\.webp/
const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }
const STILL_TYPES = new Set(['image/png', 'image/jpeg'])

interface Expression {
  key: string
  name: string
  url: string
  fallbackUrl?: string
  preview: string
}

interface Server {
  id: string
  name: string
  image: string | null
}

let serverCache: { at: number; servers: Promise<Server[]> } | null = null

function cleanName(name: string): string {

  return name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 32)
}

function emojiFrom(img: HTMLImageElement): Expression | null {

  const id = img.src.startsWith(Selectors.cdn) ? img.src.match(EMOJI_ID)?.[1] : null

  if (!id) return null

  return {
    key: id,
    name: cleanName(img.alt.replace(/:/g, '')) || 'emoji',
    url: `${Selectors.cdn}/emojis/${id}.webp`,
    fallbackUrl: `${Selectors.cdn}/emojis/${id}.webp?size=128&animated=true`,
    preview: img.src,
  }
}

function mediaFrom(el: Element): Expression | null {

  const media = el.closest(Selectors.mediaEmbed)
  const embed = media && findProps(media, (p) => !!p.embed?.image?.url)?.embed
  const url = embed?.image?.url ?? (el instanceof HTMLImageElement ? el.src : null)

  if (!url || !/^https?:/.test(url)) return null

  const file = new URL(url).pathname.split('/').pop() ?? ''

  const name = cleanName(decodeURIComponent(file))

  return { key: url, name: name.length >= 2 ? name : 'gif', url, preview: url }
}

const unique = (list: Expression[]) => [...new Map(list.map((item) => [item.key, item])).values()]

const emojisIn = (root: Element) =>
  [...root.querySelectorAll<HTMLImageElement>('img')].flatMap((img) => emojiFrom(img) ?? [])

function expressionsAt({ source, element }: MenuTarget): Expression[] {

  const img = source?.closest('img') as HTMLImageElement | null | undefined
  const emoji = img && emojiFrom(img)

  if (emoji) return [emoji]

  const chip = source?.closest(Selectors.reactionChip)

  if (chip) return emojisIn(chip)

  const media = source && (source.closest(Selectors.mediaEmbed) || img) && mediaFrom(img ?? source)

  if (media) return [media]

  // Anywhere else on a message: whatever emojis it has
  return element ? unique(emojisIn(element)) : []
}

async function getJson(path: string): Promise<any> {

  const response = await fetch(path, { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })

  return response.ok ? response.json() : null
}

async function inBatches<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {

  const results: R[] = []

  for (let i = 0; i < items.length; i += REQUESTS_AT_ONCE) {

    results.push(...await Promise.all(items.slice(i, i + REQUESTS_AT_ONCE).map(run)))

  }

  return results
}

function canAddExpressions(permissions: unknown): boolean {

  try {

    const bits = BigInt(String(permissions))

    return (bits & (ADMINISTRATOR | MANAGE_EXPRESSIONS | CREATE_EXPRESSIONS)) !== 0n

  } catch {

    return false

  }
}

async function loadServers(): Promise<Server[]> {

  const bootstrap = await getJson('/api/sidebar/bootstrap')

  if (!bootstrap) throw new Error('Could not load your servers')

  const ids: string[] = (bootstrap.servers ?? []).map((server: any) => String(server?.id))

  const found = await inBatches(ids, async (id): Promise<Server | null> => {

    const encoded = encodeURIComponent(id)

    const [permissions, channels] = await Promise.all([
      getJson(`/api/servers/${encoded}/permissions`),
      // intent=1 is what adds the server itself to the response
      getJson(`/api/servers/${encoded}/channels?intent=1`),
    ])

    const server = channels?.sidebarServer
    const owner = server?.ownerId ?? server?.owner_id

    if (!canAddExpressions(permissions?.permissions) && (owner == null || String(owner) !== String(bootstrap.userId))) return null

    return { id, name: server?.name ?? id, image: server?.imageUrl ?? server?.iconUrl ?? server?.image_url ?? null }
  })

  return found.filter((server) => server !== null).sort((a, b) => a.name.localeCompare(b.name))
}

function serversYouCanAddTo(): Promise<Server[]> {

  if (serverCache && Date.now() - serverCache.at < SERVER_CACHE_MS) return serverCache.servers

  const servers = loadServers()

  serverCache = { at: Date.now(), servers }

  servers.catch(() => {
    serverCache = null
  })

  return servers
}

async function download(item: Expression): Promise<Blob> {

  for (const url of [item.url, item.fallbackUrl]) {

    if (!url) continue

    const response = await fetch(url, { credentials: 'omit' }).catch(() => null)

    if (response?.ok) return response.blob()
  }

  throw new Error('Fenrid can only copy files from its own storage, and this one is hosted elsewhere')
}

async function shrink(blob: Blob): Promise<Blob> {

  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, RESIZED_PX / Math.max(bitmap.width, bitmap.height))
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale))

  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return canvas.convertToBlob({ type: 'image/png' })
}

async function prepare(item: Expression): Promise<Blob> {

  const blob = await download(item)

  if (!EXTENSIONS[blob.type]) throw new Error(`Emojis can't be made from ${blob.type || 'this file type'}`)

  if (blob.size <= MAX_BYTES) return blob

  // Only still images can be shrunk here: redrawing a GIF would stop it moving
  if (STILL_TYPES.has(blob.type)) return shrink(blob)

  throw new Error(`Too big: ${Math.ceil(blob.size / 1024)} KiB, and emojis can be at most 256 KiB`)
}

async function clone(item: Expression, name: string, server: Server) {

  const blob = await prepare(item)
  const form = new FormData()

  form.set('file', new File([blob], `${name}.${EXTENSIONS[blob.type]}`, { type: blob.type }))
  form.set('name', name)

  const response = await fetch(`/api/servers/${encodeURIComponent(server.id)}/emojis`, { method: 'POST', credentials: 'include', body: form })

  if (response.ok) return

  const body = await response.json().catch(() => null)

  throw new Error(body?.error ?? `Fenrid refused the upload (${response.status})`)
}

function ServerButton(server: Server, onClick: () => void): Element {

  const initial = () => h('span', { class: 'bf-clone-initial' }, server.name.trim().charAt(0).toUpperCase() || '?')
  const button = h('button', { class: 'bf-clone-server', type: 'button', onClick })

  if (server.image) {

    const img = h('img', { src: server.image, alt: '', draggable: 'false' })

    img.addEventListener('error', () => img.replaceWith(initial()))
    button.append(img)

  } else {

    button.append(initial())

  }

  return tooltip(button, server.name)
}

function openCloneModal(items: Expression[]) {

  const names = items.map((item) => {

    const input = h('input', { class: 'bf-input bf-clone-name', value: item.name, maxlength: '32', 'aria-label': 'Emoji name' })

    return { item, input }
  })

  const rows = names.map(({ item, input }) =>
    h('div', { class: 'bf-clone-row' }, h('img', { class: 'bf-clone-preview', src: item.preview, alt: '' }), input),
  )

  const servers = h('div', { class: 'bf-clone-servers' }, h('p', { class: 'bf-clone-note' }, 'Loading your servers…'))

  const close = openModal({ title: items.length > 1 ? 'Clone Emojis' : 'Clone Emoji', body: h('div', { class: 'bf-clone' }, ...rows, servers) })

  const cloneTo = async (server: Server) => {

    servers.querySelectorAll('button').forEach((button) => button.setAttribute('disabled', ''))

    let done = 0
    const errors: string[] = []

    for (const { item, input } of names) {

      const name = cleanName(input.value)

      try {

        if (name.length < 2) throw new Error('Names need at least 2 letters, numbers or underscores')

        await clone(item, name, server)
        done++

      } catch (err) {

        log.error('Clone failed', err)
        errors.push(`${name || item.name}: ${(err as Error).message}`)

      }
    }

    if (done) toast(`Cloned ${done === 1 ? `:${cleanName(names[0].input.value)}:` : `${done} emojis`} to ${server.name}`)

    if (!errors.length) return close()

    servers.querySelectorAll('button').forEach((button) => button.removeAttribute('disabled'))
    errors.forEach((error) => toast(error, 'error'))
  }

  serversYouCanAddTo().then(
    (list) => {

      if (!list.length) return void servers.replaceChildren(h('p', { class: 'bf-clone-note' }, 'You can\'t add emojis to any of your servers.'))

      servers.replaceChildren(
        ...list.map((server) => ServerButton(server, () => void cloneTo(server))),
      )
    },
    (err) => {

      log.error('Could not list servers', err)
      servers.replaceChildren(h('p', { class: 'bf-clone-note' }, 'Could not load your servers.'))
    },
  )
}

export default definePlugin({
  id: 'expressionManager',
  name: 'Expression Manager',
  description: 'Right click an emoji, a reaction or a GIF to clone it to a server where you can add emojis.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    ctx.addContextMenuItem({
      id: 'clone',
      label: 'Clone Emoji',
      icon: 'plus',
      kinds: ['message'],
      visible: (target) => expressionsAt(target).length > 0,
      action: (target) => openCloneModal(expressionsAt(target)),
    })

    ctx.onStop(() => {
      serverCache = null
    })
  },
})