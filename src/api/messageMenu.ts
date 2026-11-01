import { findClickableByText, findTextNode, onDomChange, replaceIcon, replaceText, sanitizeClone } from '../core/dom'
import { createLogger } from '../core/logger'
import { Selectors } from '../core/selectors'
import { icon, isIconName, type IconName } from '../ui/icons'

export interface MessageContext {
  element: HTMLElement | null
  id: string | null
  text: string
}

export interface MessageMenuItem {
  id: string
  label: string
  icon?: IconName | (string & {})
  danger?: boolean
  visible?(msg: MessageContext): boolean
  action(msg: MessageContext): void
}

const log = createLogger('MessageMenu')
const items = new Map<string, MessageMenuItem>()
const MARK = 'data-bf-menu-item'
const SNOWFLAKE = /\b\d{15,20}\b/

let lastTarget: Element | null = null
let started = false

export function addMessageMenuItem(item: MessageMenuItem): () => void {

  items.set(item.id, item)

  ensureStarted()

  return () => {
    items.delete(item.id)
    document.querySelectorAll(`[${MARK}="${CSS.escape(item.id)}"]`).forEach((el) => el.remove())
  }
}

function ensureStarted() {

  if (started) return

  started = true

  const remember = (e: Event) => {

    const target = e.target as Element | null

    if (target && !target.closest(`[${MARK}]`)) lastTarget = target
  }

  document.addEventListener('contextmenu', remember, true)
  document.addEventListener('pointerdown', remember, true)

  onDomChange((added) => {

    if (items.size === 0) return

    for (const el of added) {

      const text = el.textContent ?? ''

      if (!Selectors.messageMenu.markers.some((m) => text.includes(m))) continue

      // Items can be appended to an already open menu, so look at the whole menu
      inject(el.closest('[role="menu"]') ?? el.parentElement ?? el)
    }
  })
}

function findMessage(from: Element | null): MessageContext {

  for (let n = from; n && n !== document.body; n = n.parentElement) {

    for (const attr of n.attributes) {

      if (attr.name === 'class' || attr.name === 'style') continue

      const match = attr.value.match(SNOWFLAKE)

      if (match) return { element: n as HTMLElement, id: match[0], text: extractText(n) }
    }
  }

  const element = (from?.closest('article, li, [role="article"], [role="listitem"]') as HTMLElement | null) ?? null

  return { element, id: null, text: extractText(element) }
}

function extractText(el: Element | null): string {

  if (!el) return ''

  const content = el.querySelector('[class*="content" i], [class*="markdown" i], [class*="body" i], p')

  return ((content ?? el) as HTMLElement).innerText.trim()
}

function inject(root: Element) {

  const anchorLabel = Selectors.messageMenu.anchors.find((label) => findTextNode(root, label))

  if (!anchorLabel) return

  // A chat message that happens to say "Copy Text" isn't a menu: require a second known label
  const labels = new Set<string>([...Selectors.messageMenu.anchors, ...Selectors.messageMenu.markers])

  if ([...labels].filter((label) => findTextNode(root, label)).length < 2) return

  const anchor = findClickableByText(root, anchorLabel)

  if (!anchor?.parentElement) return

  const container = anchor.parentElement

  if (container.querySelector(`[${MARK}]`)) return

  const msg = findMessage(lastTarget)
  const visible = [...items.values()].filter((item) => item.visible?.(msg) ?? true)

  if (!visible.length) return

  log.debug('Injecting into message menu', msg)

  const nodes: Element[] = []
  const separator = (anchor.closest('[role="menu"]') ?? container).querySelector('[role="separator"], hr')

  if (separator) {

    const sep = separator.cloneNode(true) as Element

    sep.setAttribute(MARK, 'separator')
    nodes.push(sep)

  }

  for (const item of visible) {

    const el = anchor.cloneNode(true) as HTMLElement

    sanitizeClone(el)

    el.setAttribute(MARK, item.id)
    el.classList.toggle('bf-danger', !!item.danger)

    replaceText(el, anchorLabel, item.label)

    if (item.icon) replaceIcon(el, isIconName(item.icon) ? icon(item.icon) : item.icon)

    el.addEventListener(
      'click',
      (e) => {
        e.preventDefault()
        e.stopPropagation()
        closeMenu(anchor)
        try {

          item.action(msg)

        } catch (err) {

          log.error(`Menu item "${item.id}" failed`, err)

        }
      },
      true,
    )
    nodes.push(el)
  }

  anchor.after(...nodes)
}

function closeMenu(anchor: Element) {

  const opts = { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }

  document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', opts))

  requestAnimationFrame(() => {

    if (!anchor.isConnected) return

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  })
}