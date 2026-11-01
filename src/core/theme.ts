import onyx from '../themes/onyx.css'
import { settings } from './settings'
import { createStyle } from './styles'

export const THEMES = [
  { id: 'onyx', name: 'Onyx', css: onyx },
  { id: 'fenrid', name: 'Fenrid default', css: '' },
]

export function startThemes() {

  const style = createStyle()
  const apply = () => {

    const { preset, enabled, css } = settings.get().theme
    const theme = THEMES.find((t) => t.id === preset)

    style.set(`${theme?.css ?? ''}\n${enabled ? css : ''}`)
  }

  apply()

  settings.subscribe(apply)
}