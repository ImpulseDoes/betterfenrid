import { findClickableByText, findTextNode, onDomChange, replaceIcon, replaceText, sanitizeClone } from '../core/dom'
import { createLogger } from '../core/logger'
import { Selectors } from '../core/selectors'
import { fittedIcon, isIconName, type IconName } from '../ui/icons'

export type MenuKind = keyof typeof Selectors.contextMenus

export interface MenuTarget {
  kind: MenuKind
  element: HTMLElement | null
  id: string | null
  text: string
  source?: Element | null
}

export interface ContextMenuItem {
  id: string
  label: string
  icon?: IconName | (string & {})
  danger?: boolean
  // Which menus get this item (defaults to the message menu)
  kinds?: MenuKind[]
  visible?(target: MenuTarget): boolean
  action(target: MenuTarget): void
}

const log = createLogger('ContextMenu')
const items = new Map<string, ContextMenuItem>()
const MARK = 'data-bf-menu-item'
const SNOWFLAKE = /\b\d{15,20}\b/
const KINDS = Object.keys(Selectors.contextMenus) as MenuKind[]
const MARKERS = KINDS.flatMap((kind) => [...Selectors.contextMenus[kind].anchors, ...Selectors.contextMenus[kind].markers])

let lastTarget: Element | null = null
let started = false

export function addContextMenuItem(item: ContextMenuItem): () => void {

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

      if (!MARKERS.some((m) => text.includes(m))) continue

      // Items can be appended to an already open menu, so look at the whole menu
      inject(el.closest('[role="menu"]') ?? el.parentElement ?? el)
    }
  })
}

function findMessage(from: Element | null): MenuTarget {

  const message = from?.closest<HTMLElement>(Selectors.message)

  if (message) return { kind: 'message', element: message, id: message.dataset.messageId ?? null, text: extractText(message) }

  for (let n = from; n && n !== document.body; n = n.parentElement) {

    for (const attr of n.attributes) {

      if (attr.name === 'class' || attr.name === 'style') continue

      const match = attr.value.match(SNOWFLAKE)

      if (match) return { kind: 'message', element: n as HTMLElement, id: match[0], text: extractText(n) }
    }
  }

  const element = (from?.closest('article, li, [role="article"], [role="listitem"]') as HTMLElement | null) ?? null

  return { kind: 'message', element, id: null, text: extractText(element) }
}

export function extractText(el: Element | null): string {

  if (!el) return ''

  const content = el.querySelector('[class*="content" i], [class*="markdown" i], [class*="body" i], p')

  return ((content ?? el) as HTMLElement).innerText.trim()
}

function detectMenu(root: Element): { kind: MenuKind; anchorLabel: string } | null {

  for (const kind of KINDS) {

    const { anchors, markers } = Selectors.contextMenus[kind]
    const anchorLabel = anchors.find((label) => findTextNode(root, label))

    if (!anchorLabel) continue

    // A chat message that happens to say "Copy Text" isn't a menu: require a second known label
    const known = new Set<string>([...anchors, ...markers])

    if (root.matches('[role="menu"]') || [...known].filter((label) => findTextNode(root, label)).length >= 2) {

      return { kind, anchorLabel }

    }
  }

  return null
}

/**
 * Channels and users have no id in the DOM, so press Fenrid's own "Copy ... ID"
 * item and catch what it writes to the clipboard. This also closes the menu
 */
async function readNativeId(anchor: HTMLElement): Promise<string | null> {

  const clipboard = navigator.clipboard as Clipboard & { writeText: Clipboard['writeText'] }

  let id: string | null = null

  clipboard.writeText = async (text) => {
    id = text
  }

  try {

    anchor.click()

    for (let i = 0; i < 10 && id === null; i++) await new Promise((resolve) => setTimeout(resolve, 30))

  } finally {

    delete (clipboard as Partial<Clipboard>).writeText

  }

  return id
}

function inject(root: Element) {

  const menu = detectMenu(root)

  if (!menu) return

  const { kind, anchorLabel } = menu
  const anchor = findClickableByText(root, anchorLabel)

  if (!anchor?.parentElement) return

  const container = anchor.parentElement

  if (container.querySelector(`[${MARK}]`)) return

  const target: MenuTarget = { ...(kind === 'message' ? findMessage(lastTarget) : { kind, element: null, id: null, text: '' }), source: lastTarget }
  const visible = [...items.values()].filter((item) => (item.kinds ?? ['message']).includes(kind) && (item.visible?.(target) ?? true))

  if (!visible.length) return

  log.debug(`Injecting into ${kind} menu`, target)

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

    if (item.icon) replaceIcon(el, isIconName(item.icon) ? fittedIcon(item.icon) : item.icon)

    el.addEventListener(
      'click',
      async (e) => {
        e.preventDefault()
        e.stopPropagation()
        try {

          const id = target.id ?? (await readNativeId(anchor))

          closeMenu(anchor)
          item.action({ ...target, id })

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

  if (!anchor.isConnected) return

  const opts = { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }

  document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', opts))

  requestAnimationFrame(() => {

    if (!anchor.isConnected) return

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  })
}