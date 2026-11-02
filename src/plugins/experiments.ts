import { h } from '../core/dom'
import { definePlugin, getPluginSetting, setPluginSetting, type Plugin } from '../core/plugins'
import { Button, Row, Section, SettingControl } from '../ui/components'

const FLAGS = {
  presenceDebug: { storage: () => localStorage, key: 'fenrid:presence-debug', value: '1' },
  rtcDiagnostics: { storage: () => localStorage, key: 'fenrid:rtc-developer-diagnostics', value: '1' },
  navigationTrace: { storage: () => sessionStorage, key: 'fenrid:nav-trace', value: '1' },
  defaultProfileThemes: { storage: () => localStorage, key: 'fenrid:show-default-profile-themes', value: 'true' },
}

const PROFILE_THEMES_CHANGED = 'fenrid:profile-accessibility-changed'
const OPEN_WHATS_NEW = 'fenrid:open-whats-new'

type Flag = keyof typeof FLAGS

const NAMES = Object.keys(FLAGS) as Flag[]

function setFlag(flag: Flag, on: boolean) {

  const { storage, key, value } = FLAGS[flag]

  try {

    if (on) storage().setItem(key, value)
    else storage().removeItem(key)

  } catch { }

  if (flag === 'defaultProfileThemes') window.dispatchEvent(new Event(PROFILE_THEMES_CHANGED))
}

const IN_DEVELOPMENT = [
  ['Events', 'Sign-ups, waitlists, questions and announcements.'],
  ['Giveaways', 'Prizes, winners and limits on how many you can join.'],
  ['Events Studio and Giveaway Studio', 'Dashboards for hosting both.'],
  ['Discovery Events and Giveaways', 'Marked as coming soon in Server Discovery.'],
]

function switches(...flags: Flag[]): Node[] {

  const target = plugin as Plugin<any>

  return flags.map((flag) => SettingControl(target.settings[flag], getPluginSetting(target, flag), (value) => setPluginSetting(target, flag, value)))
}

function ExperimentsPage(): Node {

  return h(
    'div',
    {},
    Section(
      'Hidden features',
      'Things Fenrid can do but has no button or setting for.',
      ...switches('defaultProfileThemes'),
      Row('What\'s New', 'Opens Fenrid\'s notes for its latest update.', Button('Open', () => window.dispatchEvent(new Event(OPEN_WHATS_NEW)), 'secondary')),
    ),
    Section(
      'Debug logs',
      'Fenrid\'s own logging, printed to the browser console (F12).',
      ...switches('presenceDebug', 'rtcDiagnostics', 'navigationTrace'),
    ),
    Section(
      'In development',
      'Found in Fenrid\'s client, with no way to turn them on from here.',
      ...IN_DEVELOPMENT.map(([name, description]) => Row(name, description)),
    ),
  )
}

const plugin = definePlugin({
  id: 'experiments',
  name: 'Experiments',
  description: 'Adds an Experiments tab to the sidebar, with hidden Fenrid features and debug logs.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    defaultProfileThemes: {
      type: 'boolean',
      label: 'Default profile themes',
      description: 'Ignores the custom colors on people\'s profile cards. Fenrid has this switch, but no setting for it.',
      default: false,
    },
    presenceDebug: {
      type: 'boolean',
      label: 'Presence logs',
      description: 'Logs why people\'s online status changes.',
      default: false,
    },
    rtcDiagnostics: {
      type: 'boolean',
      label: 'Voice diagnostics',
      description: 'Logs the voice connection\'s security state.',
      default: false,
    },
    navigationTrace: {
      type: 'boolean',
      label: 'Navigation trace',
      description: 'Logs how long moving between pages takes.',
      default: false,
    },
  },

  page: { id: 'experiments', label: 'Experiments', title: 'Experiments', icon: 'flask', render: ExperimentsPage },

  start(ctx) {

    const apply = () => NAMES.forEach((flag) => setFlag(flag, ctx.settings[flag]))

    apply()

    ctx.onSettingsChange(apply)
    ctx.onStop(() => NAMES.forEach((flag) => setFlag(flag, false)))
  },
})

export default plugin