import { onApiRequestBody } from '../api/network'
import { currentUserId } from '../api/profiles'
import { toast } from '../api/toast'
import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'

const SEND_PATH = /^\/api\/(chat\/server\/messages(\/\d+)?|dm\/conversations\/[^/]+\/messages(\/\d+)?)$/
const ATTR = 'data-bf-color'
const HEX = /^#?([0-9a-f]{6})$/i
const TAG = 0xe0000
const RUN = /[\u{E0020}-\u{E007E}]+/gu
const MARKER = /^\{c#([0-9a-f]{6})\}$/i
const LIMITS = [2000, 4000, 6000, 8000]

const PRESETS: Record<string, { label: string; hex: string }> = {
  red: { label: 'Red', hex: '#ff6b6b' },
  orange: { label: 'Orange', hex: '#ffa94d' },
  gold: { label: 'Gold', hex: '#ffd43b' },
  green: { label: 'Green', hex: '#69db7c' },
  mint: { label: 'Mint', hex: '#38d9a9' },
  cyan: { label: 'Cyan', hex: '#3bc9db' },
  blue: { label: 'Blue', hex: '#74c0fc' },
  purple: { label: 'Purple', hex: '#b197fc' },
  pink: { label: 'Pink', hex: '#f783ac' },
}

const encode = (text: string) => String.fromCodePoint(...[...text].map((c) => TAG + c.charCodeAt(0)))
const decode = (run: string) => String.fromCharCode(...[...run].map((c) => c.codePointAt(0)! - TAG))

function readColor(text: string): string | null {

  for (const [run] of text.matchAll(RUN)) {

    const hex = decode(run).match(MARKER)?.[1]

    if (hex) return `#${hex.toLowerCase()}`
  }

  return null
}

function stripMarker(text: string): string {

  return text.replace(/ ?([\u{E0020}-\u{E007E}]+)/gu, (all, run: string) => (MARKER.test(decode(run)) ? '' : all))
}

const CSS = `
[${ATTR}],
[${ATTR}] *:not(a, a *, code, code *, pre, pre *, img, svg, svg *, ${Selectors.profileTrigger}, ${Selectors.profileTrigger} *, [class*="mention" i], [class*="mention" i] *) {
  color: var(--bf-message-color) !important;
}
`

export default definePlugin({
  id: 'messageColors',
  name: 'Message Colors',
  description: 'Writes your messages in a color you pick. Everyone with the plugin sees it, others see normal text.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    color: {
      type: 'select',
      label: 'Color',
      default: 'purple',
      options: [
        ...Object.entries(PRESETS).map(([value, { label, hex }]) => ({ label: `${label} (${hex})`, value })),
        { label: 'Custom', value: 'custom' },
      ],
    },
    customColor: {
      type: 'string',
      label: 'Custom color',
      description: 'Used when Color is Custom, as #RRGGBB.',
      placeholder: '#ff66cc',
      default: '#ff66cc',
    },
    shareColor: {
      type: 'boolean',
      label: 'Show my color to others',
      description: 'Adds a few invisible characters to the messages you send, so other Better Fenrid users see your color. Off: only you see it.',
      default: true,
    },
    showOthers: {
      type: 'boolean',
      label: 'Show other people\'s colors',
      default: true,
    },
  },

  start(ctx) {

    const ownColor = (): string | null => {

      if (ctx.settings.color !== 'custom') return PRESETS[ctx.settings.color]?.hex ?? null

      const hex = ctx.settings.customColor.trim().match(HEX)?.[1]

      return hex ? `#${hex.toLowerCase()}` : null
    }

    let me: string | null = null

    const myId = () => (me ??= currentUserId())

    ctx.addStyle(CSS)

    ctx.onStop(
      onApiRequestBody(({ url, method }, body) => {

        if (!SEND_PATH.test(url.pathname) || (method !== 'POST' && method !== 'PATCH') || typeof body?.content !== 'string') return

        const clean = stripMarker(body.content)
        const color = ctx.settings.shareColor ? ownColor() : null
        const text = clean.trimEnd()
        const skip = !color || !text || text.startsWith('/') || text.endsWith('```')
        const tagged = skip ? clean : `${text} ${encode(`{c#${color!.slice(1)}}`)}`
        const limit = LIMITS.find((l) => l >= clean.length) ?? 0
        const content = tagged.length <= limit ? tagged : clean

        return content === body.content ? undefined : { ...body, content }
      }),
    )

    const colorOf = (row: Element, content: Element): string | null => {

      const item = findProps(row, (props) => !!props.message && typeof props.message === 'object')
      const message = item?.message
      const author = message?.author_id != null ? String(message.author_id) : null
      const userId = item?.currentUserId != null ? String(item.currentUserId) : myId()

      if (author && author === userId) return ownColor()

      if (!ctx.settings.showOthers) return null

      return readColor(typeof message?.content === 'string' ? message.content : '') ?? readColor(content.textContent ?? '')
    }

    const paint = (row: Element) => {

      const content = row.querySelector<HTMLElement>(Selectors.messageContent)

      if (!content) return

      const color = colorOf(row, content)

      if (!color) {

        if (content.hasAttribute(ATTR)) {

          content.removeAttribute(ATTR)
          content.style.removeProperty('--bf-message-color')

        }

        return
      }

      if (content.getAttribute(ATTR) === color) return

      content.setAttribute(ATTR, color)
      content.style.setProperty('--bf-message-color', color)
    }

    const paintAll = () => document.querySelectorAll(Selectors.message).forEach(paint)

    ctx.onDomChange((added) => {

      const rows = new Set<Element>()

      for (const el of added) {

        const row = el.closest(Selectors.message)

        if (row) rows.add(row)

        el.querySelectorAll(Selectors.message).forEach((r) => rows.add(r))
      }

      rows.forEach(paint)
    })

    let warned = ''

    ctx.onSettingsChange(() => {

      const custom = ctx.settings.customColor.trim()

      if (ctx.settings.color === 'custom' && custom && !HEX.test(custom) && warned !== custom) {

        warned = custom
        toast('Custom color has to look like #ff66cc', 'error', 3000)

      }

      paintAll()
    })

    paintAll()

    ctx.onStop(() => {

      document.querySelectorAll<HTMLElement>(`[${ATTR}]`).forEach((el) => {

        el.removeAttribute(ATTR)
        el.style.removeProperty('--bf-message-color')
      })
    })
  },
})