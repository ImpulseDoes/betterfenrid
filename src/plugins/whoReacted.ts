import { avatarUrl } from '../api/profiles'
import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'

const SHOWN = 3
const REQUEST_GAP_MS = 350
const RATE_LIMIT_MS = 5_000
const RECHECK_MS = 15_000
const REACTORS = 'bf-reactors'

type Participant = Record<string, any>

function reactionUrl({ kind, contextId, messageId }: Record<string, string>, reactionKey: string): string {

  const scope = kind === 'server' ? `/api/channels/${encodeURIComponent(contextId)}` : `/api/dm/conversations/${encodeURIComponent(contextId)}`
  const emoji = reactionKey.startsWith('custom:') ? `emoji:${reactionKey.slice(7)}` : reactionKey.replace(/^unicode:/, '')

  return `${scope}/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}?limit=${SHOWN}`
}

function Avatar(participant: Participant): Node {

  const name = String(participant.displayName ?? '?')
  const src = avatarUrl(participant) ?? avatarUrl(participant.profile) ?? avatarUrl(participant.profiles)

  return src
    ? h('img', { class: 'bf-reactor', src, alt: name, loading: 'lazy' })
    : h('span', { class: 'bf-reactor bf-reactor-initial' }, name.charAt(0).toUpperCase())
}

function render(chip: Element, participants: Participant[]) {

  chip.querySelector(`.${REACTORS}`)?.remove()

  if (participants.length) chip.append(h('span', { class: REACTORS }, ...participants.slice(0, SHOWN).map(Avatar)))
}

export default definePlugin({
  id: 'whoReacted',
  name: 'Who Reacted',
  description: 'Shows the avatars of the people who reacted to a message.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    const results = new Map<string, Participant[]>()
    const visible = new Set<Element>()
    const queue: Element[] = []

    let working = false
    let stopped = false
    let pausedUntil = 0

    // One at a time and only for what's on screen: Fenrid limits how often reactions are read
    const work = async () => {

      if (working) return

      working = true

      while (queue.length && !stopped) {

        const wait = pausedUntil - Date.now()

        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))

        const chip = queue.shift()!

        if (chip.isConnected && visible.has(chip)) {

          await load(chip)
          await new Promise((resolve) => setTimeout(resolve, REQUEST_GAP_MS))

        }
      }

      working = false
    }

    const load = async (chip: Element) => {

      const registration = findProps(chip, (props) => !!props.registration)?.registration
      const key = chip.getAttribute('data-reaction-key')

      if (!registration || !key) return

      // The label holds the reaction count, so a new reaction asks again
      const cacheKey = `${registration.messageId}:${key}:${chip.getAttribute('aria-label')}`

      if (results.has(cacheKey)) return render(chip, results.get(cacheKey)!)

      try {

        const response = await fetch(reactionUrl(registration, key), { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })

        if (response.status === 429) {

          const seconds = Number(response.headers.get('Retry-After'))

          pausedUntil = Date.now() + (seconds > 0 ? seconds * 1000 : RATE_LIMIT_MS)
          queue.unshift(chip)

          return
        }

        if (!response.ok) return

        const participants: Participant[] = (await response.json())?.participants ?? []

        results.set(cacheKey, participants)
        render(chip, participants)

      } catch (err) {

        ctx.log.debug('Could not load reactions', err)

      }
    }

    const enqueue = (chip: Element) => {

      if (!queue.includes(chip)) queue.push(chip)

      void work()
    }

    const observer = new IntersectionObserver((entries) => {

      for (const { target, isIntersecting } of entries) {

        if (isIntersecting) {

          visible.add(target)
          enqueue(target)

        } else {

          visible.delete(target)

        }
      }
    })

    const observeIn = (root: Element) => {

      for (const chip of [...(root.matches(Selectors.reactionChip) ? [root] : []), ...root.querySelectorAll(Selectors.reactionChip)]) observer.observe(chip)
    }

    if (document.body) observeIn(document.body)

    ctx.onDomChange((added) => added.forEach(observeIn))

    const timer = setInterval(() => {

      for (const chip of visible) {

        if (chip.isConnected) enqueue(chip)
        else visible.delete(chip)

      }
    }, RECHECK_MS)

    ctx.onStop(() => {

      stopped = true
      clearInterval(timer)
      observer.disconnect()
      document.querySelectorAll(`.${REACTORS}`).forEach((el) => el.remove())

    })
  },
})