import { h } from '../core/dom'
import { getUser } from '../core/entities'
import type { PluginContext } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'
import { currentUserId } from './profiles'

export const CARD_BADGE = 'bf-profile-badge'

const OWN_ROW = 'data-bf-badge-row'
const ROW_CLASS = 'flex max-w-full shrink-0 flex-wrap items-center gap-1 rounded-md bg-popups-and-modals/90 p-1 ring-1 ring-white/5 backdrop-blur'
const ACCOUNT_ROW_CLASS = 'absolute right-3 top-[114px] z-30 flex items-center gap-1 rounded-md bg-popups-and-modals/90 p-1 ring-1 ring-white/5 backdrop-blur'

type Props = Record<string, any>

export interface CardBadge {
  key: string
  create(): Element
}

export interface Card {
  ids: Set<string>
  self: boolean
  shown: string[]
}

export type CardBadgeSource = (card: Card) => CardBadge[]

const sources = new Set<CardBadgeSource>()

let me: string | null = null

// Fenrid passes the internal id around, "Copy User ID" gives the public one
export function expandIds(candidates: unknown[]): Set<string> {

  const ids = new Set<string>()

  for (const id of candidates) {

    if (id == null || id === '') continue

    const user = getUser(String(id))

    ids.add(String(id))

    if (user?.id != null) ids.add(String(user.id))
    if (user?.public_id != null) ids.add(String(user.public_id))
  }

  return ids
}

export function memberIds(member: Props | null | undefined): unknown[] {
  return [member?.profile_id, member?.profiles?.id, member?.profiles?.public_id, member?.public_id]
}

function identify(el: Element): Pick<Card, 'ids' | 'self'> {

  const props = findProps(el, (p) =>
    typeof p.profileId === 'string' ||
    !!p.data?.profileId ||
    !!p.member?.profile_id ||
    !!p.profile?.id ||
    !!p.user?.id ||
    !!p.currentUser?.id,
  )

  if (!props) return { ids: new Set(), self: false }

  const ids = expandIds([
    props.profileId,
    props.userId,
    props.data?.profileId,
    props.data?.publicId,
    props.profile?.id,
    props.profile?.public_id,
    props.user?.id,
    props.user?.public_id,
    ...memberIds(props.member),
  ])

  // The account panel's card has nothing but the signed-in user to go on. Anywhere else
  // that prop is who's looking, not who's being looked at
  if (!ids.size) return { ids: expandIds([props.currentUser?.id, props.currentUser?.public_id]), self: true }

  me = findProps(el, (p) => typeof p.currentUserId === 'string')?.currentUserId ?? currentUserId() ?? me

  return { ids, self: props.data?.isSelf === true || (me != null && ids.has(me)) }
}

function badgesFor(el: Element, shown: string[]): CardBadge[] {

  const card = { ...identify(el), shown }

  return [...sources].flatMap((source) => source(card))
}

function fillRow(row: Element, badges: CardBadge[]) {

  const key = badges.map((badge) => badge.key).join(',')

  if ((row.getAttribute('data-bf-badges') ?? '') === key) return

  row.querySelectorAll(`.${CARD_BADGE}`).forEach((el) => el.remove())
  row.setAttribute('data-bf-badges', key)
  row.append(...badges.map((badge) => badge.create()))
}

const isOwnRow = (el: Element) => el.hasAttribute(OWN_ROW)
const isNativeRow = (el: Element) => el.matches(Selectors.profileBadges) && !isOwnRow(el)

function updateOwnRow(line: Element, holder: Element, rowClass: string, place: (row: Element) => void) {

  const native = holder.matches(Selectors.accountCard)
    ? [...holder.querySelectorAll(Selectors.profileBadges)].find(isNativeRow)
    : [...holder.children].find(isNativeRow)
  const own = holder.querySelector(`:scope > [${OWN_ROW}]`)

  if (native) {

    own?.remove()

    return
  }

  const badges = badgesFor(line, [])

  if (!badges.length) {

    own?.remove()

    return
  }

  const row = own ?? h('div', { class: rowClass, [OWN_ROW]: '', 'aria-label': 'Profile badges' })

  fillRow(row, badges)

  if (!own) place(row)
}

// Fenrid's username line ("@name • pronouns") in a profile card, for cards with no badge row to join
function updateCards(root: Element) {

  for (const row of root.querySelectorAll(Selectors.profileBadges)) {

    if (isOwnRow(row)) continue

    const shown = findProps(row, (p) => Array.isArray(p.badges))?.badges ?? []

    fillRow(row, badgesFor(row, shown))
  }

  for (const line of root.querySelectorAll('p')) {

    if (!line.textContent?.trim().startsWith('@') || line.closest(Selectors.message) || line.closest('.bf-root')) continue

    const accountCard = line.closest(Selectors.accountCard)

    if (accountCard) updateOwnRow(line, accountCard, ACCOUNT_ROW_CLASS, (row) => accountCard.prepend(row))
    else if (line.parentElement?.classList.contains('flex-wrap')) updateOwnRow(line, line.parentElement, ROW_CLASS, (row) => line.after(row))
  }
}

function refresh() {

  if (document.body) updateCards(document.body)

}

/**
 * Adds badges to profile cards, next to Fenrid's own. The source decides what each card
 * shows, and runs again from the returned function when its answer changes
 */
export function addCardBadges(ctx: PluginContext<any>, source: CardBadgeSource): () => void {

  sources.add(source)

  ctx.onDomChange((added) => {

    for (const el of added) {

      if (el.closest(`.${CARD_BADGE}, [${OWN_ROW}]`)) continue

      // A badge row can appear inside a card that is already open
      updateCards(el.closest(Selectors.profileBadges)?.parentElement ?? el)
    }
  })

  ctx.onStop(() => {

    sources.delete(source)
    refresh()
  })

  refresh()

  return refresh
}