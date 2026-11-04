import { h } from '../core/dom'
import { definePlugin, getPluginSetting, setPluginSetting, type Plugin } from '../core/plugins'
import { settings } from '../core/settings'
import { THEMES } from '../core/theme'
import { Button, Row, Section, SettingControl } from '../ui/components'
import { icon } from '../ui/icons'

declare const __BF_WALLS__: { base: string; files: string[] }

interface Wall {
  url: string
  name: string
}

const WALLS: Wall[] = __BF_WALLS__.files.map((file) => ({
  url: `${__BF_WALLS__.base}${encodeURIComponent(file)}`,
  name: file.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}))

const thumbUrl = (url: string) => `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&h=250&fit=cover&output=webp&q=70`

const isImageUrl = (url: string) => /^https:\/\/\S+$/i.test(url.trim())

const cssUrl = (url: string) => `url(${JSON.stringify(url)})`

const currentTheme = () => THEMES.find((theme) => theme.id === settings.get().theme.preset)

function themeWallpaperVars(): string[] {

  return Object.keys(currentTheme()?.assets ?? {}).filter((name) => name.endsWith('-background'))
}

function wallpaperCss(url: string, dim: number): string {

  const image = cssUrl(url)
  const vars = themeWallpaperVars()

  if (vars.length) return `:root { ${vars.map((name) => `--${name}: ${image} !important;`).join(' ')} }`

  const base = currentTheme()?.preview?.bg ?? '#0e0f12'
  const shade = `color-mix(in srgb, var(--bf-wall-base) ${Math.min(95, Math.max(0, dim))}%, transparent)`

  return `
html:root {
  --bf-wall-base: ${base};
  background: linear-gradient(${shade}, ${shade}), ${image} center / cover no-repeat fixed #000 !important;
}

html:root > body {
  --background: transparent !important;
  --main-chat-area: transparent !important;
  --server-sidebar: color-mix(in srgb, var(--bf-wall-base) 35%, transparent) !important;
  --channel-sidebar: color-mix(in srgb, var(--bf-wall-base) 20%, transparent) !important;
  --member-list: color-mix(in srgb, var(--bf-wall-base) 20%, transparent) !important;
  --sidebar: color-mix(in srgb, var(--bf-wall-base) 20%, transparent) !important;
  background: transparent !important;
}

html:root > body .text-background,
html:root > body .text-main-chat-area {
  color: var(--bf-wall-base);
}

.bg-popups-and-modals,
.bg-popover,
[role="menu"] {
  backdrop-filter: blur(8px);
}
`
}

const PAGE_CSS = `
.bf-walls {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.bf-wall {
  position: relative;
  display: block;
  aspect-ratio: 16 / 10;
  padding: 0;
  overflow: hidden;
  border: 2px solid transparent;
  border-radius: 10px;
  background: var(--secondary-button, rgb(255 255 255 / 6%));
  color: var(--text-primary, #fff);
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.bf-wall:hover {
  transform: translateY(-2px);
}

.bf-wall[aria-pressed="true"] {
  border-color: var(--primary-action, #5865f2);
}

.bf-wall img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.bf-wall img.bf-wall-loaded {
  opacity: 1;
}

.bf-wall-broken img {
  visibility: hidden;
}

.bf-wall-none {
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #b5b5ba);
}

.bf-wall-name {
  position: absolute;
  inset: auto 0 0 0;
  padding: 18px 10px 6px;
  background: linear-gradient(transparent, rgb(0 0 0 / 70%));
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bf-wall-check {
  position: absolute;
  top: 6px;
  right: 6px;
  display: none;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary-action, #5865f2);
  color: #fff;
}

.bf-wall[aria-pressed="true"] .bf-wall-check {
  display: grid;
}

.bf-wall-custom {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.bf-wall-custom .bf-input {
  flex: 1;
}
`

const target = () => plugin as Plugin<any>

const selected = () => String(getPluginSetting(target(), 'wallpaper') ?? '')

const select = (url: string) => setPluginSetting(target(), 'wallpaper', url)

function WallpaperPage(): Node {

  const tiles: HTMLButtonElement[] = []

  const mark = () => {

    const url = selected()

    for (const tile of tiles) tile.setAttribute('aria-pressed', String(tile.dataset.url === url))

  }

  const tile = (url: string, content: Node[], label: string) => {

    const button = h('button', {
      class: 'bf-wall',
      type: 'button',
      title: label,
      'aria-label': label,
      onClick: () => {
        select(url)
        mark()
      },
    }, ...content, h('span', { class: 'bf-wall-check' }, icon('check', 14)))

    button.dataset.url = url
    tiles.push(button)

    return button
  }

  const grid = h(
    'div',
    { class: 'bf-walls' },
    tile('', [h('span', { class: 'bf-wall-none' }, 'Theme default')], 'Theme default'),
    ...WALLS.map((wall) => {

      const img = h('img', { src: thumbUrl(wall.url), alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })
      const button = tile(wall.url, [img, h('span', { class: 'bf-wall-name' }, wall.name)], wall.name)

      img.addEventListener('load', () => img.classList.add('bf-wall-loaded'))

      img.addEventListener('error', () => {

        if (img.src !== wall.url) img.src = wall.url
        else button.classList.add('bf-wall-broken')

      })

      return button
    }),
  )

  const custom = h('input', {
    class: 'bf-input',
    type: 'url',
    placeholder: 'https://example.com/wallpaper.jpg',
    value: WALLS.some((wall) => wall.url === selected()) ? '' : selected(),
  })

  const useCustom = () => {

    const url = custom.value.trim()

    if (!isImageUrl(url)) {

      custom.setCustomValidity('Paste an https:// link to an image')
      custom.reportValidity()
      return

    }

    custom.setCustomValidity('')
    select(url)
    mark()
  }

  custom.addEventListener('keydown', (e) => e.key === 'Enter' && useCustom())
  custom.addEventListener('input', () => custom.setCustomValidity(''))

  mark()

  const dim = target().settings.dim

  return h(
    'div',
    {},
    Section(
      'Wallpaper',
      'Puts a wallpaper behind Fenrid and keeps the colors of your theme.',
      grid,
      WALLS.length > 1
        ? Row('Surprise me', 'Picks a random wallpaper from the list.', Button('Random', () => {

          const others = WALLS.filter((wall) => wall.url !== selected())

          select(others[Math.floor(Math.random() * others.length)].url)
          mark()

        }, 'secondary'))
        : null,
    ),
    Section(
      'Your own',
      'Any https:// link to an image works.',
      h('div', { class: 'bf-wall-custom' }, custom, Button('Use', useCustom)),
    ),
    Section(
      'Look',
      null,
      SettingControl(dim, getPluginSetting(target(), 'dim'), (value) => setPluginSetting(target(), 'dim', value)),
    ),
  )
}

const plugin = definePlugin({
  id: 'wallpaperManager',
  name: 'Wallpaper Manager',
  description: 'Pick a wallpaper for Fenrid from the Better Fenrid collection or your own link. Your theme stays as it is.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    wallpaper: {
      type: 'string',
      label: 'Wallpaper',
      default: '',
    },
    dim: {
      type: 'number',
      label: 'Dim',
      description: 'How much of the theme\'s color covers the wallpaper, in percent. Themes that come with their own wallpaper keep their own dimming.',
      default: 70,
      min: 0,
      max: 95,
      step: 5,
    },
  },

  page: { id: 'wallpapers', label: 'Wallpapers', title: 'Wallpapers', icon: 'image', render: WallpaperPage },

  start(ctx) {

    ctx.addStyle(PAGE_CSS)

    const style = ctx.addStyle('')

    let current = ''

    const apply = () => {

      const url = ctx.settings.wallpaper
      const next = url && isImageUrl(url) ? wallpaperCss(url, Number(ctx.settings.dim) || 0) : ''

      if (next === current) return

      current = next
      style.set(next)
    }

    apply()

    ctx.onSettingsChange(apply)
  },
})

export default plugin