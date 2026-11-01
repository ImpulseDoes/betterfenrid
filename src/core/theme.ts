import impulseBackground from '../themes/assets/impulse-background.jpg'
import impulseHome from '../themes/assets/impulse-home.jpg'
import impulse from '../themes/impulse.css'
import onyx from '../themes/onyx.css'
import hardcodedColors from '../themes/onyx.generated.css'
import { settings } from './settings'
import { createStyle } from './styles'

const impulseImages = `:root { --impulse-background: url("${impulseBackground}"); --impulse-home-icon: url("${impulseHome}"); }`

export const THEMES = [
  { id: 'onyx', name: 'Onyx', css: `${onyx}\n${hardcodedColors}` },
  { id: 'impulse', name: 'Impulse\'s Default', css: `${impulseImages}\n${impulse}\n${hardcodedColors}` },
  { id: 'fenrid', name: 'Fenrid default', css: '' },
]

export function startThemes() {

  const style = createStyle()

  let current = ''

  const apply = () => {

    const { preset, enabled, css } = settings.get().theme
    const theme = THEMES.find((t) => t.id === preset)

    const next = `${theme?.css ?? ''}\n${enabled ? css : ''}`

    if (next === current) return

    current = next
    style.set(next)
  }

  apply()

  settings.subscribe(apply)
}