import { h } from '../core/dom'
import { icon } from './icons'

let panel: HTMLElement | null = null
let target: Element | null = null
let resizeObserver: ResizeObserver | null = null

function position() {

  if (!panel || !target) return

  const want = target.getBoundingClientRect()

  const apply = (top: number, left: number) => Object.assign(panel!.style, {
    top: `${top}px`,
    left: `${left}px`,
    width: `${want.width}px`,
    height: `${want.height}px`,
  })

  apply(want.top, want.left)

  // Inside a transformed ancestor (common for modals) "fixed" is relative to that ancestor, so correct the offset
  const got = panel.getBoundingClientRect()
  const dx = want.left - got.left
  const dy = want.top - got.top

  if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) apply(want.top + dy, want.left + dx)
}

function backgroundOf(el: Element): string | null {

  for (let n: Element | null = el; n; n = n.parentElement) {

    const bg = getComputedStyle(n).backgroundColor

    if (bg && bg !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(bg)) return bg
  }

  return null
}

export function findContentArea(sidebar: Element): Element | null {

  const sb = sidebar.getBoundingClientRect()

  for (let n: Element | null = sidebar; n?.parentElement; n = n.parentElement) {

    const siblings = [...n.parentElement.children].filter((c) => c !== n)

    let best: Element | null = null
    let bestArea = 0

    for (const s of siblings) {

      const r = s.getBoundingClientRect()
      const area = r.width * r.height

      // The content area sits beside the sidebar, never on top of it (the sidebar's own header etc. would)
      const beside = r.left >= sb.right - 1 || r.right <= sb.left + 1

      if (beside && r.width > 300 && r.height > 200 && area > bestArea) {

        best = s
        bestArea = area

      }
    }

    if (best) return best
  }

  return null
}

// Fenrid's own close button sits under our panel, so our X forwards to it
function findNativeClose(content: Element): HTMLElement | null {

  const scope = content.closest('[role="dialog"]') ?? content
  const area = content.getBoundingClientRect()
  const buttons = [...scope.querySelectorAll<HTMLElement>('button, [role="button"]')].filter((b) => !b.closest('.bf-root'))

  const labelled = buttons.find((b) => /close/i.test(b.getAttribute('aria-label') ?? b.title ?? ''))

  if (labelled) return labelled

  // Otherwise: an icon-only button in the top right corner of the content area
  return buttons.find((b) => {

    const r = b.getBoundingClientRect()

    return !b.textContent?.trim() && r.top - area.top < 90 && area.right - r.right < 120

  }) ?? null
}

function closeSettings(content: Element) {

  const native = findNativeClose(content)

  if (native) return native.click()

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }))
}

// Reuse the font of Fenrid's page title (its header uses a display font)
function copyHeadingFont(content: Element, into: HTMLElement) {

  const heading = content.querySelector('h1, h2')

  if (heading) into.style.setProperty('--bf-heading-font', getComputedStyle(heading).fontFamily)
}

export function openPanel(content: Element, title: string, page: Node) {

  if (!panel || target !== content) {

    closePanel()

    target = content
    panel = h('div', { class: 'bf-root bf-panel', role: 'region', 'aria-label': 'Better Fenrid' })

    // An attribute, because React rewrites className. See-through themes would otherwise show the page below
    target.setAttribute('data-bf-covered', '')

    const bg = backgroundOf(content)

    if (bg) panel.style.setProperty('--bf-panel-bg', bg)

    copyHeadingFont(content, panel)

    // Keep typing in our inputs from triggering Fenrid's global shortcuts (Escape still closes settings)
    panel.addEventListener('keydown', (e) => {

      if (e.key !== 'Escape') e.stopPropagation()

    })

    // Mount inside Fenrid's dialog if there is one, so its focus trap doesn't steal focus from our inputs
    const host = content.closest('[role="dialog"]') ?? document.body

    host.append(panel)

    resizeObserver = new ResizeObserver(position)
    resizeObserver.observe(content)

    window.addEventListener('resize', position)
  }

  const owner = content

  const header = h(
    'header',
    { class: 'bf-panel-header' },
    h('h2', { class: 'bf-panel-title' }, title),
    h('button', { class: 'bf-icon-btn', type: 'button', 'aria-label': 'Close', onClick: () => closeSettings(owner) }, icon('close', 22)),
  )

  const inner = h('div', { class: 'bf-panel-inner' }, page)

  panel.replaceChildren(header, h('div', { class: 'bf-panel-scroll' }, inner))

  position()
}

export function closePanel() {

  target?.removeAttribute('data-bf-covered')
  panel?.remove()
  resizeObserver?.disconnect()

  window.removeEventListener('resize', position)

  panel = null
  target = null
  resizeObserver = null

}

export function isPanelOpen() {

  return panel !== null

}