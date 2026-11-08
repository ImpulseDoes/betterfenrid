import { openModal } from '../../api/modal'
import { toast } from '../../api/toast'
import { h } from '../../core/dom'
import { syncPlugins } from '../../core/plugins'
import { settings } from '../../core/settings'
import { checkForUpdates, onAndroid, openChangelog, updatesInApp } from '../../core/updates'
import { COMMIT, NAME, REPO_URL, VERSION } from '../../meta'
import { Button, Row, Section, SettingControl, Switch, SwitchRow } from '../components'
import type { PageContext } from '../settingsSidebar'
import { SoundsSection } from './sounds'
import { makeAppIcon } from '../../core/appIcon'

function AppIconRow(refresh: () => void): Node {

  const icon = settings.get().core.appIcon

  const picker = h('input', {
    type: 'file',
    accept: 'image/png,image/jpeg,image/webp,image/gif',
    hidden: true,
    onChange: async () => {

      const file = picker.files?.[0]

      picker.value = ''

      if (!file) return

      try {

        const appIcon = await makeAppIcon(file)

        settings.update((x) => { x.core.appIcon = appIcon })
        toast('App icon changed', 'success')
        refresh()

      } catch {

        toast('That file doesn\'t look like a picture', 'error')

      }
    },
  })

  const preview = h('span', { class: 'bf-app-icon-preview' }, icon ? h('img', { src: icon, alt: '' }) : null)

  return Row(
    'App icon',
    `Your own picture instead of Fenrid's logo: on the Direct Messages button and the browser tab, and in the desktop app on the window, taskbar and tray. It's cropped to a square.`,
    h(
      'div',
      { class: 'bf-sound-buttons' },
      preview,
      Button(icon ? 'Change' : 'Upload', () => picker.click(), 'secondary'),
      icon ? Button('Reset', () => {

        settings.update((x) => { x.core.appIcon = '' })
        refresh()

      }, 'secondary') : null,
      picker,
    ),
  )
}

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
      Row('Version', `v${VERSION}${COMMIT ? ` (${COMMIT})` : ''}`, Button('Source on GitHub', () => window.open(REPO_URL, '_blank', 'noopener'), 'secondary')),
      Row('Updates', onAndroid ? 'The app downloads new versions on its own and switches to them the next time it starts.' : updatesInApp ? 'The desktop app downloads new versions on its own every couple of hours and switches to them the next time Fenrid reloads.' :'Your userscript manager installs new versions on its own about once a day. Check now to get the latest one right away.', Button('Check for updates', checkForUpdates, 'secondary')),
      Row('Changelog', 'See what changed in recent versions.', Button('What\'s new', () => openChangelog(), 'secondary')),
    ),
    Section(
      'General',
      `Choose how ${NAME} behaves.`,
      SwitchRow(
        'Show what\'s new after updates',
        'Lists the changes once, the first time Fenrid loads after an update.',
        s.core.updateNotices,
        (v) => settings.update((x) => { x.core.updateNotices = v }),
      ),
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
      Row(
        'Force Canary API',
        'Not available yet.',
        Switch(false, () => { }, 'Force Canary API', true),
      ),
      SettingControl(
        {
          type: 'string',
          label: 'Font',
          description: 'A font installed on your computer, or one from Google Fonts with the switch below. Leave empty for Fenrid\'s own. Code keeps its font.',
          placeholder: 'Segoe UI',
          default: '',
        },
        s.core.font,
        (v) => settings.update((x) => { x.core.font = String(v) }),
      ),
      SwitchRow(
        'Get the font from Google Fonts',
        'Use any font from fonts.google.com by its exact name. It\'s downloaded once and kept, so Google isn\'t asked again every time Fenrid opens.',
        s.core.googleFont,
        (v) => settings.update((x) => { x.core.googleFont = v }),
      ),
      AppIconRow(refresh),
    ),
    SoundsSection(refresh),
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