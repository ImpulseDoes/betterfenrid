import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { Selectors } from '../core/selectors'

const STORAGE_KEY = 'BetterFenrid:pinnedDms'
const ORDERED = 'data-bf-pinned-dms'
const PINNED = 'data-bf-pinned-dm'
const HEADER = 'bf-pinned-dms-header'
const DM_PATH = /^\/channels\/me\/([^/?#]+)$/

function load(): string[] {

  try {

    const ids = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')

    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []

  } catch {

    return []

  }
}

function dmIdOf(el: Element | null | undefined): string | null {

  const link = el?.matches(Selectors.dmLink) ? el : el?.querySelector(Selectors.dmLink)

  return link?.getAttribute('href')?.match(DM_PATH)?.[1] ?? null
}

// The DM list in the sidebar, the server rail shows DMs too but is left alone
function dmLists(): Set<Element> {

  const lists = new Set<Element>()

  for (const link of document.querySelectorAll(Selectors.dmLink)) {

    const row = link.closest(Selectors.dmRow)

    if (row?.parentElement && dmIdOf(row) && !row.closest(Selectors.serverRail)) lists.add(row.parentElement)

  }

  return lists
}

export default definePlugin({
  id: 'pinDms',
  name: 'Pin DMs',
  description: 'Keeps the DMs you pin at the top of the list. Right click a DM to pin it.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,

  start(ctx) {

    let pinned = load()

    const headers = new WeakMap<Element, Element>()

    const headerFor = (list: Element) => {

      let header = headers.get(list)

      if (!header) {

        // Fenrid's own classes, to look like its "Direct Messages" heading
        header = h('div', { class: `${HEADER} mb-2 mt-4 flex items-center justify-between px-2` }, h('span', { class: 'text-[13px] font-medium text-text-muted' }, 'Pinned'))
        headers.set(list, header)

      }

      return header
    }

    const setOrder = (el: Element, order: number) => {

      const style = (el as HTMLElement).style

      if (style.order !== String(order)) style.order = String(order)
    }

    const reset = (list: Element) => {

      list.removeAttribute(ORDERED)
      headers.get(list)?.remove()

      for (const child of list.children) {

        (child as HTMLElement).style.order = ''
        child.removeAttribute(PINNED)

      }
    }

    // React owns these rows, so they're never moved: the list becomes a flex column and the rows get an order
    const apply = () => {

      for (const list of dmLists()) {

        const children = [...list.children].filter((child) => !child.classList.contains(HEADER))
        const rows = children.filter((child) => child.matches(Selectors.dmRow) && dmIdOf(child))
        const top = pinned.map((id) => rows.find((row) => dmIdOf(row) === id)).filter((row): row is Element => !!row)

        if (!top.length) {

          reset(list)
          continue

        }

        const first = children.indexOf(rows[0])
        const nativeHeader = first > 0 ? children[first - 1] : null
        const header = headerFor(list)

        let order = 0

        for (const child of children.slice(0, Math.max(0, first - 1))) setOrder(child, order++)

        if (header.parentElement !== list) list.append(header)

        setOrder(header, order++)

        for (const row of top) {

          setOrder(row, order++)
          row.setAttribute(PINNED, '')

        }

        if (nativeHeader) setOrder(nativeHeader, order++)

        for (const child of children.slice(first)) {

          if (top.includes(child)) continue

          setOrder(child, order++)
          child.removeAttribute(PINNED)
        }

        list.setAttribute(ORDERED, '')
      }
    }

    let frame = 0

    const schedule = () => {

      if (!frame) frame = requestAnimationFrame(() => {

        frame = 0
        apply()

      })
    }

    const setPinned = (next: string[]) => {

      pinned = next

      try {

        localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned))

      } catch { }

      apply()
    }

    const targetId = (source: Element | null | undefined) => dmIdOf(source?.closest(Selectors.dmLink) ?? source?.closest(Selectors.dmRow))

    ctx.addContextMenuItem({
      id: 'pin',
      label: 'Pin DM',
      icon: 'pin',
      kinds: ['dm'],
      visible: (target) => {

        const id = targetId(target.source)

        return !!id && !pinned.includes(id)
      },
      action: (target) => {

        const id = targetId(target.source)

        if (id) setPinned([...pinned, id])
      },
    })

    ctx.addContextMenuItem({
      id: 'unpin',
      label: 'Unpin DM',
      icon: 'pin',
      kinds: ['dm'],
      visible: (target) => {

        const id = targetId(target.source)

        return !!id && pinned.includes(id)
      },
      action: (target) => {

        const id = targetId(target.source)

        if (id) setPinned(pinned.filter((p) => p !== id))
      },
    })

    // Another tab may pin something
    const onStorage = (event: StorageEvent) => {

      if (event.key !== STORAGE_KEY) return

      pinned = load()
      apply()
    }

    window.addEventListener('storage', onStorage)

    ctx.onDomChange(schedule)
    ctx.onStop(() => {

      cancelAnimationFrame(frame)
      window.removeEventListener('storage', onStorage)
      document.querySelectorAll(`[${ORDERED}]`).forEach(reset)
      document.querySelectorAll(`.${HEADER}`).forEach((el) => el.remove())
    })

    apply()
  },
})