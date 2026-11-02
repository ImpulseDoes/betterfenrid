import { onEveryGatewayFrame } from '../api/network'
import { expandIds, memberIds } from '../api/profileBadges'
import { findNameBadge, isMention, memberOf, setNameBadge, watchProfileTriggers } from '../api/profiles'
import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { Selectors } from '../core/selectors'
import { icon, type IconName } from '../ui/icons'
import { tooltip } from '../ui/tooltip'

const INDICATOR = 'bf-platform'
const REFRESH_MS = 400

interface Session {
  id: string
  active: boolean
  mobile: boolean
}

interface Presence {
  epoch: string
  revision: number
  retired: Set<string>
  manual: string | null
  sessions: Session[]
}

interface Platform {
  kind: 'computer' | 'mobile'
  count: number
  active: boolean
}

const ICONS: Record<Platform['kind'], IconName> = { computer: 'desktop', mobile: 'phone' }

const isInvisible = (status: string | null) => !!status?.startsWith('invisible')

function accept(
  current: Presence | undefined,
  epoch: unknown,
  revision: unknown,
  snapshot: boolean,
): { presence: Presence } | null {

  if (typeof epoch !== 'string' || !epoch || !Number.isSafeInteger(revision) || (revision as number) < 0) return null

  const rev = revision as number

  if (!current) return { presence: { epoch, revision: rev, retired: new Set(), manual: null, sessions: [] } }

  if (current.epoch === epoch) {

    if (rev < current.revision) return null

    current.revision = rev

    return { presence: current }
  }

  if (current.retired.has(epoch) || snapshot) return null

  return { presence: { epoch, revision: rev, retired: new Set([...current.retired, current.epoch]), manual: current.manual, sessions: [] } }
}

const toSession = (session: any): Session => ({
  id: session.session_id,
  active: session.is_active === true && session.is_visible === true,
  mobile: session.mobile === true,
})

function apply(presence: Map<string, Presence>, t: string, payload: any): boolean {

  const user = payload?.user_id

  if (typeof user !== 'string') return false

  const accepted = accept(presence.get(user), payload.owner_epoch, payload.revision, t === 'PRESENCE_SNAPSHOT')

  if (!accepted) return false

  const entry = accepted.presence

  presence.set(user, entry)

  if (typeof payload.manual_status === 'string') entry.manual = payload.manual_status

  if (t === 'PRESENCE_SNAPSHOT') {

    entry.sessions = payload.qualified === true && Array.isArray(payload.sessions) ? payload.sessions.map(toSession) : []

    return true
  }

  entry.sessions = entry.sessions.filter((session) => session.id !== payload.session_id)

  if (t === 'PRESENCE_UPDATE') entry.sessions.push(toSession(payload))

  return true
}

function platformsOf(sessions: Session[]): Platform[] {

  return (['computer', 'mobile'] as const).flatMap((kind) => {

    const own = sessions.filter((session) => session.mobile === (kind === 'mobile'))

    return own.length ? [{ kind, count: own.length, active: own.some((session) => session.active) }] : []
  })
}

function describe({ kind, count, active }: Platform): string {

  const where = kind === 'mobile'
    ? (count > 1 ? `On ${count} phones` : 'On a phone')
    : (count > 1 ? `On ${count} computers` : 'On a computer')

  return active ? where : `${where} (idle)`
}

function Indicator(platforms: Platform[], key: string): Element {

  return h(
    'span',
    { class: INDICATOR, 'data-key': key },
    ...platforms.map((platform) => {

      const el = h('span', { class: `${INDICATOR}-icon`, role: 'img', 'data-active': String(platform.active) }, icon(ICONS[platform.kind], 14))

      return tooltip(el, describe(platform))
    }),
  )
}

export default definePlugin({
  id: 'platformIndicators',
  name: 'Platform Indicators',
  description: 'Shows whether someone is on a computer or a phone next to their name, and how many sessions they have open.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    showInMessages: {
      type: 'boolean',
      label: 'In messages',
      default: true,
    },
    showInMemberList: {
      type: 'boolean',
      label: 'In the member list',
      default: true,
    },
  },

  start(ctx) {

    const presence = new Map<string, Presence>()

    const platformsFor = (trigger: Element): Platform[] => {

      for (const id of expandIds(memberIds(memberOf(trigger)))) {

        const entry = presence.get(id)

        if (entry) return isInvisible(entry.manual) ? [] : platformsOf(entry.sessions)
      }

      return []
    }

    const wanted = (trigger: Element) => {

      if (isMention(trigger)) return false

      return trigger.closest(Selectors.message) ? ctx.settings.showInMessages : ctx.settings.showInMemberList
    }

    const update = (trigger: Element) => {

      const platforms = wanted(trigger) ? platformsFor(trigger) : []
      const key = platforms.map(({ kind, count, active }) => `${kind}${count}${active}`).join()

      if ((findNameBadge(trigger, INDICATOR)?.getAttribute('data-key') ?? '') === key) return

      setNameBadge(trigger, INDICATOR, null)

      if (key) setNameBadge(trigger, INDICATOR, () => Indicator(platforms, key))
    }

    const updateAll = watchProfileTriggers(ctx, update)

    let timer: ReturnType<typeof setTimeout> | null = null

    const refreshSoon = () => {

      timer ??= setTimeout(() => {

        timer = null
        updateAll()

      }, REFRESH_MS)
    }

    const stopListening = onEveryGatewayFrame((frame) => {

      if (frame.t?.startsWith('PRESENCE_') && apply(presence, frame.t, frame.d?.payload)) refreshSoon()
    })

    ctx.onSettingsChange(updateAll)

    ctx.onStop(() => {

      stopListening()

      if (timer) clearTimeout(timer)

      document.querySelectorAll(`.${INDICATOR}`).forEach((el) => el.remove())
    })
  },
})