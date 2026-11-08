import { findClickableByText, findTextNode, h, replaceIcon, replaceText, sanitizeClone } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { Selectors } from '../core/selectors'
import { settings } from '../core/settings'
import { NAME } from '../meta'
import { icon } from '../ui/icons'
import { pageIcon, pagesKey, visiblePages, type Page } from '../ui/settingsSidebar'

const S = Selectors.settings
const SECTION = 'data-bf-mobile-section'

const SETTINGS_BACK = /^back to settings list$/i
const SETTINGS_CLOSE = /^close settings$/i

const CSS = `
.bf-mobile-page {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  background: var(--main-chat-area, var(--bf-bg));
  animation: bf-fade-in 120ms ease-out;
}

.bf-mobile-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 12px;
  border-bottom: 1px solid var(--bf-border);
  box-sizing: border-box;
}

.bf-mobile-back svg {
  transform: rotate(90deg);
}

.bf-mobile-title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.bf-mobile-scroll {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 16px 32px;
}
`

function visible(el: Element) {

  return el.getClientRects().length > 0
}

function findButton(label: RegExp): HTMLElement | null {

  return [...document.querySelectorAll<HTMLElement>('[role="dialog"] button[aria-label]')].find((b) => label.test(b.getAttribute('aria-label')!) && visible(b)) ?? null
}

function generalHeader(nav: Element): HTMLElement | null {

  const header = findTextNode(nav, S.insertBeforeHeader, true)?.parentElement

  return header?.parentElement?.tagName === 'SECTION' && header.parentElement.parentElement === nav ? header : null
}

// Only on narrow screens. Wider ones get the desktop sidebar, which the core handles
function findMobileNav(): HTMLElement | null {

  for (const nav of document.querySelectorAll<HTMLElement>('[role="dialog"] nav')) {

    if (nav.closest('aside') || !visible(nav) || !findTextNode(nav, S.sidebarMarkers[1])) continue

    if (generalHeader(nav)) return nav
  }

  return null
}

export default definePlugin({
  id: 'androidSupport',
  name: 'Android Support',
  description: 'Fits Better Fenrid to the Android app: its pages show up in the phone settings list, and the back button closes them and Fenrid\'s settings. Always on in the app.',
  authors: ['Better Fenrid'],
  androidOnly: true,
  required: true,
  enabledByDefault: true,

  start(ctx) {

    ctx.addStyle(CSS)

    let section: HTMLElement | null = null
    let builtFor = ''
    let page: HTMLElement | null = null

    const closePage = () => {

      page?.remove()
      page = null
    }

    const openPage = (nav: Element, target: Page) => {

      const host = nav.closest('[role="dialog"]')

      if (!host) return

      closePage()

      const body = h('div', { class: 'bf-mobile-scroll' })
      const fill = () => body.replaceChildren(target.render({ refresh: fill }))

      page = h(
        'div',
        { class: 'bf-root bf-mobile-page', role: 'region', 'aria-label': target.title },
        h(
          'header',
          { class: 'bf-mobile-header' },
          h('button', { class: 'bf-icon-btn bf-mobile-back', type: 'button', 'aria-label': 'Back', onClick: closePage }, icon('chevron', 22)),
          h('h2', { class: 'bf-mobile-title' }, target.title),
        ),
        body,
      )

      // Keep typing in our inputs from reaching Fenrid's shortcuts
      page.addEventListener('keydown', (e) => {

        if (e.key !== 'Escape') e.stopPropagation()
      })

      fill()
      host.append(page)
    }

    // A row copied from Fenrid's own "Language" row, so it looks native
    const buildRow = (template: Element, nav: Element, target: Page): Element => {

      const row = template.cloneNode(true) as HTMLElement

      sanitizeClone(row)
      replaceText(row, S.templateItem, target.label)
      replaceIcon(row, pageIcon(target))

      row.addEventListener('click', (e) => {

        e.preventDefault()
        e.stopPropagation()
        openPage(nav, target)
      }, true)

      return row
    }

    const inject = (nav: HTMLElement) => {

      const header = generalHeader(nav)!
      const general = header.parentElement!
      const list = general.children[1]
      const template = findClickableByText(nav, S.templateItem)

      if (!list || !template) return ctx.log.warn(`Couldn't find the "${S.templateItem}" row to copy. Check core/selectors.ts.`)

      const ourHeader = header.cloneNode(true) as HTMLElement
      const ourList = list.cloneNode(false) as HTMLElement

      ourHeader.textContent = NAME
      ourList.append(...visiblePages().map((target) => buildRow(template, nav, target)))

      section = general.cloneNode(false) as HTMLElement
      sanitizeClone(section)
      section.setAttribute(SECTION, '')
      section.append(ourHeader, ourList)
      general.before(section)

      builtFor = pagesKey()
    }

    const check = () => {

      if (page && !page.isConnected) page = null

      if (section?.isConnected && builtFor === pagesKey()) return

      section?.remove()
      section = null

      const nav = findMobileNav()

      if (nav) inject(nav)
    }

    ctx.onDomChange(check)
    ctx.onStop(settings.subscribe(check))

    // Back closes our page first, then steps back through Fenrid's settings
    const offBack = window.BetterFenridNative?.onBack?.(() => {

      if (page?.isConnected) {

        closePage()

        return true
      }

      const button = findButton(SETTINGS_BACK) ?? findButton(SETTINGS_CLOSE)

      button?.click()

      return !!button
    })

    if (offBack) ctx.onStop(offBack)

    ctx.onStop(() => {

      closePage()
      section?.remove()
    })

    check()
  },
})