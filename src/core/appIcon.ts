import { settings } from './settings'
import { createStyle } from './styles'

const SIZE = 256
const HOME_BUTTON = 'html [href="/channels/me"].h-12'

export async function makeAppIcon(file: Blob): Promise<string> {

  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')

  canvas.width = canvas.height = SIZE

  const ctx = canvas.getContext('2d')

  if (!ctx) throw new Error('Canvas is unavailable')

  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close()

  return canvas.toDataURL('image/png')
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {

  const img = new Image()

  img.onload = () => resolve(img)
  img.onerror = reject
  img.src = src
})

// Fenrid draws its ping count on the favicon, so do the same on ours
async function faviconWithCount(icon: string, count: number): Promise<string> {

  if (!count) return icon

  const img = await loadImage(icon)
  const canvas = document.createElement('canvas')

  canvas.width = canvas.height = 64

  const ctx = canvas.getContext('2d')

  if (!ctx) return icon

  ctx.drawImage(img, 0, 0, 64, 64)

  const text = count > 99 ? '99+' : String(count)
  const width = Math.max(30, text.length * 14 + 12)

  ctx.fillStyle = '#f23f42'
  ctx.beginPath()
  ctx.roundRect(64 - width, 30, width, 34, 17)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = '800 24px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 64 - width / 2, 48)

  return canvas.toDataURL('image/png')
}

const titleCount = () => Number(/^\((\d+)\)/.exec(document.title)?.[1] ?? 0)

export function startAppIcon() {

  const style = createStyle()
  const originals = new Map<HTMLLinkElement, string>()

  // null until the first apply, so the desktop app always hears the current icon once
  let icon: string | null = null
  let favicon = ''
  let count = -1
  let painting = 0

  const links = () => [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')]

  const paintFavicon = async () => {

    const run = ++painting

    count = titleCount()

    const current = icon ?? ''
    const next = await faviconWithCount(current, count).catch(() => current)

    if (run !== painting || !icon) return

    favicon = next

    for (const link of links()) {

      if (link.href === favicon) continue

      originals.set(link, link.href)
      link.href = favicon
    }
  }

  const restoreFavicon = () => {

    painting++

    for (const [link, href] of originals) if (link.isConnected) link.href = href

    originals.clear()
    favicon = ''
  }

  const apply = () => {

    const next = settings.get().core.appIcon

    if (next === icon) return

    icon = next

    style.set(icon ? `
${HOME_BUTTON} {
  background: url("${icon}") center / cover no-repeat !important;
}

${HOME_BUTTON} svg {
  opacity: 0;
}
` : '')

    window.BetterFenridNative?.setAppIcon?.(icon || null)

    if (icon) void paintFavicon()
    else restoreFavicon()
  }

  apply()
  settings.subscribe(apply)

  // Fenrid rewrites the favicon to draw its badge, and the title carries the ping count
  const watch = () => new MutationObserver(() => {

    if (icon && (titleCount() !== count || links().some((link) => link.href !== favicon))) void paintFavicon()

  }).observe(document.head, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'], characterData: true })

  if (document.head) watch()
  else document.addEventListener('DOMContentLoaded', watch, { once: true })
}