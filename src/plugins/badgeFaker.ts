import { addCardBadges, CARD_BADGE } from '../api/profileBadges'
import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { fenridBadgeIcon, FENRID_BADGES, type FenridBadgeId } from '../ui/fenridBadges'
import { tooltip } from '../ui/tooltip'

const IDS = Object.keys(FENRID_BADGES) as FenridBadgeId[]

function FakeBadge(id: FenridBadgeId): Element {

  const el = h('span', { class: CARD_BADGE, role: 'img', 'data-badge': id, 'aria-label': FENRID_BADGES[id] }, fenridBadgeIcon(id))

  return tooltip(el, FENRID_BADGES[id])
}

const badge = (id: FenridBadgeId) => ({ type: 'boolean' as const, label: FENRID_BADGES[id], default: false })

export default definePlugin({
  id: 'badgeFaker',
  name: 'Badge Faker',
  description: 'Shows the Fenrid badges you pick on your own profile. Only you can see them: nothing is sent to Fenrid.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    staff: badge('staff'),
    partner: badge('partner'),
    early_supporter: badge('early_supporter'),
    prime: badge('prime'),
    flare: badge('flare'),
    surge: badge('surge'),
    bug_hunter_iii: badge('bug_hunter_iii'),
    bug_hunter_ii: badge('bug_hunter_ii'),
    bug_hunter_i: badge('bug_hunter_i'),
  },

  start(ctx) {

    const refresh = addCardBadges(ctx, ({ self, shown }) => {

      if (!self) return []

      return IDS
        .filter((id) => ctx.settings[id] && !shown.includes(id))
        .map((id) => ({ key: `fake:${id}`, create: () => FakeBadge(id) }))
    })

    ctx.onSettingsChange(refresh)
  },
})