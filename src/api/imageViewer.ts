import { h } from '../core/dom'
import { icon } from '../ui/icons'
import { toast } from './toast'

export const VIEWER_IMAGE = 'bf-viewer-image'
const MIN_SIDE = 384

export interface ImageViewerOptions {
  url: string
  title: string
}

/** Shows one picture full screen, with a link to the original. Esc, the X or a click outside closes it. Returns close. */
export function openImage({ url, title }: ImageViewerOptions): () => void {

  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url)

  const media = isVideo
    ? h('video', { class: VIEWER_IMAGE, src: url, autoplay: true, loop: true, muted: true, playsinline: true })
    : h('img', { class: VIEWER_IMAGE, src: url, alt: title, draggable: 'false' })

  const close = () => {

    root.remove()
    document.removeEventListener('keydown', onKey, true)

  }

  const onKey = (event: KeyboardEvent) => {

    if (event.key !== 'Escape') return

    // Only ours closes, not the profile behind it
    event.stopPropagation()
    event.preventDefault()
    close()
  }

  const copy = async () => {

    try {

      await navigator.clipboard.writeText(url)
      toast('Link copied', 'success')

    } catch {

      toast('Could not copy the link', 'error')

    }
  }

  // Blown up to MIN_SIDE once its size is known, never past the screen
  const fit = () => {

    const width = media instanceof HTMLImageElement ? media.naturalWidth : media.videoWidth
    const height = media instanceof HTMLImageElement ? media.naturalHeight : media.videoHeight

    if (!width || !height) return

    const scale = Math.max(1, MIN_SIDE / Math.min(width, height))

    media.style.width = `${Math.round(width * scale)}px`
    media.style.aspectRatio = `${width} / ${height}`
    root.classList.add('bf-viewer-ready')
  }

  media.addEventListener(isVideo ? 'loadedmetadata' : 'load', fit, { once: true })
  media.addEventListener('error', () => {

    root.classList.add('bf-viewer-ready')
    toast('That picture could not be loaded', 'error')

  }, { once: true })

  const root = h(
    'div',
    {
      class: 'bf-root bf-viewer',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': title,
      onClick: (event: MouseEvent) => event.target === root && close(),
    },
    h('button', { class: 'bf-icon-btn bf-viewer-close', 'aria-label': 'Close', onClick: close }, icon('close')),
    h('figure', { class: 'bf-viewer-figure' },
      media,
      h('figcaption', { class: 'bf-viewer-bar' },
        h('span', { class: 'bf-viewer-title' }, title),
        h('a', { class: 'bf-viewer-action', href: url, target: '_blank', rel: 'noopener noreferrer' }, icon('external', 16), 'Open original'),
        h('button', { class: 'bf-viewer-action', type: 'button', onClick: copy }, icon('copy', 16), 'Copy link'),
      ),
    ),
  )

  for (const type of ['pointerdown', 'mousedown', 'touchstart']) root.addEventListener(type, (event) => event.stopPropagation())

  document.addEventListener('keydown', onKey, true)
  document.body.append(root)

  if (media instanceof HTMLImageElement && media.complete) fit()

  return close
}