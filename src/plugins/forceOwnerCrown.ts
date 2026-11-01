import { isMention, memberOf, setNameBadge, watchProfileTriggers } from '../api/profiles'
import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'
import { icon } from '../ui/icons'

const BADGE = 'bf-owner-crown'

function needsCrown(trigger: Element): boolean {

  if (isMention(trigger)) return false

  const scope = findProps(trigger, (props) => 'serverOwnerId' in props)
  const member = memberOf(trigger)
  const id = member?.profile_id ?? member?.profiles?.id

  if (!scope?.serverOwnerId || id !== scope.serverOwnerId) return false

  // The member list draws its own crown unless the server hides it. Messages never do
  return !!scope.message || scope.showOwnerCrown === false
}

export default definePlugin({
  id: 'forceOwnerCrown',
  name: 'Force Owner Crown',
  description: 'Shows a crown next to the server owner in messages, and in the member list when the server hides it.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    watchProfileTriggers(ctx, (trigger) => {

      setNameBadge(trigger, BADGE, needsCrown(trigger) ? () => h('span', { class: BADGE, title: 'Server owner', 'aria-label': 'Server owner' }, icon('crown', 14)) : null)

    })

    ctx.onStop(() => document.querySelectorAll(`.${BADGE}`).forEach((badge) => badge.remove()))
  },
})