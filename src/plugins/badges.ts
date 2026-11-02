import { addCardBadges, CARD_BADGE, expandIds, memberIds } from '../api/profileBadges'
import { findNameBadge, isMention, memberOf, setNameBadge, watchProfileTriggers } from '../api/profiles'
import { BADGE_HOLDERS, BADGE_TYPES, type BadgeId } from '../badges'
import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { Selectors } from '../core/selectors'
import { icon } from '../ui/icons'
import { tooltip } from '../ui/tooltip'

const BADGE = 'bf-user-badge'

function holdersOf(ids: Set<string>): BadgeId[] {
  return [...new Set([...ids].flatMap((id) => BADGE_HOLDERS[id] ?? []))]
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
  description: 'Shows Better Fenrid developer and contributor badges on profile cards and next to names in the chat.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    const any = () => Object.keys(BADGE_HOLDERS).length > 0

    // Only in the chat: the member list is too tight for it
    watchProfileTriggers(ctx, (trigger) => {

      const badges = any() && !isMention(trigger) && trigger.closest(Selectors.message) ? holdersOf(expandIds(memberIds(memberOf(trigger)))) : []

      if ((findNameBadge(trigger, BADGE)?.getAttribute('data-badges') ?? '') === badges.join(',')) return

      setNameBadge(trigger, BADGE, null)

      if (badges.length) setNameBadge(trigger, BADGE, () => NameBadges(badges))
    })

    addCardBadges(ctx, ({ ids }) => holdersOf(ids).map((id) => ({ key: id, create: () => CardBadge(id) })))

    ctx.onStop(() => {

      document.querySelectorAll(`.${BADGE}`).forEach((el) => el.remove())

    })
  },
})