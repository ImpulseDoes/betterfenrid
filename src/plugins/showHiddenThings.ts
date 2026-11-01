import { isMention, memberOf, setNameBadge, watchProfileTriggers } from '../api/profiles'
import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { icon } from '../ui/icons'

const BADGE = 'bf-timeout-badge'

function timeoutEnd(trigger: Element): Date | null {

  const until = memberOf(trigger)?.communication_disabled_until
  const end = until ? new Date(until) : null

  return end && end.getTime() > Date.now() ? end : null
}

export default definePlugin({
  id: 'showHiddenThings',
  name: 'Show Hidden Things',
  description: 'Shows things Fenrid has the data for but doesn\'t display.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    watchProfileTriggers(ctx, (trigger) => {

      const end = isMention(trigger) ? null : timeoutEnd(trigger)

      if (!end) return setNameBadge(trigger, BADGE, null)

      const title = `Timed out until ${end.toLocaleString()}`

      trigger.querySelector(`.${BADGE}`)?.setAttribute('title', title)

      setNameBadge(trigger, BADGE, () => h('span', { class: BADGE, title, 'aria-label': title }, icon('clock', 14)))
    })

    ctx.onStop(() => document.querySelectorAll(`.${BADGE}`).forEach((badge) => badge.remove()))
  },
})