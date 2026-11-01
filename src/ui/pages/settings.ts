import { openModal } from '../../api/modal'
import { toast } from '../../api/toast'
import { h } from '../../core/dom'
import { syncPlugins } from '../../core/plugins'
import { settings } from '../../core/settings'
import { NAME, REPO_URL, VERSION } from '../../meta'
import { Button, Row, Section, SwitchRow } from '../components'
import type { PageContext } from '../settingsSidebar'

export function SettingsPage({ refresh }: PageContext): Node {

  const s = settings.get()

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onChange: () => importSettings(fileInput, refresh),
  })

  return h(
    'div',
    {},
    Section(
      NAME,
      'An open source client mod for Fenrid with plugins, themes and more.',
      Row('Version', `v${VERSION}`, Button('Source on GitHub', () => window.open(REPO_URL, '_blank', 'noopener'), 'secondary')),
    ),
    Section(
      'General',
      `Choose how ${NAME} behaves.`,
      SwitchRow(
        'Show version in sidebar',
        `Adds the ${NAME} version under Fenrid's own version at the bottom of the settings sidebar.`,
        s.core.showFooterVersion,
        (v) => settings.update((x) => { x.core.showFooterVersion = v }),
      ),
      SwitchRow(
        'Debug logging',
        'Logs extra details to the developer console (F12). Turn this on when reporting a bug.',
        s.core.debug,
        (v) => settings.update((x) => { x.core.debug = v }),
      ),
    ),
    Section(
      'Backup',
      `Move your ${NAME} setup to another browser, or start fresh.`,
      Row('Export settings', 'Download your plugins, theme and settings as a file.', Button('Export', exportSettings)),
      Row('Import settings', 'Load a file you exported before. It replaces your current setup.', Button('Import', () => fileInput.click(), 'secondary')),
      Row('Reset everything', `Turn all plugins back to their defaults and clear your custom CSS. Fenrid's own settings are not affected.`, Button('Reset', () => confirmReset(refresh), 'danger')),
      fileInput,
    ),
  )
}

function exportSettings() {

  const blob = new Blob([settings.export()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = h('a', { href: url, download: `better-fenrid-settings-${new Date().toISOString().slice(0, 10)}.json` })

  a.click()

  setTimeout(() => URL.revokeObjectURL(url), 1000)

  toast('Settings exported', 'success')
}

async function importSettings(input: HTMLInputElement, refresh: () => void) {

  const file = input.files?.[0]

  input.value = ''

  if (!file) return

  try {

    settings.import(await file.text())
    syncPlugins()
    refresh()
    toast('Settings imported', 'success')

  } catch (err) {

    toast(`Import failed: ${(err as Error).message}`, 'error')

  }
}

function confirmReset(refresh: () => void) {

  const close = openModal({
    title: 'Reset everything?',
    body: h('p', { class: 'bf-row-desc' }, `This turns all plugins back to their defaults and clears your custom CSS and ${NAME} settings. Fenrid's own settings are not affected.`),
    footer: [
      Button('Cancel', () => close(), 'secondary'),
      Button('Reset', () => {

        settings.reset()
        syncPlugins()
        close()
        refresh()
        toast('Settings reset', 'success')

      }, 'danger'),
    ],
  })
}