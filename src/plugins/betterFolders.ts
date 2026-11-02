import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'

const SERVERS = 'data-bf-folder-servers'
const OPEN_RAIL = 'data-bf-folder-rail'
const ICON = 'data-bf-folder-icon'
const HIDDEN_PICKER = 'data-bf-hidden-picker'
const SWATCHES = 'bf-folder-colors'
const COLORS = [
  { name: 'Blue', value: '#3F56F5' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Red', value: '#E5484D' },
  { name: 'Yellow', value: '#F5A524' },
  { name: 'Green', value: '#23A55A' },
]
const COLUMN_PX = 72
const GAP_PX = 8
const MOBILE = '(max-width: 1023px)'
const SERVER_PATH = /^\/channels\/(\d+|me)/

interface Folder {
  id: string
  serverIds: string[]
  color: string | null
  open: boolean
  toggle: HTMLButtonElement
  // Fenrid's own list of the folder's servers, there only while it's open
  servers: HTMLElement | null
}

function findFolders(rail: Element): Folder[] {

  const folders: Folder[] = []

  for (const toggle of rail.querySelectorAll<HTMLButtonElement>(Selectors.folderToggle)) {

    const folder = findProps(toggle, (p) => Array.isArray(p.folder?.serverIds))?.folder

    if (!folder) continue

    const open = toggle.getAttribute('aria-expanded') === 'true'

    folders.push({
      id: folder.id,
      serverIds: folder.serverIds,
      color: folder.color ?? null,
      open,
      toggle,
      servers: open ? (toggle.parentElement?.nextElementSibling as HTMLElement | null) : null,
    })
  }

  return folders
}

// The element that decides how wide the rail is: Fenrid wraps it in a fixed width column
function findColumn(rail: HTMLElement): HTMLElement {

  const { width } = rail.getBoundingClientRect()

  let column = rail

  while (column.parentElement && column.parentElement.getBoundingClientRect().width === width) column = column.parentElement

  return column
}

// Fenrid's picker opens outside the dialog, so using it counts as clicking away and closes the
// dialog. These live inside it and set the same value Save reads
function addColorChoice() {

  const section = document.querySelector(Selectors.folderNameInput)?.parentElement?.nextElementSibling

  if (!section || section.querySelector(`.${SWATCHES}`)) return

  const picker = section.lastElementChild
  const props = picker && findProps(picker, (p) => typeof p.onChange === 'function' && 'defaultValue' in p)

  // Not what we expected: Fenrid's own control is better than one that can't save
  if (!picker || !props) return

  const swatches = COLORS.map(({ name, value }) => {

    const swatch = h('button', {
      class: 'bf-folder-color',
      type: 'button',
      role: 'radio',
      title: name,
      'aria-label': name,
      'aria-checked': String(value.toLowerCase() === String(props.value).toLowerCase()),
      style: `background-color: ${value}`,
    })

    swatch.addEventListener('click', () => {

      props.onChange(value)
      swatches.forEach((other) => other.setAttribute('aria-checked', String(other === swatch)))

    })

    return swatch
  })

  picker.setAttribute(HIDDEN_PICKER, '')
  section.append(h('div', { class: SWATCHES, role: 'radiogroup', 'aria-label': 'Folder color' }, ...swatches))
}

function removeColorChoice() {

  document.querySelectorAll(`.${SWATCHES}`).forEach((el) => el.remove())
  document.querySelectorAll(`[${HIDDEN_PICKER}]`).forEach((el) => el.removeAttribute(HIDDEN_PICKER))
}

const currentServer = () => location.pathname.match(SERVER_PATH)?.[1] ?? null

export default definePlugin({
  id: 'betterFolders',
  name: 'Better Folders',
  description: 'Shows the servers of open folders in their own sidebar next to the server list.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,
  settings: {
    sidebar: {
      type: 'boolean',
      label: 'Show folders in a sidebar',
      description: 'Turn this off to keep open folders in the server list and only use the options below.',
      default: true,
    },
    folderIcon: {
      type: 'boolean',
      label: 'Show a folder icon on closed folders',
      description: 'Turn this off to see small server icons instead, like Fenrid does.',
      default: true,
    },
    sidebarAnim: {
      type: 'boolean',
      label: 'Animate the sidebar',
      default: true,
    },
    closeAllFolders: {
      type: 'boolean',
      label: 'Close all folders when selecting a server not in a folder',
      default: false,
    },
    closeAllHomeButton: {
      type: 'boolean',
      label: 'Close all folders when opening Direct Messages',
      default: false,
    },
    closeOthers: {
      type: 'boolean',
      label: 'Close other folders when opening a folder',
      default: false,
    },
    closeServerFolder: {
      type: 'boolean',
      label: 'Close a folder when selecting a server in it',
      default: false,
    },
    forceOpen: {
      type: 'boolean',
      label: 'Open a folder when switching to a server in it',
      default: false,
    },
  },

  start(ctx) {

    const mobile = window.matchMedia(MOBILE)

    let column: HTMLElement | null = null
    let railEl: HTMLElement | null = null
    let closedWidth = 0
    let columnStyle: string | null = null
    let lastServer = currentServer()
    let lastOpen: Set<string> | null = null

    const reset = () => {

      document.querySelectorAll<HTMLElement>(`[${SERVERS}]`).forEach((el) => {

        el.removeAttribute(SERVERS)
        el.style.removeProperty('top')
        el.style.removeProperty('--bf-folder-tint')

      })

      if (railEl) {

        railEl.removeAttribute(OPEN_RAIL)
        railEl.style.removeProperty('padding-right')

      }

      if (column) {

        if (columnStyle === null) column.removeAttribute('style')
        else column.setAttribute('style', columnStyle)

      }

      column = null
      railEl = null
    }

    const layout = (rail: HTMLElement, open: Folder[]) => {

      if (!ctx.settings.sidebar || mobile.matches || !open.length) return reset()

      // Measured once, before widening it: mid animation it would read any width in between
      if (railEl !== rail) {

        reset()

        column = findColumn(rail)
        columnStyle = column.getAttribute('style')
        closedWidth = rail.getBoundingClientRect().width
        railEl = rail

      }

      const width = `${closedWidth + COLUMN_PX}px`

      column!.style.setProperty('transition', ctx.settings.sidebarAnim ? 'width 150ms ease, min-width 150ms ease, flex-basis 150ms ease' : 'none')
      column!.style.setProperty('width', width, 'important')
      column!.style.setProperty('min-width', width, 'important')
      column!.style.setProperty('flex-basis', width, 'important')
      rail.style.setProperty('padding-right', `${COLUMN_PX}px`)
      rail.setAttribute(OPEN_RAIL, '')

      const railTop = rail.getBoundingClientRect().top - rail.scrollTop

      let top = parseFloat(getComputedStyle(rail).paddingTop)

      for (const folder of open) {

        const { servers } = folder

        if (!servers) continue

        const parent = servers.offsetParent ?? rail

        servers.setAttribute(SERVERS, '')
        // Relative to the folder, which Fenrid positions, so it has to be converted from the rail's top
        servers.style.top = `${top - (parent.getBoundingClientRect().top - railTop)}px`

        if (folder.color) servers.style.setProperty('--bf-folder-tint', folder.color)
        else servers.style.removeProperty('--bf-folder-tint')

        top += servers.offsetHeight + GAP_PX
      }
    }

    const clearIcons = () => document.querySelectorAll<HTMLElement>(`[${ICON}]`).forEach((el) => {

      el.removeAttribute(ICON)
      el.style.removeProperty('--bf-folder-color')

    })

    // Drawn by CSS, so Fenrid's own icons stay where React expects them
    const markIcons = (folders: Folder[]) => {

      if (!ctx.settings.folderIcon) return clearIcons()

      for (const { toggle, color } of folders) {

        toggle.setAttribute(ICON, '')

        if (color) toggle.style.setProperty('--bf-folder-color', color)
        else toggle.style.removeProperty('--bf-folder-color')

      }
    }

    // Switching servers and opening folders are the two things Vencord's options react to
    const applyRules = (folders: Folder[]): boolean => {

      const close = new Set<Folder>()
      const expand = new Set<Folder>()
      const open = folders.filter((folder) => folder.open)

      const server = currentServer()

      if (server !== lastServer) {

        lastServer = server

        if (server === 'me') {

          if (ctx.settings.closeAllHomeButton) open.forEach((folder) => close.add(folder))

        } else if (server) {

          const parent = folders.find((folder) => folder.serverIds.includes(server))

          if (parent?.open && ctx.settings.closeServerFolder) close.add(parent)
          else if (parent && !parent.open && ctx.settings.forceOpen) expand.add(parent)
          else if (!parent && ctx.settings.closeAllFolders) open.forEach((folder) => close.add(folder))

        }
      }

      if (ctx.settings.closeOthers && lastOpen) {

        const opened = open.filter((folder) => !lastOpen!.has(folder.id)).at(-1) ?? [...expand].at(-1)

        if (opened) open.forEach((folder) => folder !== opened && close.add(folder))

      }

      lastOpen = new Set(folders.filter((folder) => (folder.open || expand.has(folder)) && !close.has(folder)).map((folder) => folder.id))

      close.forEach((folder) => folder.toggle.click())
      expand.forEach((folder) => folder.toggle.click())

      return close.size + expand.size > 0
    }

    const sync = () => {

      const rail = document.querySelector<HTMLElement>(Selectors.serverRail)

      if (!rail) return reset()

      const folders = findFolders(rail)

      markIcons(folders)

      // React may not have redrawn yet, and the change it makes brings us back here
      if (applyRules(folders)) return

      layout(rail, folders.filter((folder) => folder.open))
    }

    ctx.onDomChange(sync)
    ctx.onDomChange(addColorChoice)
    ctx.onSettingsChange(sync)

    mobile.addEventListener('change', sync)
    ctx.onStop(() => mobile.removeEventListener('change', sync))

    ctx.onStop(reset)
    ctx.onStop(clearIcons)
    ctx.onStop(removeColorChoice)

    sync()
    addColorChoice()
  },
})