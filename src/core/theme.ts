import amethyst from '../themes/amethyst.css'
import animeGlass from '../themes/anime-glass.css'
import catppuccinMocha from '../themes/catppuccin-mocha.css'
import darkMatter from '../themes/dark-matter.css'
import dracula from '../themes/dracula.css'
import frostedGlass from '../themes/frosted-glass.css'
import impulse from '../themes/impulse.css'
import lilyPichu from '../themes/lily-pichu.css'
import naat from '../themes/naat.css'
import nord from '../themes/nord.css'
import onyx from '../themes/onyx.css'
import hardcodedColors from '../themes/onyx.generated.css'
import rosePine from '../themes/rose-pine.css'
import sakura from '../themes/sakura.css'
import softX from '../themes/soft-x.css'
import synthwave84 from '../themes/synthwave-84.css'
import tokyoNight from '../themes/tokyo-night.css'
import translucence from '../themes/translucence.css'
import { ASSET_GITHUB, assetVars, startAssetBase } from './assets'
import { settings } from './settings'
import { createStyle } from './styles'

export interface ThemeDef {
  id: string
  name: string
  author?: string
  description?: string
  preview?: {
    bg: string
    surface: string
    accent: string
    text: string
  }
  assets?: Record<string, string>
  css: string
}

const IMPULSE_BG = { 'anime-background': 'impulse-background.jpg' }
const IMPULSE_ASSETS = { ...IMPULSE_BG, 'impulse-home-icon': 'impulse-home.jpg' }

export const THEMES: ThemeDef[] = [
  {
    id: 'onyx',
    name: 'Onyx',
    author: 'Better Fenrid',
    description: "A near-black theme modeled after Discord's dark mode.",
    preview: { bg: '#09090b', surface: '#121214', accent: '#5865f2', text: '#f2f3f5' },
    css: `${onyx}\n${hardcodedColors}`,
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    author: 'Catppuccin Community',
    description: 'Soothing pastel theme with velvety dark tones and lavender/mauve accents.',
    preview: { bg: '#1e1e2e', surface: '#313244', accent: '#cba6f7', text: '#cdd6f4' },
    css: `${catppuccinMocha}\n${hardcodedColors}`,
  },
  {
    id: 'dracula',
    name: 'Dracula',
    author: 'Dracula Theme',
    description: 'The iconic gothic vampire theme with rich purple, pink and cyan highlights.',
    preview: { bg: '#282a36', surface: '#44475a', accent: '#bd93f9', text: '#f8f8f2' },
    css: `${dracula}\n${hardcodedColors}`,
  },
  {
    id: 'nord',
    name: 'Nord',
    author: 'Arctic Ice Studio',
    description: 'An arctic, north-bluish clean palette creating a calm, focused atmosphere.',
    preview: { bg: '#2e3440', surface: '#3b4252', accent: '#88c0d0', text: '#eceff4' },
    css: `${nord}\n${hardcodedColors}`,
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    author: 'Folke',
    description: 'Cyberpunk-inspired theme celebrating the vibrant neon lights of downtown Tokyo.',
    preview: { bg: '#1a1b26', surface: '#24283b', accent: '#7aa2f7', text: '#c0caf5' },
    css: `${tokyoNight}\n${hardcodedColors}`,
  },
  {
    id: 'dark-matter',
    name: 'Dark Matter',
    author: 'DiscordStyles',
    description: 'Pitch-black AMOLED theme with Discord Blurple accents and ultra-clean lines.',
    preview: { bg: '#000000', surface: '#0d0d11', accent: '#5865f2', text: '#ffffff' },
    css: `${darkMatter}\n${hardcodedColors}`,
  },
  {
    id: 'frosted-glass',
    name: 'Frosted Glass',
    author: 'DiscordStyles',
    description: 'Translucent frosted glass panels with ambient glow and backdrop blur.',
    preview: { bg: '#0b0f17', surface: '#162032', accent: '#00b0f4', text: '#f0f6fc' },
    css: `${frostedGlass}\n${hardcodedColors}`,
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    author: 'Rosé Pine',
    description: 'Natural pine, faux fur and soho vibes with dusty rose, gold and foam accents.',
    preview: { bg: '#191724', surface: '#1f1d2e', accent: '#c4a7e7', text: '#e0def4' },
    css: `${rosePine}\n${hardcodedColors}`,
  },
  {
    id: 'synthwave-84',
    name: "Synthwave '84",
    author: 'Robb Owen',
    description: 'Retro 80s neon synthwave with hot magenta, electric cyan and deep twilight purple.',
    preview: { bg: '#1a162b', surface: '#26213f', accent: '#ff7edb', text: '#fdfdfd' },
    css: `${synthwave84}\n${hardcodedColors}`,
  },
  {
    id: 'translucence',
    name: 'Translucence',
    author: 'CapnKitten',
    description: 'Frosted glass with the Alpine Amnesia background and lavender accents.',
    preview: { bg: '#101018', surface: '#1b1b28', accent: '#b89eff', text: '#ffffff' },
    assets: { 'translucence-background': 'translucence-background.jpg' },
    css: `${translucence}\n${hardcodedColors}`,
  },
  {
    id: 'impulse',
    name: "Impulse's Default",
    author: 'Impulse',
    description: 'Anime background behind frosted glass panels with emerald green accents.',
    preview: { bg: '#08080a', surface: '#0f0f11', accent: '#43b581', text: '#ffffff' },
    assets: IMPULSE_ASSETS,
    css: `${animeGlass}\n${impulse}\n${hardcodedColors}`,
  },
  {
    id: 'naat',
    name: 'Not Another Anime',
    author: 'puckzxz',
    description: 'Classic BetterDiscord anime theme look: wallpaper, glass panels and teal accents.',
    preview: { bg: '#0a1014', surface: '#12181e', accent: '#1edcbb', text: '#ffffff' },
    assets: IMPULSE_BG,
    css: `${animeGlass}\n${naat}\n${hardcodedColors}`,
  },
  {
    id: 'sakura',
    name: 'Sakura',
    author: 'Better Fenrid',
    description: 'Cherry-blossom pink glass over an anime wallpaper.',
    preview: { bg: '#2a1018', surface: '#3c1828', accent: '#f4a0c0', text: '#ffe4ef' },
    assets: IMPULSE_BG,
    css: `${animeGlass}\n${sakura}\n${hardcodedColors}`,
  },
  {
    id: 'lily-pichu',
    name: 'LilyPichu',
    author: 'Nyria',
    description: 'Warm rose and cream, based on LilyPichu / Melonturtle stream design.',
    preview: { bg: '#220f14', surface: '#5e3640', accent: '#c5536c', text: '#f8e1e5' },
    css: `${lilyPichu}\n${hardcodedColors}`,
  },
  {
    id: 'soft-x',
    name: 'SoftX',
    author: 'Gibbu',
    description: 'A soft, comfy lavender glass look with heavy blur.',
    preview: { bg: '#120e1c', surface: '#201830', accent: '#c4b5fd', text: '#f5f3ff' },
    assets: { 'anime-background': 'translucence-background.jpg' },
    css: `${animeGlass}\n${softX}\n${hardcodedColors}`,
  },
  {
    id: 'amethyst',
    name: 'Amethyst',
    author: 'ClearVision',
    description: 'Magenta glass over a wallpaper, after ClearVision’s Amethyst preset.',
    preview: { bg: '#160824', surface: '#241038', accent: '#c084fc', text: '#f3e8ff' },
    assets: IMPULSE_BG,
    css: `${animeGlass}\n${amethyst}\n${hardcodedColors}`,
  },
  {
    id: 'fenrid',
    name: 'Fenrid default',
    author: 'Fenrid',
    description: "Fenrid's original unmodified appearance.",
    preview: { bg: '#0e0f12', surface: '#16181d', accent: '#3b50cc', text: '#f2f3f5' },
    css: '',
  },
]

const FONT_VARIABLES = ['--font-manrope-loaded', '--font-fira-sans-loaded', '--font-clash-grotesk', '--font-sans']

function fontCss(font: string): string {

  const name = font.replace(/["'\\]/g, '').replace(/\s+/g, ' ').trim()

  if (!name) return ''

  // On body because Fenrid sets the first two on a class there, !important beats that class wherever it loads
  return `body { ${FONT_VARIABLES.map((variable) => `${variable}: "${name}", sans-serif !important;`).join(' ')} }`
}

function themeCss(theme: ThemeDef | undefined, assetBase: string): string {

  if (!theme) return ''

  const images = theme.assets ? assetVars(theme.assets, assetBase) : ''

  return `${images}\n${theme.css}`
}

export function startThemes() {

  const style = createStyle()

  let current = ''
  let assetBase = ASSET_GITHUB

  const apply = () => {

    const { theme: { preset, enabled, css }, core: { font } } = settings.get()
    const theme = THEMES.find((t) => t.id === preset)

    const next = `${themeCss(theme, assetBase)}\n${enabled ? css : ''}\n${fontCss(font)}`

    if (next === current) return

    current = next
    style.set(next)
  }

  assetBase = startAssetBase((base) => {
    assetBase = base
    current = ''
    apply()
  })

  apply()

  settings.subscribe(apply)
}