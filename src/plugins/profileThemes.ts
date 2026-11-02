import { onApiRequestBody } from '../api/network'
import { currentUserId } from '../api/profiles'
import { toast } from '../api/toast'
import { exportHook } from '../core/modules'
import { definePlugin } from '../core/plugins'

const media = exportHook<(user: any) => any>('resolveProfileClientMedia')

const TAG = 0xe0000
const RUN = /[\u{E0020}-\u{E007E}]+/gu
const COLORS = /\[#([0-9a-f]{1,6}),#([0-9a-f]{1,6})\]/i
const BANNER = /\{([^{}\s]+)\}/
const HEX = /^#?([0-9a-f]{6})$/i
const BIO_LIMIT = 190

const BANNER_HOSTS = ['cdn.fenrid.com', 'i.imgur.com', 'media.discordapp.net', 'cdn.discordapp.com']
const BANNER_DOMAINS = ['.tenor.com', '.giphy.com', '.klipy.com']

interface Theme {
  primary?: string
  secondary?: string
  banner?: string
}

const encode = (text: string) => String.fromCodePoint(...[...text].map((c) => TAG + c.charCodeAt(0)))
const decode = (run: string) => String.fromCharCode(...[...run].map((c) => c.codePointAt(0)! - TAG))

function bannerUrl(value: string): string | null {

  try {

    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)

    if (url.protocol !== 'https:' || url.username || url.password) return null

    const host = url.hostname.toLowerCase()

    return BANNER_HOSTS.includes(host) || BANNER_DOMAINS.some((d) => host.endsWith(d)) ? url.href : null

  } catch {

    return null

  }
}

function readTheme(bio: string): Theme | null {

  for (const [run] of bio.matchAll(RUN)) {

    const text = decode(run)
    const colors = text.match(COLORS)
    const banner = text.match(BANNER)?.[1]
    const theme: Theme = {}

    if (colors) {

      theme.primary = `#${colors[1].padStart(6, '0')}`.toUpperCase()
      theme.secondary = `#${colors[2].padStart(6, '0')}`.toUpperCase()

    }

    if (banner) theme.banner = bannerUrl(banner) ?? undefined

    if (theme.primary || theme.banner) return theme
  }

  return null
}

// Takes out our runs only, other invisible characters stay
function stripTheme(bio: string): string {

  return bio.replace(RUN, (run) => {

    const text = decode(run)

    return COLORS.test(text) || BANNER.test(text) ? '' : run
  })
}

export default definePlugin({
  id: 'profileThemes',
  name: 'Profile Themes',
  description: 'Two-color profile themes and animated banners without Flare. Your theme is hidden in your bio, so everyone with the plugin sees it (like Vencord\'s FakeProfileThemes).',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    primaryColor: {
      type: 'string',
      label: 'Primary color',
      description: 'Top of your profile, as #RRGGBB. Leave both colors empty for no theme.',
      default: '',
    },
    secondaryColor: {
      type: 'string',
      label: 'Secondary color',
      description: 'Bottom of your profile, as #RRGGBB.',
      default: '',
    },
    bannerUrl: {
      type: 'string',
      label: 'Animated banner',
      description: 'Link to a GIF on Imgur, Tenor, Giphy, Klipy, Discord or Fenrid\'s CDN.',
      default: '',
    },
    addToBio: {
      type: 'boolean',
      label: 'Add my theme to my bio',
      description: 'Done when you next save your profile. Turn off and save to remove it.',
      default: true,
    },
    showBanners: {
      type: 'boolean',
      label: 'Show other people\'s banners',
      description: 'Loads them from the image host, which can see your IP address, like any image in chat.',
      default: true,
    },
  },

  start(ctx) {

    const ownCode = (): string => {

      const primary = ctx.settings.primaryColor.trim().match(HEX)?.[1]
      const secondary = ctx.settings.secondaryColor.trim().match(HEX)?.[1]
      const banner = ctx.settings.bannerUrl.trim() ? bannerUrl(ctx.settings.bannerUrl.trim()) : null

      let text = ''

      if (primary && secondary) text += `[#${primary.toLowerCase()},#${secondary.toLowerCase()}]`
      if (banner) text += `{${banner.replace(/^https:\/\//, '')}}`

      return text ? encode(text) : ''
    }

    ctx.onStop(
      onApiRequestBody(({ url, method }, body) => {

        if (method !== 'PATCH' || url.pathname !== '/api/users/me' || typeof body?.bio !== 'string') return

        const clean = stripTheme(body.bio)
        const code = ctx.settings.addToBio ? ownCode() : ''

        if (code && clean.length + code.length > BIO_LIMIT) {

          toast(`Your bio is too long to fit your profile theme, shorten it by ${clean.length + code.length - BIO_LIMIT} characters`, 'error', 5000)
          return

        }

        const bio = clean.trimEnd() + code

        return bio === body.bio ? undefined : { ...body, bio }
      }),
    )

    ctx.onSettingsChange(() => {

      const banner = ctx.settings.bannerUrl.trim()

      if (banner && !bannerUrl(banner)) toast('That banner link is not from a supported image host', 'error', 4000)
    })

    // Fenrid draws themes and banners natively, it just only reads them for Flare and up
    ctx.onStop(
      media.patch((original, user) => {

        const result = original(user)
        const theme = typeof user?.bio === 'string' && user.blocked_by_target !== true ? readTheme(user.bio) : null

        if (!theme || !result) return result

        const next = { ...result }

        if (theme.primary && theme.secondary && !result.themeEnabled) {

          next.assets = { ...result.assets, accent: { ...result.assets?.accent, color: theme.primary, secondaryColor: theme.secondary } }
          next.secondaryColor = theme.secondary
          next.themeEnabled = true

        }

        if (theme.banner && !result.bannerAnimated && (ctx.settings.showBanners || String(user.id) === currentUserId())) {

          next.bannerUrl = theme.banner
          next.bannerAnimated = true

        }

        return next
      }),
    )

    const check = setTimeout(() => {

      if (!media.found) ctx.log.warn('Fenrid\'s profile code was not found, themes will not show')

    }, 15_000)

    ctx.onStop(() => clearTimeout(check))
  },
})