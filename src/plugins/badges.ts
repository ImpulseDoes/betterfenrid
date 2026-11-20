import { BIO_LIMIT, usesBetterFenrid, withMarker, withoutMarker } from '../api/bioTags'
import { onApiRequestBody } from '../api/network'
import { addCardBadges, CARD_BADGE, expandIds, memberIds } from '../api/profileBadges'
import { findNameBadge, isMention, memberOf, setNameBadge, watchProfileTriggers } from '../api/profiles'
import { BADGE_HOLDERS, BADGE_TYPES, type BadgeId } from '../badges'
import { h } from '../core/dom'
import { getUser } from '../core/entities'
import { definePlugin } from '../core/plugins'
import { Selectors } from '../core/selectors'
import { icon } from '../ui/icons'
import { tooltip } from '../ui/tooltip'

const BADGE = 'bf-user-badge'
const ME = '/api/users/me'
const SYNC_DELAY_MS = 8_000

function holdersOf(ids: Set<string>): BadgeId[] {
  return [...new Set([...ids].flatMap((id) => BADGE_HOLDERS[id] ?? []))]
}

function isUser(ids: Set<string>): boolean {
  return [...ids].some((id) => usesBetterFenrid(getUser(id)?.bio))
}

async function readOwnBio(): Promise<string | undefined> {

  const response = await fetch(ME, { credentials: 'include', cache: 'no-store' })

  if (!response.ok) return undefined

  const data = await response.json().catch(() => null)
  const profile = [data?.profile, data?.user, data].find((p) => p && typeof p === 'object' && 'bio' in p)

  return profile ? String(profile.bio ?? '') : undefined
}

function NameBadges(badges: BadgeId[]): Element {

  return h(
    'span',
    { class: BADGE, 'data-badges': badges.join(',') },
    ...badges.map((id) => {

      const { label, icon: name, color } = BADGE_TYPES[id]
      const el = h('span', { class: `${BADGE}-icon`, role: 'img' }, icon(name, 16))

      el.style.setProperty('--bf-badge-color', color)

      return tooltip(el, label)
    }),
  )
}

function CardBadge(id: BadgeId): Element {

  const { label, icon: name, color } = BADGE_TYPES[id]
  const el = h('span', { class: CARD_BADGE, role: 'img', 'data-badge': id }, icon(name, 20))

  el.style.setProperty('--bf-badge-color', color)

  return tooltip(el, label)
}

export default definePlugin({
  id: 'badges',
  name: 'Better Fenrid Badges',
  description: 'Shows Better Fenrid badges on profile cards and next to names in the chat, including one for everyone who uses Better Fenrid.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,
  settings: {
    advertise: {
      type: 'boolean',
      label: 'Show others I use Better Fenrid',
      description: 'Adds an invisible marker to your bio, so other Better Fenrid users see the badge on your profile. Turn off to take it out.',
      default: true,
    },
  },

  start(ctx) {

    const any = () => Object.keys(BADGE_HOLDERS).length > 0

    watchProfileTriggers(ctx, (trigger) => {

      const badges = any() && !isMention(trigger) && trigger.closest(Selectors.message) ? holdersOf(expandIds(memberIds(memberOf(trigger)))) : []

      if ((findNameBadge(trigger, BADGE)?.getAttribute('data-badges') ?? '') === badges.join(',')) return

      setNameBadge(trigger, BADGE, null)

      if (badges.length) setNameBadge(trigger, BADGE, () => NameBadges(badges))
    })

    addCardBadges(ctx, ({ ids, self }) => {

      const badges = holdersOf(ids)

      if (self ? ctx.settings.advertise : isUser(ids)) badges.push('user')

      return badges.map((id) => ({ key: id, create: () => CardBadge(id) }))
    })

    const markBio = (bio: string) => {

      const next = ctx.settings.advertise ? withMarker(bio) : withoutMarker(bio)

      return next.length > BIO_LIMIT ? null : next
    }

    ctx.onStop(
      onApiRequestBody(({ url, method }, body) => {

        if (method !== 'PATCH' || url.pathname !== ME || typeof body?.bio !== 'string') return

        const bio = markBio(body.bio)

        return bio === null || bio === body.bio ? undefined : { ...body, bio }
      }),
    )

    let stopped = false

    const sync = async () => {

      const bio = await readOwnBio().catch(() => undefined)

      if (stopped) return

      if (bio === undefined) return void ctx.log.info('Could not read your bio, the marker is added the next time you save your profile')

      const next = markBio(bio)

      if (next === null) return void ctx.log.info('Your bio is too long for the Better Fenrid marker')

      if (next === bio) return

      const response = await fetch(ME, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bio: next }) })

      if (!response.ok) ctx.log.warn('Could not update your bio', response.status)
    }

    const run = () => void sync().catch((error) => ctx.log.warn('Could not update your bio', error))
    const timer = setTimeout(run, SYNC_DELAY_MS)

    let advertised = ctx.settings.advertise

    ctx.onSettingsChange(() => {

      if (ctx.settings.advertise === advertised) return

      advertised = ctx.settings.advertise
      run()
    })

    ctx.onStop(() => {

      stopped = true
      clearTimeout(timer)

    })

    ctx.onStop(() => {

      document.querySelectorAll(`.${BADGE}`).forEach((el) => el.remove())

    })
  },
})