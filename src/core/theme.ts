import impulseBackground from '../themes/assets/impulse-background.jpg'
import impulseHome from '../themes/assets/impulse-home.jpg'
import translucenceBackground from '../themes/assets/translucence-background.jpg'
import catppuccinMocha from '../themes/catppuccin-mocha.css'
import darkMatter from '../themes/dark-matter.css'
import dracula from '../themes/dracula.css'
import frostedGlass from '../themes/frosted-glass.css'
import impulse from '../themes/impulse.css'
import nord from '../themes/nord.css'
import onyx from '../themes/onyx.css'
import hardcodedColors from '../themes/onyx.generated.css'
import rosePine from '../themes/rose-pine.css'
import synthwave84 from '../themes/synthwave-84.css'
import tokyoNight from '../themes/tokyo-night.css'
import translucence from '../themes/translucence.css'
import { settings } from './settings'
import { createStyle } from './styles'

const impulseImages = `:root { --impulse-background: url("${impulseBackground}"); --impulse-home-icon: url("${impulseHome}"); }`
const translucenceImages = `:root { --translucence-background: url("${translucenceBackground}"); }`

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
  css: string
}

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
    css: `${translucenceImages}\n${translucence}\n${hardcodedColors}`,
  },
  {
    id: 'impulse',
    name: "Impulse's Default",
    author: 'Impulse',
    description: 'Anime background behind frosted glass panels with emerald green accents.',
    preview: { bg: '#08080a', surface: '#0f0f11', accent: '#43b581', text: '#ffffff' },
    css: `${impulseImages}\n${impulse}\n${hardcodedColors}`,
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

export function startThemes() {

  const style = createStyle()

  let current = ''

  const apply = () => {

    const { theme: { preset, enabled, css }, core: { font } } = settings.get()
    const theme = THEMES.find((t) => t.id === preset)

    const next = `${theme?.css ?? ''}\n${enabled ? css : ''}\n${fontCss(font)}`

    if (next === current) return

    current = next
    style.set(next)
  }

  apply()

  settings.subscribe(apply)
}