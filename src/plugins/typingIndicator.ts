import { onGatewayFrame } from '../api/network'
import { currentUserId } from '../api/profiles'
import { retainTopic } from '../api/topics'
import { h } from '../core/dom'
import { getChannel } from '../core/entities'
import { definePlugin } from '../core/plugins'
import { Selectors } from '../core/selectors'

const DOTS = 'bf-typing'
const EXPIRE_MS = 10_000
const SWEEP_MS = 1_000
const MAX_CHANNELS = 50
const NOT_TEXT = new Set([2, 4])
const ROW_PATH = /^\/channels\/(\d+)\/(\d+)$/

interface Typer {
  name: string
  expires: number
}

function route(): { server: string | null; channel: string | null } {

  const [, server = null, channel = null] = location.pathname.match(/^\/channels\/(\d+)(?:\/(\d+))?/) ?? []

  return { server, channel }
}

function channelRows(server: string): Map<string, HTMLAnchorElement> {

  const rows = new Map<string, HTMLAnchorElement>()

  for (const link of document.querySelectorAll<HTMLAnchorElement>(Selectors.channelLink)) {

    const [, rowServer, channel] = link.getAttribute('href')?.match(ROW_PATH) ?? []

    if (!channel || rowServer !== server || link.closest(`${Selectors.message}, .bf-root`)) continue

    if (!NOT_TEXT.has(getChannel(channel)?.type)) rows.set(channel, link)
  }

  return rows
}

function describe(names: string[]): string {

  if (names.length === 1) return `${names[0]} is typing…`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]} are typing…`

  return 'Several people are typing…'
}

function Dots(title: string): Element {
  return h('span', { class: DOTS, title, 'aria-label': title, role: 'img' }, h('i'), h('i'), h('i'))
}

export default definePlugin({
  id: 'typingIndicator',
  name: 'Typing in Channel List',
  description: 'Shows animated dots next to channels in the sidebar where someone is typing.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,
  settings: {
    showCurrent: {
      type: 'boolean',
      label: 'Show for the open channel',
      description: 'Fenrid already shows who is typing under the message box there.',
      default: false,
    },
  },

  start(ctx) {

    const typing = new Map<string, Map<string, Typer>>()
    const held = new Map<string, () => void>()

    const release = (channel: string) => {

      held.get(channel)?.()
      held.delete(channel)
      typing.delete(channel)

    }

    const render = () => {

      const { server, channel: open } = route()
      const me = currentUserId()
      const rows = server ? channelRows(server) : new Map<string, HTMLAnchorElement>()

      for (const dots of document.querySelectorAll(`.${DOTS}`)) {

        const link = dots.closest('a')
        const id = link?.getAttribute('href')?.match(ROW_PATH)?.[2]

        if (!id || rows.get(id) !== link) dots.remove()

      }

      for (const [id, row] of rows) {

        const names = [...(typing.get(id)?.entries() ?? [])].filter(([user]) => user !== me).map(([, typer]) => typer.name)
        const existing = row.querySelector(`.${DOTS}`)

        if (!names.length || (id === open && !ctx.settings.showCurrent)) {

          existing?.remove()

          continue
        }

        const title = describe(names)

        if (existing) {

          if (existing.getAttribute('title') !== title) existing.replaceWith(Dots(title))

          continue
        }

        const name = row.querySelector(Selectors.channelName)

        if (name) name.after(Dots(title))
        else row.append(Dots(title))
      }
    }

    const sync = () => {

      const { server } = route()
      const wanted = new Set(server ? [...channelRows(server).keys()].slice(0, MAX_CHANNELS) : [])

      for (const channel of [...held.keys()]) {

        if (!wanted.has(channel)) release(channel)

      }

      for (const channel of wanted) {

        if (!held.has(channel)) held.set(channel, retainTopic(`typing:channel:${channel}`))

      }
    }

    const update = (channel: string, user: string, typer: Typer | null) => {

      const users = typing.get(channel) ?? new Map<string, Typer>()

      if (typer) users.set(user, typer)
      else users.delete(user)

      if (users.size) typing.set(channel, users)
      else typing.delete(channel)

      render()
    }

    ctx.onStop(
      onGatewayFrame((frame) => {

        const topic: unknown = frame.d?.topic
        const payload = frame.d?.payload

        if (typeof topic !== 'string') return

        if (frame.t === 'TYPING_START' || frame.t === 'TYPING_STOP') {

          const channel = topic.match(/^typing:channel:(\d+)$/)?.[1]
          const user = payload?.user_id

          if (!channel || typeof user !== 'string') return

          const name = typeof payload.display_name === 'string' && payload.display_name.trim() ? payload.display_name : 'Someone'

          update(channel, user, frame.t === 'TYPING_START' ? { name, expires: Date.now() + EXPIRE_MS } : null)

          return
        }

        // Sending a message ends typing, even when the stop event never comes
        if (frame.t === 'MESSAGE_CREATE') {

          const channel = topic.match(/^channel:(\d+)$/)?.[1]
          const message = payload?.message ?? payload
          const author = message?.author_id ?? message?.profile_id

          if (channel && author != null && typing.get(channel)?.has(String(author))) update(channel, String(author), null)
        }
      }),
    )

    const timer = setInterval(() => {

      const now = Date.now()

      let changed = false

      for (const [channel, users] of typing) {

        for (const [user, typer] of users) {

          if (typer.expires > now) continue

          users.delete(user)
          changed = true
        }

        if (!users.size) typing.delete(channel)
      }

      if (changed) render()
    }, SWEEP_MS)

    ctx.onDomChange(() => {

      sync()
      render()

    })

    ctx.onSettingsChange(render)

    ctx.onStop(() => {

      clearInterval(timer)

      for (const channel of [...held.keys()]) release(channel)

      document.querySelectorAll(`.${DOTS}`).forEach((dots) => dots.remove())
    })

    sync()
    render()
  },
})