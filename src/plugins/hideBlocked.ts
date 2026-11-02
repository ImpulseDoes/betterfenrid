import { onApiResponse, onApiResult } from '../api/network'
import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'

const HIDDEN = 'data-bf-blocked'
const BLOCKS_PATH = /^\/api\/blocks(\/[^/]+)?$/

function blockedIds(body: any): Set<string> | null {

  if (!Array.isArray(body?.blocks)) return null

  return new Set(body.blocks.map((block: any) => block?.blocked_id ?? block?.blocked?.id).filter(Boolean).map(String))
}

function authorOf(el: Element): string | null {

  const props = findProps(el, (p) => !!p.message && typeof p.message === 'object' && 'author_id' in p.message)
  const author = props?.message.author_id

  return author == null ? null : String(author)
}

// Fenrid tags both a message's wrapper and its row, and embeds and reactions sit in the wrapper, outside the row
function outermost(el: Element): Element | null {

  let message = el.closest(Selectors.message)

  while (message?.parentElement?.closest(Selectors.message)) message = message.parentElement.closest(Selectors.message)

  return message
}

function messageAuthor(message: Element): string | null {

  return authorOf(message) ?? [...message.querySelectorAll(Selectors.message)].map(authorOf).find(Boolean) ?? null
}

export default definePlugin({
  id: 'hideBlocked',
  name: 'Hide Blocked Users',
  description: 'Hides messages from people you blocked, instead of showing them in chat.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,

  start(ctx) {

    let blocked = new Set<string>()

    const render = (root: ParentNode) => {

      const messages = new Set<Element>()

      if (root instanceof Element) {

        const message = outermost(root)

        if (message) messages.add(message)

      }

      for (const el of root.querySelectorAll(Selectors.message)) {

        const message = outermost(el)

        if (message) messages.add(message)

      }

      for (const message of messages) {

        const author = messageAuthor(message)

        message.toggleAttribute(HIDDEN, !!author && blocked.has(author))
      }
    }

    const setBlocked = (next: Set<string>) => {

      blocked = next
      render(document)
    }

    // Fenrid's chat doesn't look at blocks, only its profile cards do, so the list is fetched here
    let request = 0

    const refresh = async () => {

      const id = ++request

      try {

        const res = await fetch('/api/blocks', { credentials: 'include', cache: 'no-store' })
        const next = res.ok ? blockedIds(await res.json()) : null

        if (next && id === request) setBlocked(next)

      } catch (error) {

        ctx.log.warn('Could not load blocked users', error)

      }
    }

    // Fenrid loads the list itself when you open a profile
    ctx.onStop(
      onApiResponse((url, body) => {

        if (url.pathname !== '/api/blocks') return

        const next = blockedIds(body)

        if (next) setBlocked(next)
      }),
    )

    ctx.onStop(
      onApiResult(({ url, method, ok }) => {

        if (ok && method !== 'GET' && BLOCKS_PATH.test(url.pathname)) void refresh()

      }),
    )

    const onPrivacy = () => void refresh()

    window.addEventListener('fenrid:privacy-updated', onPrivacy)

    ctx.onStop(() => {

      window.removeEventListener('fenrid:privacy-updated', onPrivacy)
      document.querySelectorAll(`[${HIDDEN}]`).forEach((el) => el.removeAttribute(HIDDEN))
    })

    ctx.onDomChange((added) => {

      if (!blocked.size) return

      for (const el of added) render(el)
    })

    void refresh()
  },
})