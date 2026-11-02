import { findNameBadge, isMention, memberOf, setNameBadge, watchProfileTriggers } from '../api/profiles'
import { BADGE_HOLDERS, BADGE_TYPES, type BadgeId } from '../badges'
import { h } from '../core/dom'
import { getUser } from '../core/entities'
import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'
import { icon } from '../ui/icons'
import { tooltip } from '../ui/tooltip'

const BADGE = 'bf-user-badge'
const CARD_BADGE = 'bf-profile-badge'
const OWN_ROW = 'data-bf-badge-row'
// The same look as Fenrid's own badge row, for profiles that have no Fenrid badges
const ROW_CLASS = 'flex max-w-full shrink-0 flex-wrap items-center gap-1 rounded-md bg-popups-and-modals/90 p-1 ring-1 ring-white/5 backdrop-blur'

type Props = Record<string, any>

// Fenrid passes the internal id around, "Copy User ID" gives the public one
function badgesFor(...candidates: unknown[]): BadgeId[] {

  const ids = new Set<string>()

  for (const id of candidates) {

    if (id == null || id === '') continue

    const user = getUser(String(id))

    ids.add(String(id))

    if (user?.id != null) ids.add(String(user.id))
    if (user?.public_id != null) ids.add(String(user.public_id))
  }

  return [...new Set([...ids].flatMap((id) => BADGE_HOLDERS[id] ?? []))]
}

function memberIds(member: Props | null | undefined): unknown[] {
  return [member?.profile_id, member?.profiles?.id, member?.profiles?.public_id, member?.public_id]
}

function profileIdsOf(el: Element): unknown[] {

  const props = findProps(el, (p) =>
    typeof p.profileId === 'string' ||
    !!p.member?.profile_id ||
    !!p.profile?.id ||
    !!p.user?.id ||
    !!p.currentUser?.id,
  )

  if (!props) return []

  return [props.profileId, props.userId, props.profile?.id, props.profile?.public_id, props.user?.id, props.user?.public_id, props.currentUser?.id, props.currentUser?.public_id, ...memberIds(props.member)]
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

function fillRow(row: Element, badges: BadgeId[]) {

  const key = badges.join(',')

  if ((row.getAttribute('data-bf-badges') ?? '') === key) return

  row.querySelectorAll(`.${CARD_BADGE}`).forEach((el) => el.remove())
  row.setAttribute('data-bf-badges', key)
  row.append(...badges.map(CardBadge))
}

// Fenrid's username line ("@name • pronouns") in a profile card, when it has no badge row to join
function usernameLines(root: Element): Element[] {

  return [...root.querySelectorAll('p')].filter((p) =>
    p.textContent?.trim().startsWith('@') &&
    p.parentElement?.classList.contains('flex-wrap') &&
    !p.closest(Selectors.message) &&
    !p.closest('.bf-root'),
  )
}

function updateCards(root: Element) {

  for (const row of root.querySelectorAll(Selectors.profileBadges)) {

    if (row.hasAttribute(OWN_ROW)) continue

    fillRow(row, badgesFor(...profileIdsOf(row)))
  }

  for (const line of usernameLines(root)) {

    const parent = line.parentElement!
    const native = [...parent.children].find((el) => el.matches(Selectors.profileBadges) && !el.hasAttribute(OWN_ROW))
    const own = parent.querySelector(`:scope > [${OWN_ROW}]`)

    if (native) {

      own?.remove()

      continue
    }

    const badges = badgesFor(...profileIdsOf(line))

    if (!badges.length) {

      own?.remove()

      continue
    }

    const row = own ?? h('div', { class: ROW_CLASS, [OWN_ROW]: '', 'aria-label': 'Profile badges' })

    fillRow(row, badges)

    if (!own) line.after(row)
  }
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

      const badges = any() && !isMention(trigger) && trigger.closest(Selectors.message) ? badgesFor(...memberIds(memberOf(trigger))) : []

      if ((findNameBadge(trigger, BADGE)?.getAttribute('data-badges') ?? '') === badges.join(',')) return

      setNameBadge(trigger, BADGE, null)

      if (badges.length) setNameBadge(trigger, BADGE, () => NameBadges(badges))
    })

    ctx.onDomChange((added) => {

      if (!any()) return

      for (const el of added) {

        if (el.closest(`.${CARD_BADGE}, [${OWN_ROW}]`)) continue

        // A badge row can appear inside a card that is already open
        updateCards(el.closest(Selectors.profileBadges)?.parentElement ?? el)
      }
    })

    if (any() && document.body) updateCards(document.body)

    ctx.onStop(() => {

      document.querySelectorAll(`.${BADGE}, .${CARD_BADGE}, [${OWN_ROW}]`).forEach((el) => el.remove())
      document.querySelectorAll('[data-bf-badges]').forEach((el) => el.removeAttribute('data-bf-badges'))

    })
  },
})