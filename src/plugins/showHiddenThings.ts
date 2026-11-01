import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'
import { icon } from '../ui/icons'

const BADGE = 'bf-timeout-badge'
const RECHECK_MS = 15_000

function timeoutEnd(trigger: Element): Date | null {

  const member = findProps(trigger, (props) => !!props.member)?.member
  const until = member?.communication_disabled_until
  const end = until ? new Date(until) : null

  return end && end.getTime() > Date.now() ? end : null
}

function updateTrigger(trigger: Element) {

  const next = trigger.nextElementSibling
  const badge = next?.classList.contains(BADGE) ? next : null
  const end = trigger.textContent?.trim() ? timeoutEnd(trigger) : null

  if (!end) {

    badge?.remove()

    return
  }

  const title = `Timed out until ${end.toLocaleString()}`

  if (badge) badge.setAttribute('title', title)
  else trigger.after(h('span', { class: BADGE, title, 'aria-label': title }, icon('clock', 14)))
}

function triggersIn(root: Element): Element[] {

  return [...(root.matches(Selectors.profileTrigger) ? [root] : []), ...root.querySelectorAll(Selectors.profileTrigger)]
}

export default definePlugin({
  id: 'showHiddenThings',
  name: 'Show Hidden Things',
  description: 'Shows things Fenrid has the data for but doesn\'t display.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    const updateAll = () => triggersIn(document.body).forEach(updateTrigger)

    ctx.onDomChange((added) => added.flatMap(triggersIn).forEach(updateTrigger))

    // Nothing on the page changes when a timeout starts or runs out
    const timer = setInterval(updateAll, RECHECK_MS)

    if (document.body) updateAll()

    ctx.onStop(() => {

      clearInterval(timer)
      document.querySelectorAll(`.${BADGE}`).forEach((badge) => badge.remove())

    })
  },
})