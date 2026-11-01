import { settings } from './settings'
import { createStyle } from './styles'

export function startThemes() {

  const style = createStyle()
  const apply = () => {

    const { enabled, css } = settings.get().theme

    style.set(enabled ? css : '')
  }

  apply()

  settings.subscribe(apply)
}