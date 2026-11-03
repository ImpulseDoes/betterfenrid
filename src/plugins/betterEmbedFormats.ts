import { toast } from '../api/toast'
import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'
import { tooltip } from '../ui/tooltip'
import css from '../ui/polish/embeds.css'

const CARD = 'bf-embed'
const HIDDEN = 'data-bf-embed-hidden'
const KEY = 'data-bf-embed-key'

const SVG = 'http://www.w3.org/2000/svg'

const PATHS = {
  play: 'M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z',
  preview: 'M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18a1 1 0 0 0 0-1.68L9.54 5.98A1 1 0 0 0 8 6.82z',
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  spotify:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.58 14.43a.62.62 0 0 1-.85.23c-2.33-1.43-5.27-1.75-8.73-.96a.62.62 0 1 1-.28-1.22c3.78-.86 7.01-.49 9.58 1.11a.62.62 0 0 1 .28.84zm1.22-2.72a.78.78 0 0 1-1.07.27c-2.67-1.64-6.74-2.12-9.9-1.16a.78.78 0 0 1-.46-1.49c3.63-1.1 8.12-.56 11.19 1.32a.78.78 0 0 1 .24 1.06zm.1-2.84C15.07 8.99 8.83 8.78 5.7 9.73a.94.94 0 1 1-.55-1.8c3.6-1.1 10.18-.89 14.2 1.51a.94.94 0 1 1-.95 1.61z',
  youtube:
    'M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.8 15.6V8.4L15.8 12l-6 3.6z',
  github: 'M12 .5A11.5 11.5 0 0 0 8 22.9c.6.1.8-.2.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0C17.3 3.7 18.3 4 18.3 4c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A11.5 11.5 0 0 0 12 .5z',
  star: 'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  fork: 'M6 3a3 3 0 0 1 1 5.83V10c0 1.1.9 2 2 2h3v1.17A3 3 0 1 1 10 16.8V14H9c-2.2 0-4-1.8-4-4V8.83A3 3 0 0 1 6 3zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm12 10a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
}

type Site = 'spotify' | 'youtube' | 'github'

interface Media {
  site: Site
  key: string
  url: string
  title: string
  subtitle: string
  image: string
  spotify?: { type: string; id: string }
  youtube?: { id: string }
  github?: { owner: string; repo: string }
}

const oembed = new Map<string, Promise<{ title?: string; thumbnail?: string } | null>>()
const repos = new Map<string, Promise<{ description?: string; stars?: number; forks?: number; language?: string; image?: string } | null>>()

function icon(name: keyof typeof PATHS, size = 16): SVGSVGElement {

  const el = document.createElementNS(SVG, 'svg')
  const path = document.createElementNS(SVG, 'path')

  el.setAttribute('viewBox', '0 0 24 24')
  el.setAttribute('width', String(size))
  el.setAttribute('height', String(size))
  el.setAttribute('fill', 'currentColor')
  el.setAttribute('aria-hidden', 'true')
  path.setAttribute('d', PATHS[name])
  el.append(path)

  return el
}

function textOf(value: unknown): string {

  return typeof value === 'string' ? value.trim() : ''
}

function imageOf(embed: Record<string, any>): string {

  return textOf(embed.thumbnail?.url) || textOf(embed.image?.url) || textOf(embed.images?.[0]?.url)
}

function parseSpotify(url: URL): Media | null {

  const match = url.pathname.match(/\/(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/)

  if (!/(^|\.)spotify\.com$/.test(url.hostname) || !match) return null

  const [, type, id] = match
  const page = `https://open.spotify.com/${type}/${id}`
  const kind = type === 'track' || type === 'episode' ? 'Spotify' : type.charAt(0).toUpperCase() + type.slice(1)

  return { site: 'spotify', key: `spotify:${type}:${id}`, url: page, title: '', subtitle: kind, image: '', spotify: { type, id } }
}

function parseYouTube(url: URL): Media | null {

  const host = url.hostname.replace(/^www\./, '')
  let id = ''

  if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] ?? ''
  else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {

    id = url.searchParams.get('v') || (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/') ? url.pathname.split('/')[2] ?? '' : '')
  }

  if (!id || id.length < 11) return null

  id = id.slice(0, 11)

  return {
    site: 'youtube',
    key: `youtube:${id}`,
    url: `https://www.youtube.com/watch?v=${id}`,
    title: '',
    subtitle: 'YouTube',
    image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    youtube: { id },
  }
}

function parseGitHub(url: URL): Media | null {

  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null

  const [owner, repo] = url.pathname.split('/').filter(Boolean)

  if (!owner || !repo || owner === 'orgs' || owner === 'settings') return null

  return {
    site: 'github',
    key: `github:${owner}/${repo}`,
    url: `https://github.com/${owner}/${repo}`,
    title: `${owner}/${repo}`,
    subtitle: 'GitHub',
    image: `https://github.com/${owner}.png?size=80`,
    github: { owner, repo },
  }
}

function fromUrl(raw: string, extra: Partial<Pick<Media, 'title' | 'subtitle' | 'image'>> = {}): Media | null {

  let url: URL

  try {

    url = new URL(raw)

  } catch {

    return null

  }

  const parsed = parseSpotify(url) ?? parseYouTube(url) ?? parseGitHub(url)

  if (!parsed) return null

  if (extra.title) parsed.title = extra.title
  if (extra.subtitle) parsed.subtitle = extra.subtitle
  if (extra.image) parsed.image = extra.image

  return parsed
}

function splitSpotify(title: string, description: string): { title: string; subtitle: string } {

  const lyrics = title.match(/^(.*?)\s+[-–]\s+song and lyrics by\s+(.+?)(?:\s+\|\s+Spotify)?$/i)

  if (lyrics) return { title: lyrics[1].trim(), subtitle: lyrics[2].trim() }

  const dotted = title.split(/\s+[·•]\s+/)

  if (dotted.length >= 2) return { title: dotted[0].trim(), subtitle: dotted.slice(1).join(' · ').replace(/\s+\|\s+Spotify$/i, '').trim() }

  const named = title.replace(/\s+\|\s+Spotify$/i, '').trim()
  const artist = description.split(/\s+[·•|]\s+/)[0]?.trim()

  return { title: named || title, subtitle: artist && artist !== named ? artist : 'Spotify' }
}

function mediaFromEmbed(embed: Record<string, any>): Media | null {

  const url = textOf(embed.url) || textOf(embed.media?.url)
  const media = fromUrl(url)

  if (!media) return null

  const title = textOf(embed.title) || textOf(embed.author?.name)
  const description = textOf(embed.description)

  if (media.site === 'spotify') Object.assign(media, splitSpotify(title, description))
  else {

    if (title) media.title = title
    if (description) media.subtitle = description.split('\n')[0] ?? media.subtitle

  }

  const image = imageOf(embed)

  if (image) media.image = image

  return media
}

function embedOn(el: Element): Record<string, any> | null {

  const nodes = [el, ...el.querySelectorAll('*')]

  for (const node of nodes.slice(0, 16)) {

    const embed = findProps(node, (p) => p.embed && typeof p.embed === 'object')?.embed

    if (embed && typeof embed === 'object') return embed
  }

  return null
}

function mediaOf(el: Element): Media | null {

  const embed = embedOn(el)

  if (embed) {

    const media = mediaFromEmbed(embed)

    if (media) return media
  }

  for (const link of el.querySelectorAll('a[href]')) {

    const media = fromUrl(link.getAttribute('href') ?? '')

    if (media) {

      if (!media.title) media.title = textOf(link.textContent) || media.title

      return media
    }
  }

  return null
}

function spotifyMeta(url: string) {

  const hit = oembed.get(url)

  if (hit) return hit

  const pending = fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (data ? { title: textOf(data.title), thumbnail: textOf(data.thumbnail_url) } : null))
    .catch(() => null)

  oembed.set(url, pending)

  return pending
}

function githubMeta(owner: string, repo: string) {

  const key = `${owner}/${repo}`
  const hit = repos.get(key)

  if (hit) return hit

  const pending = fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: { Accept: 'application/vnd.github+json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => data && {
      description: textOf(data.description),
      stars: Number(data.stargazers_count) || 0,
      forks: Number(data.forks_count) || 0,
      language: textOf(data.language),
      image: textOf(data.owner?.avatar_url),
    })
    .catch(() => null)

  repos.set(key, pending)

  return pending
}

function copy(url: string) {

  void navigator.clipboard.writeText(url).then(
    () => toast('Link copied', 'success'),
    () => toast('Could not copy the link', 'error'),
  )
}

function closePlayers(except?: Element) {

  for (const card of document.querySelectorAll(`.${CARD}`)) {

    if (card === except) continue

    const player = card.querySelector<HTMLElement>(`.${CARD}-player`)
    const preview = card.querySelector<HTMLElement>(`.${CARD}-preview`)

    if (player) {

      player.hidden = true
      player.replaceChildren()
    }

    preview?.setAttribute('aria-pressed', 'false')
  }
}

function iframe(src: string, title: string): HTMLIFrameElement {

  const frame = document.createElement('iframe')

  frame.src = src
  frame.title = title
  frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'
  frame.loading = 'lazy'
  frame.referrerPolicy = 'strict-origin-when-cross-origin'

  return frame
}

function fill(card: HTMLElement, media: Media) {

  const title = card.querySelector(`.${CARD}-title`)
  const sub = card.querySelector(`.${CARD}-sub`)
  const img = card.querySelector<HTMLImageElement>(`.${CARD}-cover img, .${CARD}-thumb img`)

  if (title && media.title) title.textContent = media.title
  if (sub && media.subtitle) sub.textContent = media.subtitle
  if (img && media.image && img.src !== media.image) img.src = media.image
}

function enrich(card: HTMLElement, media: Media) {

  if (media.site === 'spotify') {

    void spotifyMeta(media.url).then((data) => {

      if (!data || !card.isConnected) return

      if (!media.title && data.title) media.title = data.title
      if (!media.image && data.thumbnail) media.image = data.thumbnail

      fill(card, media)
    })
  }

  if (media.site === 'github' && media.github) {

    void githubMeta(media.github.owner, media.github.repo).then((data) => {

      if (!data || !card.isConnected) return

      if (data.description) media.subtitle = data.description
      if (data.image) media.image = data.image

      fill(card, media)

      const meta = card.querySelector(`.${CARD}-meta`)

      if (!meta) return

      meta.replaceChildren(
        ...(data.language ? [h('span', {}, data.language)] : []),
        h('span', {}, icon('star', 12), String(data.stars ?? 0)),
        h('span', {}, icon('fork', 12), String(data.forks ?? 0)),
      )
    })
  }
}

function spotifyCard(media: Media): HTMLElement {

  const player = h('div', { class: `${CARD}-player`, hidden: true })

  const preview = tooltip(
    h(
      'button',
      {
        class: `${CARD}-preview`,
        type: 'button',
        'aria-pressed': 'false',
        onClick: () => {

          const open = player.hidden

          closePlayers(open ? preview.closest(`.${CARD}`) ?? undefined : undefined)

          if (!open || !media.spotify) {

            player.hidden = true
            player.replaceChildren()
            preview.setAttribute('aria-pressed', 'false')

            return
          }

          player.hidden = false
          preview.setAttribute('aria-pressed', 'true')
          player.replaceChildren(iframe(`https://open.spotify.com/embed/${media.spotify.type}/${media.spotify.id}?utm_source=generator&theme=0`, media.title || 'Spotify'))
        },
      },
      icon('preview', 12),
      'Preview',
    ),
    'Play a preview',
  )

  const add = tooltip(h('button', { class: `${CARD}-icon`, type: 'button', onClick: () => copy(media.url) }, icon('plus', 16)), 'Copy link')
  const more = tooltip(h('a', { class: `${CARD}-icon`, href: media.url, target: '_blank', rel: 'noopener noreferrer' }, icon('more', 16)), 'Open')

  const play = tooltip(
    h('a', { class: `${CARD}-play`, href: media.url, target: '_blank', rel: 'noopener noreferrer' }, icon('play', 16)),
    'Play on Spotify',
  )

  const card = h(
    'div',
    { class: `${CARD} ${CARD}-spotify`, [KEY]: media.key },
    h(
      'div',
      { class: `${CARD}-row` },
      h('a', { class: `${CARD}-cover`, href: media.url, target: '_blank', rel: 'noopener noreferrer' }, h('img', { alt: '', src: media.image || 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=' })),
      h(
        'div',
        { class: `${CARD}-body` },
        h(
          'div',
          { class: `${CARD}-top` },
          h(
            'div',
            { class: `${CARD}-copy` },
            h('a', { class: `${CARD}-title`, href: media.url, target: '_blank', rel: 'noopener noreferrer' }, media.title || 'Spotify'),
            h('div', { class: `${CARD}-sub` }, media.subtitle || 'Spotify'),
          ),
          h('span', { class: `${CARD}-brand` }, icon('spotify', 16)),
        ),
        h('div', { class: `${CARD}-actions` }, preview, add, more),
      ),
      play,
    ),
    player,
  )

  enrich(card, media)

  return card
}

function youtubeCard(media: Media): HTMLElement {

  const player = h('div', { class: `${CARD}-player`, hidden: true })
  const thumb = h(
    'button',
    {
      class: `${CARD}-thumb`,
      type: 'button',
      onClick: () => {

        if (!media.youtube || !player.hidden) return

        closePlayers()
        thumb.hidden = true
        player.hidden = false
        player.replaceChildren(iframe(`https://www.youtube-nocookie.com/embed/${media.youtube.id}?autoplay=1`, media.title || 'YouTube'))
      },
    },
    h('img', { alt: '', src: media.image }),
    h('div', { class: `${CARD}-thumb-play` }, h('span', {}, icon('play', 28))),
  )

  const card = h(
    'div',
    { class: `${CARD} ${CARD}-youtube`, [KEY]: media.key },
    thumb,
    player,
    h(
      'div',
      { class: `${CARD}-body` },
      h(
        'div',
        { class: `${CARD}-top` },
        h(
          'div',
          { class: `${CARD}-copy` },
          h('a', { class: `${CARD}-title`, href: media.url, target: '_blank', rel: 'noopener noreferrer' }, media.title || 'YouTube'),
          h('div', { class: `${CARD}-sub` }, media.subtitle || 'YouTube'),
        ),
        h('span', { class: `${CARD}-brand` }, icon('youtube', 20)),
      ),
    ),
  )

  return card
}

function githubCard(media: Media): HTMLElement {

  const card = h(
    'div',
    { class: `${CARD} ${CARD}-github`, [KEY]: media.key },
    h(
      'div',
      { class: `${CARD}-row` },
      h('a', { class: `${CARD}-cover`, href: media.url, target: '_blank', rel: 'noopener noreferrer' }, h('img', { alt: '', src: media.image })),
      h(
        'div',
        { class: `${CARD}-copy` },
        h(
          'div',
          { class: `${CARD}-top` },
          h('a', { class: `${CARD}-title`, href: media.url, target: '_blank', rel: 'noopener noreferrer' }, media.title),
          h('span', { class: `${CARD}-brand` }, icon('github', 16)),
        ),
        h('div', { class: `${CARD}-sub` }, media.subtitle || 'GitHub'),
        h('div', { class: `${CARD}-meta` }),
      ),
    ),
  )

  enrich(card, media)

  return card
}

function render(media: Media): HTMLElement {

  if (media.site === 'spotify') return spotifyCard(media)
  if (media.site === 'youtube') return youtubeCard(media)

  return githubCard(media)
}

function allowed(media: Media, settings: { spotify: boolean; youtube: boolean; github: boolean }) {

  return settings[media.site]
}

function mount(host: Element, media: Media, hide?: Element) {

  const existing = host.matches(`.${CARD}`) ? host : host.querySelector(`:scope > .${CARD}[${KEY}="${CSS.escape(media.key)}"]`)

  if (existing instanceof HTMLElement && existing.getAttribute(KEY) === media.key) {

    hide?.setAttribute(HIDDEN, '')

    return
  }

  hide?.setAttribute(HIDDEN, '')
  hide ? hide.before(render(media)) : host.append(render(media))
}

export default definePlugin({
  id: 'betterEmbedFormats',
  name: 'Better Embed Formats',
  description: 'Turns Spotify, YouTube and GitHub links into Discord-style cards: a Spotify player, a YouTube video you can play, and a GitHub repo card.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,
  settings: {
    spotify: {
      type: 'boolean',
      label: 'Spotify',
      description: 'Player card with artwork, preview and a play button, like Discord.',
      default: true,
    },
    youtube: {
      type: 'boolean',
      label: 'YouTube',
      description: 'Thumbnail with a play button that opens the video in the message.',
      default: true,
    },
    github: {
      type: 'boolean',
      label: 'GitHub',
      description: 'Repository card with the description, stars and language.',
      default: true,
    },
  },

  start(ctx) {

    const listsIn = (root: Element) => {

      const around = root.closest(Selectors.embedList)

      return around ? [around] : [...root.querySelectorAll(Selectors.embedList)]
    }

    const messagesIn = (root: Element) => {

      const around = root.closest(Selectors.message)

      return around ? [around] : [...root.querySelectorAll(Selectors.message)]
    }

    const syncList = (list: Element) => {

      for (const child of [...list.children]) {

        if (child.classList.contains(CARD)) continue

        const media = mediaOf(child)

        if (!media || !allowed(media, ctx.settings)) {

          if (child.hasAttribute(HIDDEN) && child.previousElementSibling?.classList.contains(CARD)) {

            child.previousElementSibling.remove()
            child.removeAttribute(HIDDEN)
          }

          continue
        }

        const prev = child.previousElementSibling

        if (prev instanceof HTMLElement && prev.classList.contains(CARD) && prev.getAttribute(KEY) !== media.key) prev.remove()

        mount(list, media, child)
      }
    }

    const syncMessage = (message: Element) => {

      const seen = new Set([...message.querySelectorAll(`[${KEY}]`)].map((el) => el.getAttribute(KEY)))
      const content = message.querySelector(Selectors.messageContent) ?? message
      const host = message.querySelector(Selectors.embedList) ?? content

      for (const link of content.querySelectorAll('a[href]')) {

        if (link.closest(`.${CARD}`)) continue

        const media = fromUrl(link.getAttribute('href') ?? '', { title: textOf(link.textContent) })

        if (!media || !allowed(media, ctx.settings) || seen.has(media.key)) continue

        seen.add(media.key)
        host.after(render(media))
      }
    }

    const sync = (root: Element) => {

      listsIn(root).forEach(syncList)
      messagesIn(root).forEach(syncMessage)
    }

    ctx.addStyle(css)
    ctx.onDomChange((added) => {

      for (const el of added) {

        if (el.closest(`.${CARD}`)) continue

        sync(el)
      }
    })
    
    ctx.onSettingsChange(() => {

      document.querySelectorAll(`.${CARD}`).forEach((el) => el.remove())
      document.querySelectorAll(`[${HIDDEN}]`).forEach((el) => el.removeAttribute(HIDDEN))

      if (document.body) sync(document.body)
    
      })
    
    ctx.onStop(() => {

      closePlayers()
      document.querySelectorAll(`.${CARD}`).forEach((el) => el.remove())
      document.querySelectorAll(`[${HIDDEN}]`).forEach((el) => el.removeAttribute(HIDDEN))
      
    })

    if (document.body) sync(document.body)
  },
})