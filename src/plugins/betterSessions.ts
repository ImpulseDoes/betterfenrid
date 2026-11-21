import { toast } from '../api/toast'
import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'
import { icon, type IconName } from '../ui/icons'

const ROW = '[class*="min-h-[86px]"]'
const MARK = 'data-bf-session'
const HIDDEN = 'data-bf-session-hidden'
const KNOWN_KEY = 'BetterFenrid:knownDevices'
const NAMES_KEY = 'BetterFenrid:deviceNames'
const NOTIFIED_KEY = 'BetterFenrid:notifiedDevices'
const CHECK_MS = 10 * 60_000
const FIRST_CHECK_MS = 15_000

interface Device {
  id: string
  device_hint?: string | null
  last_seen_at?: string | null
  is_current?: boolean
  [key: string]: unknown
}

type Os = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'chromeos' | 'unknown'

const OS: Record<Os, { name: string; color: string; mobile: boolean }> = {
  windows: { name: 'Windows', color: '#4c9bf5', mobile: false },
  macos: { name: 'macOS', color: '#a1a5ab', mobile: false },
  linux: { name: 'Linux', color: '#cbc834', mobile: false },
  android: { name: 'Android', color: '#76c14f', mobile: true },
  ios: { name: 'iOS', color: '#e4e4e7', mobile: true },
  chromeos: { name: 'ChromeOS', color: '#f2b233', mobile: false },
  unknown: { name: 'Unknown', color: '#6b6f7a', mobile: false },
}

const BROWSERS = /chrome|chromium|firefox|safari|edge|opera|brave|vivaldi|browser|samsung/i

function osOf(text: string): Os {

  if (/android/i.test(text)) return 'android'
  if (/iphone|ipad|ios/i.test(text)) return 'ios'
  if (/windows/i.test(text)) return 'windows'
  if (/mac/i.test(text)) return 'macos'
  if (/cros|chromeos|chrome os/i.test(text)) return 'chromeos'
  if (/linux|ubuntu|fedora|debian|arch/i.test(text)) return 'linux'

  return 'unknown'
}

export function describe(hint: string | null | undefined) {

  const text = (hint ?? '').trim()
  const [client = '', system = ''] = text.split(/\s+on\s+|\s+-\s+/i)
  const os = osOf(system || text)
  const clientName = (system ? client : '').trim() || (os === 'unknown' ? text : '')
  const title = [OS[os].name !== 'Unknown' ? OS[os].name : '', clientName].filter(Boolean).join(' · ') || text || 'Unknown device'

  return { os, client: clientName, title, browser: BROWSERS.test(clientName) }
}

function locationOf(device: Device): string {

  const text = (key: string) => (typeof device[key] === 'string' ? (device[key] as string).trim() : '')
  const parts = [text('city'), text('region'), text('country')].filter(Boolean)

  return text('location') || parts.join(', ')
}

function setIcon(el: Element, name: IconName, size: number) {

  if (el.getAttribute('data-icon') === name) return

  el.setAttribute('data-icon', name)
  el.replaceChildren(icon(name, size))
}

// Writes only what differs: each write is another mutation for every observer on the page
function attr(el: Element, name: string, value: string) {

  if (el.getAttribute(name) !== value) el.setAttribute(name, value)
}

const readSet = (key: string) => {

  try {

    const value = JSON.parse(localStorage.getItem(key) ?? '[]')

    return new Set<string>(Array.isArray(value) ? value.map(String) : [])

  } catch {

    return new Set<string>()

  }
}

const writeSet = (key: string, set: Set<string>) => localStorage.setItem(key, JSON.stringify([...set]))

function readNames(): Record<string, string> {

  try {

    const value = JSON.parse(localStorage.getItem(NAMES_KEY) ?? '{}')

    return value && typeof value === 'object' ? value : {}

  } catch {

    return {}

  }
}

function setName(id: string, name: string) {

  const names = readNames()

  if (name.trim()) names[id] = name.trim().slice(0, 64)
  else delete names[id]

  localStorage.setItem(NAMES_KEY, JSON.stringify(names))
}

async function fetchDevices(): Promise<Device[] | null> {

  const response = await fetch('/api/devices', { credentials: 'include', cache: 'no-store' })

  if (!response.ok) return null

  const data = await response.json().catch(() => null)

  return Array.isArray(data?.devices) ? data.devices.filter((d: Device) => d && typeof d.id === 'string') : null
}

export default definePlugin({
  id: 'betterSessions',
  name: 'Better Sessions',
  description: 'Gives My Devices a clearer look: an icon for each system, "Windows · Chrome" names, a NEW tag for devices you haven\'t seen before, and names you pick. Can tell you when a new device signs in.',
  authors: ['ImpulseDoes'],
  settings: {
    notify: {
      type: 'boolean',
      label: 'Tell me when a new device signs in',
      description: 'Checks your devices every 10 minutes while Fenrid is open.',
      default: true,
    },
  },

  start(ctx) {

    let fresh: Set<string> | null = null

    const rows = () => [...document.querySelectorAll<HTMLElement>(ROW)]
      .map((row) => ({ row, device: findProps(row, (p) => p.device && typeof p.device === 'object' && 'device_hint' in p.device)?.device as Device | undefined }))
      .filter((r): r is { row: HTMLElement; device: Device } => !!r.device?.id)

    const hide = (el: Element | null | undefined) => el && attr(el, HIDDEN, '')

    const renameBox = (row: HTMLElement, device: Device, label: HTMLElement) => {

      const input = h('input', { class: 'bf-session-rename-input', value: readNames()[device.id] ?? '', placeholder: describe(device.device_hint).title, maxlength: '64', 'aria-label': 'Device name' }) as HTMLInputElement

      const done = (save: boolean) => {

        if (save) setName(device.id, input.value)

        input.remove()
        label.removeAttribute(HIDDEN)
        decorate(row, device)
      }

      input.addEventListener('keydown', (e) => {

        e.stopPropagation()

        if (e.key === 'Enter') done(true)
        if (e.key === 'Escape') done(false)

      })
      input.addEventListener('blur', () => input.isConnected && done(true))

      hide(label)
      label.after(input)
      input.focus()
      input.select()
    }

    const decorate = (row: HTMLElement, device: Device) => {

      const info = describe(device.device_hint)
      const os = OS[info.os]
      const custom = readNames()[device.id]

      attr(row, MARK, info.os)

      if (row.style.getPropertyValue('--bf-os-color') !== os.color) row.style.setProperty('--bf-os-color', os.color)

      const circle = row.querySelector<HTMLElement>('.rounded-full')

      if (circle && !circle.querySelector('.bf-session-glyph')) {

        attr(circle, 'data-bf-session-icon', '')
        circle.append(h('span', { class: 'bf-session-glyph' }), h('span', { class: 'bf-session-client' }))

      }

      if (circle) {

        const glyph: IconName = os.mobile ? 'phone' : 'desktop'
        const client: IconName = info.browser ? 'globe' : os.mobile ? 'phone' : 'desktop'

        setIcon(circle.querySelector('.bf-session-glyph')!, glyph, 22)
        setIcon(circle.querySelector('.bf-session-client')!, client, 12)
        attr(circle.querySelector('.bf-session-client')!, 'title', info.client || os.name)

      }

      const title = row.querySelector('p')
      const line = title?.parentElement

      if (!title || !line) return

      hide(title)
      hide([...line.children].find((el) => el.tagName === 'SPAN' && !el.className.startsWith('bf-session')))

      let name = line.querySelector<HTMLElement>('.bf-session-name')

      if (!name) {

        name = h('span', { class: 'bf-session-name' })
        line.prepend(name)

      }

      const label = custom || info.title

      if (name.textContent !== label) name.textContent = label
      attr(name, 'title', custom ? `${info.title} (${device.device_hint ?? 'unknown'})` : device.device_hint ?? '')

      const tag = line.querySelector('.bf-session-new')

      if (fresh?.has(device.id) && !tag) name.after(h('span', { class: 'bf-session-new' }, 'NEW'))
      else if (!fresh?.has(device.id)) tag?.remove()

      if (!line.querySelector('.bf-session-rename') && !line.querySelector('.bf-session-rename-input')) {

        line.append(h('button', { class: 'bf-session-rename', type: 'button', onClick: () => renameBox(row, device, name!) }, 'Rename'))

      }

      const meta = title.closest('.min-w-0')?.querySelector<HTMLElement>(':scope > div + div')
      const seen = meta?.querySelector(':scope > span:not(.bf-session-place)')

      if (seen && !seen.classList.contains('bf-session-seen')) seen.classList.add('bf-session-seen')

      const place = locationOf(device)
      let where = meta?.querySelector<HTMLElement>('.bf-session-place')

      if (place && meta && !where) {

        where = h('span', { class: 'bf-session-place' })
        meta.prepend(where)

      }

      if (where && where.textContent !== (place ? `${place} ·` : '')) where.textContent = place ? `${place} ·` : ''
    }

    const sync = () => {

      const found = rows()

      if (!found.length) {

        fresh = null
        return

      }

      if (!fresh) {

        const known = readSet(KNOWN_KEY)

        fresh = new Set(known.size ? found.map((r) => r.device.id).filter((id) => !known.has(id)) : [])
        found.forEach((r) => known.add(r.device.id))
        writeSet(KNOWN_KEY, known)

      }

      for (const { row, device } of found) decorate(row, device)
    }

    const check = async () => {

      if (!ctx.settings.notify) return

      const devices = await fetchDevices().catch(() => null)

      if (!devices) return

      const known = readSet(KNOWN_KEY)
      const notified = readSet(NOTIFIED_KEY)

      if (!known.size) {

        devices.forEach((d) => known.add(d.id))
        writeSet(KNOWN_KEY, known)
        return

      }

      for (const device of devices) {

        if (known.has(device.id) || notified.has(device.id) || device.is_current) continue

        notified.add(device.id)
        toast(`New device signed in: ${describe(device.device_hint).title}. Check Settings > My Devices if it wasn't you.`, 'info', 10_000)
        ctx.log.info('New device signed in', device.device_hint)

      }

      writeSet(NOTIFIED_KEY, notified)
    }

    ctx.onDomChange(sync)
    sync()

    const first = window.setTimeout(check, FIRST_CHECK_MS)
    const every = window.setInterval(check, CHECK_MS)

    ctx.onStop(() => {

      clearTimeout(first)
      clearInterval(every)

      document.querySelectorAll('.bf-session-name, .bf-session-new, .bf-session-rename, .bf-session-rename-input, .bf-session-place, .bf-session-glyph, .bf-session-client').forEach((el) => el.remove())
      document.querySelectorAll(`[${HIDDEN}]`).forEach((el) => el.removeAttribute(HIDDEN))
      document.querySelectorAll('.bf-session-seen').forEach((el) => el.classList.remove('bf-session-seen'))
      document.querySelectorAll('[data-bf-session-icon]').forEach((el) => el.removeAttribute('data-bf-session-icon'))
      document.querySelectorAll<HTMLElement>(`[${MARK}]`).forEach((el) => {

        el.removeAttribute(MARK)
        el.style.removeProperty('--bf-os-color')

      })
    })
  },
})