import { onGatewayFrame } from '../api/network'
import { h } from '../core/dom'
import { createLogger } from '../core/logger'
import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'
import { tooltip } from '../ui/tooltip'

const STORAGE_KEY = 'BetterFenrid:voiceTimers'
const TIMER = 'bf-voice-timer'
const CALL = 'bf-voice-call'
const TICK_MS = 1_000
const SAVE_MS = 10_000
const RELOAD_GAP_MS = 60_000
const FORGET_MS = 24 * 60 * 60_000

interface Session {
  channel: string
  since: number
  // False when they were already there and we only know a lower bound
  exact: boolean
  seen: number
}

const log = createLogger('Voice Timers')

function load(): Map<string, Session> {

  try {

    const now = Date.now()
    const entries: [string, Session][] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')

    return new Map(entries.filter(([, session]) => now - session.seen < FORGET_MS))

  } catch {

    return new Map()

  }
}

function format(ms: number): string {

  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, '0')

  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}

function describe(session: Session): string {

  const time = new Date(session.since).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return session.exact ? `Joined at ${time}` : `Already here when you opened Fenrid, so at least since ${time}`
}

function describeCall(session: Session): string {

  const time = new Date(session.since).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return session.exact ? `Going on since ${time}` : `Already going when you opened Fenrid, so at least since ${time}`
}

// Adds, updates or removes a timer right after the name in a row
function setTimer(host: Element, className: string, session: Session | null, label: (session: Session) => string, now: number) {

  const existing = host.querySelector<HTMLElement>(`.${className}`)

  if (!session) return void existing?.remove()

  const text = `${session.exact ? '' : '≥'}${format(now - session.since)}`
  const key = `${session.since}:${session.exact}`

  if (existing?.dataset.key === key) {

    if (existing.textContent !== text) existing.textContent = text

    return
  }

  const timer = tooltip(h('span', { class: className, 'data-key': key }, text), label(session))
  const name = host.querySelector(Selectors.channelName)

  existing?.remove()

  if (name) name.after(timer)
  else host.append(timer)
}

function participantOf(row: Element): { user: string; channel: string | null } | null {

  const props = findProps(row, (p) => typeof p.participant?.identity === 'string')

  if (!props) return null

  const channel = props.sourceChannelId ?? findProps(row, (p) => typeof p.sourceChannelId === 'string')?.sourceChannelId ?? null

  return { user: props.participant.identity, channel }
}

export default definePlugin({
  id: 'voiceTimers',
  name: 'Voice Timers',
  description: "Shows how long a call has been going on, as a pill next to the voice channel's name.",
  authors: ['Better Fenrid'],
  enabledByDefault: true,
  settings: {
    perPerson: {
      type: 'boolean',
      label: 'Also show it for each person',
      description: 'How long everyone in the channel has been there, next to their name.',
      default: false,
    },
  },

  start(ctx) {

    const sessions = load()
    const started = Date.now()

    // Kept from before a reload only if the page was gone for a moment, or they may have left and come back unseen
    const trusted = (session: Session) => session.seen >= started || started - session.seen < RELOAD_GAP_MS

    const save = () => {

      try {

        localStorage.setItem(STORAGE_KEY, JSON.stringify([...sessions]))

      } catch (err) {

        log.warn('Could not save voice timers', err)

      }
    }

    const joined = (user: string, channel: string, exact: boolean) => {

      const now = Date.now()
      const known = sessions.get(user)

      // Muting, cameras and the like resend the state without moving anyone
      if (known?.channel === channel) {

        known.seen = now

        return
      }

      sessions.set(user, { channel, since: now, exact, seen: now })
    }

    const fromSnapshot = (user: string, channel: string) => {

      const now = Date.now()
      const known = sessions.get(user)

      if (known?.channel === channel && trusted(known)) {

        known.seen = now

        return
      }

      sessions.set(user, { channel, since: now, exact: false, seen: now })
    }

    const render = () => {

      const now = Date.now()
      // The person there longest, per channel row: that's how long the call has been going
      const calls = new Map<Element, Session>()

      for (const row of document.querySelectorAll(Selectors.voiceParticipant)) {

        const participant = participantOf(row)

        if (!participant) continue

        // On the list without a state from the gateway: count from now
        const known = sessions.get(participant.user)

        if (participant.channel && (!known || !trusted(known))) fromSnapshot(participant.user, participant.channel)

        const session = sessions.get(participant.user) ?? null
        const current = session && (!participant.channel || session.channel === participant.channel) ? session : null

        if (current) {

          current.seen = now

          // The row's own href can't be trusted: Fenrid points it elsewhere on mobile and during a timeout
          const link = row.closest(`div:has(${Selectors.channelLink})`)?.querySelector(Selectors.channelLink)

          if (link) {

            const longest = calls.get(link)
            const first = longest && longest.since < current.since ? longest : current

            // Anyone we only have a lower bound for may have started it earlier
            calls.set(link, { ...first, exact: (longest?.exact ?? true) && current.exact })
          }
        }

        setTimer(row, TIMER, ctx.settings.perPerson ? current : null, describe, now)
      }

      for (const pill of document.querySelectorAll(`.${CALL}`)) {

        if (!calls.has(pill.closest(Selectors.channelLink)!)) pill.remove()

      }

      for (const [link, session] of calls) setTimer(link, CALL, session, describeCall, now)
    }

    ctx.onStop(
      onGatewayFrame((frame) => {

        const payload = frame.d?.payload

        if (frame.t === 'VOICE_STATE_SNAPSHOT' && Array.isArray(payload?.states)) {

          for (const state of payload.states) {

            if (typeof state?.user_id === 'string' && typeof state.channel_id === 'string') fromSnapshot(state.user_id, state.channel_id)

          }

          queueMicrotask(render)

          return
        }

        if (frame.t !== 'VOICE_STATE_UPDATE' || typeof payload?.user_id !== 'string') return

        if (typeof payload.channel_id === 'string') joined(payload.user_id, payload.channel_id, true)
        else sessions.delete(payload.user_id)

        queueMicrotask(render)
      }),
    )

    const tick = setInterval(render, TICK_MS)
    const persist = setInterval(save, SAVE_MS)

    window.addEventListener('pagehide', save)
    ctx.onStop(() => window.removeEventListener('pagehide', save))

    ctx.onSettingsChange(render)

    ctx.onDomChange((added) => {

      if (added.some((el) => !el.closest(`.${TIMER}, .${CALL}`))) render()

    })

    ctx.onStop(() => {

      clearInterval(tick)
      clearInterval(persist)
      save()
      document.querySelectorAll(`.${TIMER}, .${CALL}`).forEach((el) => el.remove())

    })

    render()
  },
})