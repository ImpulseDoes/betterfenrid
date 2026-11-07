import { openImage } from '../api/imageViewer'
import { avatarUrl, bannerUrl } from '../api/profiles'
import { toast } from '../api/toast'
import { getUser } from '../core/entities'
import { definePlugin } from '../core/plugins'

const SURFACE = '[data-animated-media-hover-root][role="dialog"], .fixed.z-\\[90\\], .fixed.z-\\[1000\\], .fenrid-safe-modal-frame, [role="dialog"]'
const PROFILE_MEDIA = /^https:\/\/cdn\.fenrid\.com\/profiles\/[^/]+\/(avatars|banners)\//
const VIEWABLE = 'data-bf-view-icon'

type Kind = 'avatar' | 'banner'

function mediaUrl(el: Element): string | null {

  if (el instanceof HTMLImageElement) return el.currentSrc || el.src || null
  if (el instanceof HTMLVideoElement) return el.currentSrc || el.src || el.querySelector('source')?.src || null

  const background = getComputedStyle(el).backgroundImage

  return background.match(/url\(["']?(.*?)["']?\)/)?.[1] ?? null
}

function original(url: string): string {

  if (!PROFILE_MEDIA.test(url)) return url

  const parsed = new URL(url)

  parsed.search = ''

  return parsed.href
}

/**
 * The avatar or banner at this point of a profile, if there is one. Looks through everything under the pointer,
 * because a status dot or a see-through button can sit on top of the picture
 */
function iconAt(x: number, y: number): { el: Element; url: string; kind: Kind } | null {

  for (const el of document.elementsFromPoint(x, y)) {

    if (el.closest('.bf-viewer')) return null

    const surface = el.closest(SURFACE)

    if (!surface) continue

    const url = mediaUrl(el)

    if (!url || url.startsWith('data:')) continue

    const kind = PROFILE_MEDIA.exec(url)?.[1]

    if (kind) return { el, url: original(url), kind: kind === 'avatars' ? 'avatar' : 'banner' }

    const box = el.getBoundingClientRect()
    const around = surface.getBoundingClientRect()
    const isProfile = !!surface.querySelector('img[src*="/avatars/"]')

    if (isProfile && box.top - around.top < 8 && box.width > around.width * 0.6 && box.height < around.height * 0.6) return { el, url, kind: 'banner' }
  }

  return null
}

function nameOf(user: Record<string, any> | null): string | null {

  return user?.display_name || user?.displayName || user?.username || null
}

// Whatever Fenrid sends for a user, the profile with the pictures in it
function profileOf(raw: unknown): Record<string, any> | null {

  if (!raw || typeof raw !== 'object') return null

  const user = raw as Record<string, any>

  if (user.assets || user.avatarUrl || user.bannerUrl) return user

  for (const key of ['profile', 'profiles', 'user']) {

    if (user[key] && typeof user[key] === 'object' && (user[key].assets || user[key].avatarUrl)) return { id: user.id, ...user[key] }
  }

  return user
}

async function loadProfile(id: string): Promise<Record<string, any> | null> {

  try {

    const response = await fetch(`/api/users/${encodeURIComponent(id)}`, { credentials: 'include', headers: { Accept: 'application/json' } })

    if (response.ok) return profileOf(await response.json())

  } catch { }

  return profileOf(getUser(id))
}

export default definePlugin({
  id: 'viewIcons',
  name: 'View Icons',
  description: 'Click an avatar or banner on a profile to see it full size, like Vencord\'s ViewIcons. Also adds "View Avatar" and "View Banner" to the user menu.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    ctx.addStyle(`[${VIEWABLE}] { cursor: zoom-in !important; }`)

    let marked: Element | null = null

    const mark = (el: Element | null) => {

      if (marked === el) return

      marked?.removeAttribute(VIEWABLE)
      el?.setAttribute(VIEWABLE, '')
      marked = el
    }

    const onMove = (event: PointerEvent) => {

      const target = event.target as Element | null

      mark(target?.closest?.(SURFACE) ? (iconAt(event.clientX, event.clientY) ? target : null) : null)
    }

    const onClick = (event: MouseEvent) => {

      if (event.button !== 0 || !(event.target as Element | null)?.closest?.(SURFACE)) return

      const icon = iconAt(event.clientX, event.clientY)

      if (!icon) return

      // Before React sees it, so the avatar doesn't open the full profile as well
      event.preventDefault()
      event.stopImmediatePropagation()

      // The name on the profile, when it's short enough to be one
      const name = icon.el.closest(SURFACE)?.querySelector('[data-profile-preview-trigger], h1, h2')?.textContent?.trim()
      const owner = name && name.length <= 40 ? name : null

      openImage({ url: icon.url, title: owner ? `${owner}'s ${icon.kind}` : icon.kind === 'avatar' ? 'Avatar' : 'Banner' })
    }

    window.addEventListener('pointerover', onMove, true)
    window.addEventListener('click', onClick, true)

    ctx.onStop(() => {

      window.removeEventListener('pointerover', onMove, true)
      window.removeEventListener('click', onClick, true)
      mark(null)
    })

    const view = (kind: Kind) => async (target: { id: string | null }) => {

      if (!target.id) return toast('Could not read the user ID', 'error')

      const profile = await loadProfile(target.id)
      const url = profile && (kind === 'avatar' ? avatarUrl(profile) : bannerUrl(profile))

      if (!url) return toast(kind === 'avatar' ? 'This user has no avatar' : 'This user has no banner', 'info')

      const name = nameOf(profile)

      openImage({ url: original(url), title: name ? `${name}'s ${kind}` : kind === 'avatar' ? 'Avatar' : 'Banner' })
    }

    ctx.addContextMenuItem({ id: 'viewAvatar', label: 'View Avatar', icon: 'image', kinds: ['user'], action: view('avatar') })
    ctx.addContextMenuItem({ id: 'viewBanner', label: 'View Banner', icon: 'image', kinds: ['user'], action: view('banner') })
  },
})