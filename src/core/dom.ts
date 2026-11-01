type Child = Node | string | null | undefined | false
type Props = Record<string, unknown>

// Tiny element factory: h('div', { class: 'x', onClick }, 'text', child)
export function h<K extends keyof HTMLElementTagNameMap>(

  tag: K,
  props: Props = {},
  ...children: Child[]

): HTMLElementTagNameMap[K] {

  const el = document.createElement(tag)

  for (const [key, value] of Object.entries(props)) {

    if (value == null || value === false) continue
    if (key.startsWith('on') && typeof value === 'function') {

      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener)

    } else if (key === 'class') {

      el.className = String(value)

    } else if (key === 'value' || key === 'checked') {

      (el as unknown as Props)[key] = value

    } else {

      el.setAttribute(key, value === true ? '' : String(value))

    }

  }

  for (const child of children) {

    if (child != null && child !== false) el.append(child)

  }

  return el
}

/**
 * First text node under `root` whose trimmed value equals `text`
 * `ignoreCase` helps with headers that are uppercased only through CSS
 */
export function findTextNode(root: Node, text: string, ignoreCase = false): Text | null {

  const want = ignoreCase ? text.toLowerCase() : text
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  for (let n = walker.nextNode(); n; n = walker.nextNode()) {

    const value = n.nodeValue?.trim()

    if ((ignoreCase ? value?.toLowerCase() : value) === want) return n as Text
  }

  return null
}

/** First text node under `root` that starts with `prefix` */
export function findTextNodeStartingWith(root: Node, prefix: string): Text | null {

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  for (let n = walker.nextNode(); n; n = walker.nextNode()) {

    if (n.nodeValue?.trim().startsWith(prefix)) return n as Text

  }

  return null
}

export const CLICKABLE =
  'a, button, [role="menuitem"], [role="tab"], [role="link"], [role="button"], [role="option"], [tabindex]'

/** The clickable row that contains the given label */
export function findClickableByText(root: Node, text: string): HTMLElement | null {


  const node = findTextNode(root, text)

  if (!node?.parentElement) return null

  return (node.parentElement.closest(CLICKABLE) as HTMLElement | null) ?? node.parentElement
}

/** Smallest common ancestor of two nodes */
export function commonAncestor(a: Node, b: Node): HTMLElement | null {

  const seen = new Set<Node>()

  for (let n: Node | null = a; n; n = n.parentNode) seen.add(n)
  for (let n: Node | null = b; n; n = n.parentNode) {

    if (seen.has(n)) return n as HTMLElement

  }

  return null
}

/**
 * Walk up from `el` and return the ancestor that is a direct child of
 * `container`, i.e. the "row" of `container` that holds `el`
 */
export function childOf(container: Element, el: Element): Element | null {

  let n: Element | null = el
  while (n && n.parentElement !== container) n = n.parentElement

  return n
}

/** Replace a label inside a (cloned) element. */
export function replaceText(root: Node, from: string, to: string): boolean {

  const node = findTextNode(root, from)

  if (!node) return false

  node.nodeValue = node.nodeValue!.replace(from, to)

  return true
}

/**
 * Swap the first <svg>/<img> in `root` for `icon` (an element or an emoji),
 * keeping the original's sizing classes
 */
export function replaceIcon(root: Element, icon: Element | string) {

  const old = root.querySelector('svg, img')

  if (!old) return

  let next: Element

  if (typeof icon !== 'string') {

    next = icon

    const cls = old.getAttribute('class')

    if (cls) next.setAttribute('class', cls)

    for (const attr of ['width', 'height']) {

      const v = old.getAttribute(attr)

      if (v) next.setAttribute(attr, v)

    }

  } else {

    next = h('span', { class: 'bf-emoji-icon' }, icon)

  }

  old.replaceWith(next)
}

/**
 * Clean up a cloned element so the router, React and screen readers don't
 * mistake it for the original. Clones never carry React's event handlers
 */
export function sanitizeClone(el: Element) {

  for (const node of [el, ...el.querySelectorAll('*')]) {

    for (const attr of ['id', 'href', 'aria-current', 'aria-selected', 'aria-checked', 'data-active']) {

      node.removeAttribute(attr)

    }

    if (node.getAttribute('data-state') === 'active') node.removeAttribute('data-state')

  }
}

type MutationHandler = (added: Element[]) => void
const handlers = new Set<MutationHandler>()

let pending: Element[] = []
let scheduled = false

/**
 * Subscribe to page changes. Handlers get the elements added since the last
 * call (possibly none, when something was only removed). One shared
 * MutationObserver serves the whole mod, and changes are batched per animation
 * frame so busy chats don't run our handlers on every single mutation
 */
export function onDomChange(handler: MutationHandler): () => void {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

function flush() {

  const batch = pending.filter((el) => el.isConnected)

  pending = []
  scheduled = false

  for (const handler of handlers) {

    try {

      handler(batch)

    } catch (err) {

      console.error('[Better Fenrid] DOM handler failed', err)

    }
  }
}

export function startObserver() {

  new MutationObserver((mutations) => {

    let changed = false

    for (const m of mutations) {

      if (m.removedNodes.length) changed = true

      for (const n of m.addedNodes) {

        if (n.nodeType === Node.ELEMENT_NODE) pending.push(n as Element)

      }

    }

    if (!scheduled && (changed || pending.length)) {

      scheduled = true
      requestAnimationFrame(flush)

    }

  }).observe(document.body, { childList: true, subtree: true })
}