import { h } from '../../core/dom'
import { THEMES } from '../../core/theme'
import { NAME, REPO_URL } from '../../meta'
import { Button, Row, Section } from '../components'

const open = (url: string) => () => window.open(url, '_blank', 'noopener')

const Link = (label: string, url: string) => Button(label, open(url), 'secondary')

export function CreditsPage(): Node {

  const themes = THEMES.filter((theme) => theme.author && theme.author !== 'Fenrid' && theme.author !== 'Better Fenrid')

  return h(
    'div',
    {},
    Section(
      NAME,
      'The people behind the mod.',
      Row('!̸I̸m̸p̸u̸l̸s̸e̸', 'Creator and Main Developer.', Link('GitHub', 'https://github.com/ImpulseDoes')),
      Row('Contributors', 'Everyone who sent code, ideas or bug reports. Thank you!', Link('View on GitHub', `${REPO_URL}/graphs/contributors`)),
    ),
    Section(
      'Inspired by',
      'Many plugins follow ideas from these client mods for Discord.',
      Row('Vencord', 'Fake Surge, Profile Themes, Pin DMs, Deleted Messages, Edit History and more are modeled on its plugins.', Link('Website', 'https://vencord.dev')),
      Row('BetterDiscord', 'Themes and the idea of a mod with plugins and themes you turn on in settings.', Link('Website', 'https://betterdiscord.app')),
    ),
    Section(
      'Open source code',
      null,
      Row('oneko.js', 'The cat in the Oneko plugin, by adryd. MIT license.', Link('GitHub', 'https://github.com/adryd325/oneko.js')),
    ),
    themes.length
      ? Section('Themes', 'The built-in themes are ported from, or based on, the work of:', ...themes.map((theme) => Row(theme.name, `by ${theme.author}`)))
      : null,
  )
}