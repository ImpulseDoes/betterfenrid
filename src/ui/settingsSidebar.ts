import {
  childOf,
  CLICKABLE,
  commonAncestor,
  findClickableByText,
  findTextNode,
  findTextNodeStartingWith,
  onDomChange,
  replaceIcon,
  replaceText,
  sanitizeClone,
} from '../core/dom'
import { createLogger } from '../core/logger'
import { getPlugins, isEnabled } from '../core/plugins'
import { Selectors } from '../core/selectors'
import { settings } from '../core/settings'
import { NAME, VERSION } from '../meta'
import { fittedIcon, withBurst, type IconName } from './icons'
import { CreditsPage } from './pages/credits'
import { PluginsPage } from './pages/plugins'
import { SettingsPage } from './pages/settings'
import { ThemesPage } from './pages/themes'
import { closePanel, findContentArea, openPanel } from './panel'

export interface PageContext {
  refresh(): void
}

interface Page {
  id: string
  label: string
  title: string
  icon: IconName
  render(ctx: PageContext): Node
}

const PAGES: Page[] = [
  { id: 'settings', label: 'Settings', title: 'Better Fenrid', icon: 'settings', render: SettingsPage },
  { id: 'plugins', label: 'Plugins', title: 'Plugins', icon: 'plugins', render: PluginsPage },
  { id: 'themes', label: 'Themes', title: 'Themes', icon: 'themes', render: ThemesPage },
]

const CREDITS: Page = { id: 'credits', label: 'Credits', title: 'Credits', icon: 'heart', render: CreditsPage }

function visiblePages(): Page[] {

  return [...PAGES, ...getPlugins().flatMap((plugin) => (plugin.page && isEnabled(plugin.id) ? [plugin.page] : [])), CREDITS]
}

const pagesKey = () => visiblePages().map((page) => page.id).join()

const S = Selectors.settings
const NAV = 'data-bf-nav'
const FOOTER = 'data-bf-footer'
const log = createLogger('Settings')

let sidebar: HTMLElement | null = null
let injected: Element[] = []
let activePage: string | null = null
let injectedPages = ''
interface Look {
  on: string[]
  off: string[]
  selectedBg: string
  selectedColor: string
  normalBg: string
  normalColor: string
}

let look: Look | null = null
let restoreNative: (() => void) | null = null
const wired = new WeakSet<Element>()

export function startSettingsInjection() {

  onDomChange(check)

  settings.subscribe(() => {

    if (!sidebar) return

    updateFooter(sidebar)
    syncPages(sidebar)
  })
}

function syncPages(sb: HTMLElement) {

  if (!injected.length || injectedPages === pagesKey()) return

  if (activePage && !visiblePages().some((page) => page.id === activePage)) closePage()

  inject(sb)
}

function check(added: Element[]) {
  if (sidebar && !sidebar.isConnected) {
    log.debug('Settings closed')
    closePage()
    sidebar = null
    injected = []
  }

  if (!sidebar) {

    for (const el of added) {

      if (!el.textContent?.includes(S.sidebarMarkers[1])) continue

      const found = findSidebar(el)

      if (found) {

        sidebar = found

        break
      }
    }

    if (!sidebar) return

    log.debug('Settings sidebar found', sidebar)
  }

  if (injected.length === 0 || !injected.every((n) => n.isConnected)) inject(sidebar)
  updateFooter(sidebar)
}

/**
 * Items may be added one by one to an existing container, so the added element
 * alone might hold only one marker walk up until all markers are inside
 */
function findSidebar(from: Element): HTMLElement | null {

  for (let root: Element | null = from; root && root !== document.documentElement; root = root.parentElement) {

    const nodes = S.sidebarMarkers.map((label) => findTextNode(root!, label))

    if (nodes.every(Boolean)) {

      return nodes.reduce<Node>((acc, n) => commonAncestor(acc, n!) ?? acc, nodes[0]!) as HTMLElement

    }
  }

  return null
}

/** Grow `el` upward through wrappers that contain nothing else (e.g. <li><a>). */
function unitOf(el: Element, stop: Element): Element {

  let n = el

  while (n.parentElement && n.parentElement !== stop && n.parentElement.children.length === 1) n = n.parentElement

  return n
}

function inject(sb: HTMLElement) {

  for (const n of injected) n.remove()
  injected = []

  const pages = visiblePages()

  injectedPages = pagesKey()

  const template = findClickableByText(sb, S.templateItem)

  if (!template) {

    log.warn(`Couldn't find the "${S.templateItem}" item to copy. Check core/selectors.ts.`)

    return
  }

  const headerText = findTextNode(sb, S.insertBeforeHeader, true)
  const headerLabel = headerText && /^[^a-z]+$/.test(headerText.nodeValue!.trim()) ? NAME.toUpperCase() : NAME

  if (!headerText?.parentElement) {

    const unit = unitOf(template, sb)
    const items = pages.map((p) => buildItem(unit, p))

    unit.after(...items)
    injected = items

  } else {

    const root = commonAncestor(headerText.parentElement, template)!
    const headerRow = childOf(root, headerText.parentElement)!
    const templateRow = childOf(root, template)!
    const templateUnit = unitOf(template, templateRow.parentElement === root ? root : templateRow)

    if (headerRow.querySelector(CLICKABLE)) {

      const group = headerRow.cloneNode(true) as Element

      sanitizeClone(group)
      replaceHeader(group, headerLabel)

      const clickables = [...group.querySelectorAll(CLICKABLE)].filter((c) => !c.parentElement?.closest(CLICKABLE))
      const units = clickables.map((c) => unitOf(c, group))
      const list = units[0]?.parentElement ?? group

      for (const u of units) u.remove()

      list.append(...pages.map((p) => buildItem(templateUnit, p)))
      headerRow.before(group)

      injected = [group]

    } else {

      // Flat layout: headers and items are siblings

      const header = headerRow.cloneNode(true) as Element
      sanitizeClone(header)
      replaceHeader(header, headerLabel)

      const items = pages.map((p) => buildItem(templateRow, p))

      headerRow.before(header, ...items)

      injected = [header, ...items]
    }
  }

  for (const n of injected) n.setAttribute('data-bf-injected', '')

  wireSidebar(sb)

  // Also strips a selected look our clones may have copied from the template
  highlight()

  log.debug('Injected settings section')
}

function replaceHeader(el: Element, label: string) {

  const node = findTextNode(el, S.insertBeforeHeader, true)

  if (node) node.nodeValue = label
}

function buildItem(template: Element, page: Page): Element {

  const row = template.cloneNode(true) as HTMLElement

  sanitizeClone(row)

  row.setAttribute(NAV, page.id)

  replaceText(row, S.templateItem, page.label)
  replaceIcon(row, page.id === 'credits' ? withBurst(fittedIcon(page.icon)) : fittedIcon(page.icon))

  const open = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    openPage(page.id)
  }

  row.addEventListener('click', open, true)
  row.addEventListener('keydown', (e) => {

    if (e.key === 'Enter' || e.key === ' ') open(e)

  })

  return row
}

/** Clicking any of Fenrid's own items closes our page */
function wireSidebar(sb: HTMLElement) {

  if (wired.has(sb)) return

  wired.add(sb)

  sb.addEventListener(
    'click',
    (e) => {

      const t = e.target as Element

      if (!t.closest(`[${NAV}]`) && t.closest(CLICKABLE)) closePage()
    },
    true,
  )
}

function openPage(id: string) {

  const page = visiblePages().find((p) => p.id === id)

  if (!sidebar || !page) return

  const content = findContentArea(sidebar)

  if (!content) {
    log.warn("Couldn't find the settings content area")
    return
  }

  activePage = id

  highlight()
  openPanel(content, page.title, page.render({ refresh: () => openPage(id) }))
}

function closePage() {

  if (!activePage) return

  activePage = null
  closePanel()
  highlight()
}

// Fenrid's own nav rows: same tag and about the same height as the template item, with an icon
function navItems(sb: HTMLElement): HTMLElement[] {

  const template = findClickableByText(sb, S.templateItem)

  if (!template) return []

  const height = template.getBoundingClientRect().height

  return [...sb.querySelectorAll<HTMLElement>(template.tagName)].filter((el) =>
    !el.closest('[data-bf-injected]') &&
    !!el.querySelector('svg, img') &&
    Math.abs(el.getBoundingClientRect().height - height) < 6,
  )
}

const SELECTED = '[aria-current]:not([aria-current="false"]), [aria-selected="true"], [data-active="true"], [data-state="active"], [data-selected="true"]'

// The selected native item: by ARIA if Fenrid marks it, otherwise the one whose background differs from the rest
function findSelected(items: HTMLElement[]): HTMLElement | null {

  const aria = items.find((el) => el.matches(SELECTED))

  if (aria) return aria

  const bgs = items.map((el) => getComputedStyle(el).backgroundColor)
  const counts = new Map<string, number>()

  for (const bg of bgs) counts.set(bg, (counts.get(bg) ?? 0) + 1)

  const normal = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const odd = items.filter((_, i) => bgs[i] !== normal)

  return odd.length === 1 ? odd[0] : null
}

// Classes the selected item has (on) or lacks (off) compared to every other item
function learnLook(items: HTMLElement[], selected: HTMLElement): Look | null {

  const others = items.filter((el) => el !== selected)

  if (!others.length) return null

  const common = others
    .map((el) => new Set(el.classList))
    .reduce((a, b) => new Set([...a].filter((c) => b.has(c))))

  const mine = new Set(selected.classList)
  const on = [...mine].filter((c) => !common.has(c))
  const off = [...common].filter((c) => !mine.has(c))

  // Colours too, for when the selected look isn't done with classes
  const style = getComputedStyle(selected)
  const normal = getComputedStyle(others[0])

  return { on, off, selectedBg: style.backgroundColor, selectedColor: style.color, normalBg: normal.backgroundColor, normalColor: normal.color }
}

function setSelected(el: HTMLElement, selected: boolean): () => void {

  if (!look) return () => { }

  if (!look.on.length && !look.off.length) {

    const clear = () => {

      el.style.removeProperty('background-color')
      el.style.removeProperty('color')

    }

    clear()

    // Our items get the selected colours, the native item gets the normal ones
    if (selected === el.hasAttribute(NAV)) {

      el.style.setProperty('background-color', selected ? look.selectedBg : look.normalBg, 'important')
      el.style.setProperty('color', selected ? look.selectedColor : look.normalColor, 'important')

    }

    return clear
  }

  const add = selected ? look.on : look.off
  const remove = selected ? look.off : look.on

  el.classList.remove(...remove)
  el.classList.add(...add)

  return () => {

    el.classList.remove(...add)
    el.classList.add(...remove)

  }
}

/**
 * Fenrid's class names are hashed, so we learn what makes a nav item look
 * selected by comparing the selected one with the others, then move that
 * look onto our item while one of our pages is open.
 */
function highlight() {

  if (!sidebar) return

  const items = navItems(sidebar)

  // Put the native item back first, so detection below sees Fenrid's real state
  restoreNative?.()
  restoreNative = null

  if (!look) {

    const selected = findSelected(items)

    if (selected) look = learnLook(items, selected)

  }

  for (const el of sidebar.querySelectorAll<HTMLElement>(`[${NAV}]`)) {

    const active = el.getAttribute(NAV) === activePage

    setSelected(el, active)

    if (active) el.setAttribute('aria-current', 'page')
    else el.removeAttribute('aria-current')

  }

  if (!activePage) return

  const selected = findSelected(items)

  if (selected) restoreNative = setSelected(selected, false)
}

// The version footer sits below the nav list, outside the sidebar element we track, so look a few levels up
function findFooterText(sb: HTMLElement): Text | null {

  const width = sb.getBoundingClientRect().width

  let n: HTMLElement | null = sb

  for (let i = 0; n && i < 6; i++, n = n.parentElement) {

    // Stay inside the sidebar column
    if (n.getBoundingClientRect().width > width * 1.5 + 40) break

    const text = findTextNodeStartingWith(n, S.footerPrefix)

    if (text) return text
  }

  return null
}

function updateFooter(sb: HTMLElement) {

  const existing = document.querySelector(`[${FOOTER}]`)

  if (!settings.get().core.showFooterVersion) {

    existing?.remove()

    return

  }

  if (existing) return

  const text = findFooterText(sb)
  const el = text?.parentElement

  if (!el) return

  const ours = el.cloneNode(false) as HTMLElement

  sanitizeClone(ours)

  ours.setAttribute(FOOTER, '')
  ours.textContent = `${NAME} v${VERSION}`
  el.after(ours)
}