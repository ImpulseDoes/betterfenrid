import { h } from '../core/dom'
import { definePlugin, isEnabled } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'

const LINKS = 'bf-image-links'

// As Fenrid compares them: the same link with a different #fragment counts as the same link
function normalize(url: unknown): string | null {

  try {

    const parsed = new URL(String(url))

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

    parsed.hash = ''

    return parsed.toString()

  } catch {

    return null

  }
}

function hiddenLinks(list: Element, showGifs: boolean): string[] {

  const row = list.closest(Selectors.message) ?? list.parentElement!
  const shown = new Set(
    [...row.querySelectorAll('a[href]')]
      .filter((a) => !list.contains(a) && !a.closest(`.${LINKS}`))
      .map((a) => normalize(a.getAttribute('href'))),
  )

  const urls = [...list.children].flatMap((child) => {

    const embed = findProps(child, (p) => !!p.embed && typeof p.embed === 'object')?.embed

    if (!embed?.url) return []

    const isImage = embed.type === 'image' && !!embed.image?.url
    const isGif = embed.type === 'gifv' && !!embed.video?.url

    if (!isImage && !(isGif && showGifs)) return []

    // Fake Surge draws these as emojis, and the link is what it works from
    if (String(embed.url).startsWith(`${Selectors.cdn}/emojis/`) && isEnabled('fakeSurge')) return []

    const url = normalize(embed.url)

    return url && !shown.has(url) ? [String(embed.url)] : []
  })

  return [...new Set(urls)]
}

function sync(list: Element, showGifs: boolean) {

  const urls = hiddenLinks(list, showGifs)
  const existing = list.previousElementSibling?.matches(`.${LINKS}`) ? list.previousElementSibling : null
  const key = urls.join('\n')

  if ((existing?.getAttribute('data-urls') ?? '') === key) return

  existing?.remove()

  if (!urls.length) return

  list.before(
    h(
      'div',
      { class: LINKS, 'data-urls': key },
      ...urls.map((url) => h('a', { class: 'text-blue-500 hover:text-blue-600 hover:underline', href: url, target: '_blank', rel: 'noopener noreferrer' }, url)),
    ),
  )
}

// A list that went away (embeds suppressed, say) puts the link back in the text
function removeOrphans() {

  for (const el of document.querySelectorAll(`.${LINKS}`)) {

    if (!el.nextElementSibling?.matches(Selectors.embedList)) el.remove()

  }
}

function listsIn(root: Element): Element[] {

  const around = root.closest(Selectors.embedList)

  return around ? [around] : [...root.querySelectorAll(Selectors.embedList)]
}

export default definePlugin({
  id: 'imageLink',
  name: 'Image Link',
  description: 'Never hides image links in messages, even when the image is all the message has.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    showGifs: {
      type: 'boolean',
      label: 'Include GIFs',
      description: 'Also shows the link of every GIF, including the ones sent from the GIF picker.',
      default: false,
    },
  },

  start(ctx) {

    const syncAll = () => {

      if (!document.body) return

      removeOrphans()
      listsIn(document.body).forEach((list) => sync(list, ctx.settings.showGifs))
    }

    ctx.onDomChange((added) => {

      removeOrphans()

      for (const el of added) {

        if (el.closest(`.${LINKS}`)) continue

        listsIn(el).forEach((list) => sync(list, ctx.settings.showGifs))
      }
    })

    ctx.onSettingsChange(syncAll)
    ctx.onStop(() => document.querySelectorAll(`.${LINKS}`).forEach((el) => el.remove()))

    syncAll()
  },
})