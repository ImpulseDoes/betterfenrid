import { h } from '../../core/dom'
import { settings } from '../../core/settings'
import { THEMES } from '../../core/theme'
import { Section, SettingControl, SwitchRow } from '../components'

const PLACEHOLDER = `/* Your CSS goes here. It applies live as you type. */

:root {
  --example-accent: #3f56f5;
}
`

export function ThemesPage(): Node {

  const theme = settings.get().theme

  let timer: ReturnType<typeof setTimeout> | undefined

  const save = () => {

    clearTimeout(timer)
    timer = setTimeout(() => settings.update((s) => { s.theme.css = editor.value }), 250)

  }

  const editor = h('textarea', {
    class: 'bf-input bf-code',
    spellcheck: 'false',
    placeholder: PLACEHOLDER,
    'aria-label': 'Custom CSS',
    value: theme.css,
    onInput: save,
    onKeydown: (e: KeyboardEvent) => {

      // Tab indents instead of moving focus
      if (e.key === 'Tab' && !e.shiftKey) {

        e.preventDefault()
        document.execCommand('insertText', false, '  ')

      }
    },
  })

  return h(
    'div',
    {},
    Section(
      'Theme',
      'Recolors all of Fenrid. Your custom CSS below is applied on top of it.',
      SettingControl(
        {
          type: 'select',
          label: 'Theme',
          default: 'onyx',
          options: THEMES.map((t) => ({ label: t.name, value: t.id })),
        },
        theme.preset,
        (v) => settings.update((s) => { s.theme.preset = String(v) }),
      ),
    ),
    Section(
      'Custom CSS',
      'Restyle Fenrid with your own CSS. Changes apply as you type.',
      SwitchRow(
        'Enable custom CSS',
        'Turn this off to quickly check how Fenrid looks without your changes.',
        theme.enabled,
        (v) => settings.update((s) => { s.theme.enabled = v }),
      ),
    ),
    Section(
      'Editor',
      'Tip: right-click anything and choose Inspect to see what to target. Fenrid\'s class names change between releases, so prefer selectors like [aria-label="..."] or [role="..."].',
      editor,
    ),
  )
}