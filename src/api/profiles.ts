import type { PluginContext } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'

const RECHECK_MS = 15_000

type Profile = Record<string, any> | null | undefined

function triggersIn(root: Element): Element[] {
  return [...(root.matches(Selectors.profileTrigger) ? [root] : []), ...root.querySelectorAll(Selectors.profileTrigger)]
}

/**
 * Runs `update` for everything that opens a profile card: names in messages and
 * the member list, avatars and mentions. Nothing on the page changes when the
 * data behind them does, so they're also rechecked on a timer
 */
export function watchProfileTriggers(ctx: PluginContext<any>, update: (trigger: Element) => void): () => void {

  const updateAll = () => {

    if (document.body) triggersIn(document.body).forEach(update)

  }

  ctx.onDomChange((added) => added.flatMap(triggersIn).forEach(update))

  const timer = setInterval(updateAll, RECHECK_MS)

  ctx.onStop(() => clearInterval(timer))

  updateAll()

  return updateAll
}

export function memberOf(trigger: Element): Record<string, any> | null {
  return findProps(trigger, (props) => !!props.member)?.member ?? null
}

function firstTextParent(root: Element): Element | null {

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  for (let n = walker.nextNode(); n; n = walker.nextNode()) {

    if (n.nodeValue?.trim()) return n.parentElement

  }

  return null
}

export function isMention(trigger: Element): boolean {
  return trigger.textContent?.trim().startsWith('@') ?? false
}

/** The element holding a mention's text, or null for anything that isn't a mention */
export function mentionTextOf(trigger: Element): Element | null {
  return isMention(trigger) ? firstTextParent(trigger) : null
}

/** Adds, keeps or removes a badge right after a name. Avatars have no text, so they're skipped */
/** Badges sit beside the name, which can be the trigger itself, so the search starts at its parent */
export function findNameBadge(trigger: Element, className: string): Element | null {
  return firstTextParent(trigger)?.parentElement?.querySelector(`:scope > .${className}`) ?? null
}

/** Adds, keeps or removes a badge right after a name. Avatars have no text, so they're skipped */
export function setNameBadge(trigger: Element, className: string, create: (() => Element) | null) {

  const existing = findNameBadge(trigger, className)

  if (!create) {

    existing?.remove()

    return
  }

  if (!existing) firstTextParent(trigger)?.after(create())
}

export function avatarUrl(profile: Profile): string | null {

  if (typeof profile?.avatarUrl === 'string') return profile.avatarUrl

  let assets = profile?.assets

  if (typeof assets === 'string') {

    try {

      assets = JSON.parse(assets)

    } catch {

      return null

    }
  }

  const avatar = assets?.avatar

  return profile?.id && avatar?.key && avatar?.ext ? `${Selectors.cdn}/profiles/${profile.id}/avatars/${avatar.key}.${avatar.ext}` : null
}