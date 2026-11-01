import { onGatewayFrame } from '../api/network'
import { findNameBadge, isMention, memberOf, setNameBadge, watchProfileTriggers } from '../api/profiles'
import { h } from '../core/dom'
import { getMemberTimeout } from '../core/entities'
import { definePlugin } from '../core/plugins'
import { icon } from '../ui/icons'

const BADGE = 'bf-timeout-badge'
const TICK_MS = 1_000

function timeoutEnd(trigger: Element): number | null {

  const member = memberOf(trigger)
  const serverId = member?.serverId ?? location.pathname.match(/^\/channels\/(\d+)/)?.[1]
  const known = serverId && member?.profile_id ? getMemberTimeout(serverId, member.profile_id) : undefined

  // Names in messages get a member object without this field, so the network is the main source
  const until = known === undefined ? member?.communication_disabled_until : known
  const end = until ? Date.parse(until) : NaN

  return end > Date.now() ? end : null
}

function remaining(ms: number): string {

  const seconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days) return `${days}d ${hours % 24}h`
  if (hours) return `${hours}h ${minutes % 60}m`

  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function setEnd(badge: Element, end: number) {

  const title = `Timed out until ${new Date(end).toLocaleString()}`

  badge.setAttribute('data-until', String(end))
  badge.setAttribute('title', title)
  badge.setAttribute('aria-label', title)
  badge.lastElementChild!.textContent = remaining(end - Date.now())
}

function Badge(end: number): Element {

  const badge = h('span', { class: BADGE }, icon('clock', 15), h('span', { class: `${BADGE}-label` }, 'Timed out'), h('span', {}))

  setEnd(badge, end)

  return badge
}

function tick() {

  for (const badge of document.querySelectorAll(`.${BADGE}`)) {

    const left = Number(badge.getAttribute('data-until')) - Date.now()

    if (left > 0) badge.lastElementChild!.textContent = remaining(left)
    else badge.remove()

  }
}

export default definePlugin({
  id: 'showHiddenThings',
  name: 'Show Hidden Things',
  description: 'Shows things Fenrid has the data for but doesn\'t display.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    const updateAll = watchProfileTriggers(ctx, (trigger) => {

      const end = isMention(trigger) ? null : timeoutEnd(trigger)

      if (!end) return setNameBadge(trigger, BADGE, null)

      const existing = findNameBadge(trigger, BADGE)

      if (existing) setEnd(existing, end)

      setNameBadge(trigger, BADGE, () => Badge(end))
    })

    // A timeout changes nothing on the page, so waiting for the next recheck would look broken
    ctx.onStop(onGatewayFrame((frame) => {

      if (frame.t === 'MEMBER_UPDATE' || frame.t === 'GUILD_MEMBERS_CHUNK') setTimeout(updateAll)

    }))

    const timer = setInterval(tick, TICK_MS)

    ctx.onStop(() => {

      clearInterval(timer)
      document.querySelectorAll(`.${BADGE}`).forEach((badge) => badge.remove())

    })
  },
})