import { h } from '../../core/dom'
import { getPlugins, getPluginSetting, isAvailable, isEnabled, setEnabled, setPluginSetting, type Plugin } from '../../core/plugins'
import { tooltip } from '../tooltip'
import { Section, SettingControl, Switch } from '../components'
import { icon } from '../icons'

export function PluginsPage(): Node {

  const plugins = getPlugins()
  const list = h('div', { class: 'bf-options' })

  const search = h('input', {
    class: 'bf-input',
    type: 'search',
    placeholder: 'Search plugins',
    'aria-label': 'Search plugins',
    onInput: () => render(),
  })

  const render = () => {

    const q = search.value.trim().toLowerCase()
    const matches = plugins.filter((p) => `${p.name} ${p.description} ${p.authors.join(' ')}`.toLowerCase().includes(q))

    list.replaceChildren(
      ...(matches.length ? matches.map(PluginCard) : [h('div', { class: 'bf-empty' }, 'No plugins match your search.')]),
    )
  }

  render()

  return h(
    'div',
    {},
    Section(
      'Plugins',
      `Turn features on and off. Changes apply instantly, no reload needed. ${plugins.length} plugins installed.`,
      h('div', { class: 'bf-search' }, icon('search', 18), search),
      list,
    ),
  )
}

// Looks like Fenrid's option cards (e.g. the language list)
function PluginCard(plugin: Plugin): Node {

  const schema = plugin.page ? [] : Object.entries(plugin.settings ?? {})
  const available = isAvailable(plugin)
  const card = h('div', { class: available ? 'bf-option' : 'bf-option bf-option-unavailable' })

  const pcOnly = plugin.desktopOnly
    ? tooltip(h('span', { class: 'bf-option-tag' }, 'PC only'), available ? 'Needs the Better Fenrid desktop app' : 'Only works in the Better Fenrid desktop app')
    : plugin.androidOnly
      ? tooltip(h('span', { class: 'bf-option-tag' }, 'Android only'), available ? 'Needs the Better Fenrid Android app' : 'Only works in the Better Fenrid Android app')
      : null

  const where = plugin.androidOnly ? 'Android app' : 'desktop app'
  const switchLabel = !available ? `${plugin.name} only works in the ${where}` : plugin.required ? `${plugin.name} is always on` : `Enable ${plugin.name}`

  const hasSettings = schema.length > 0 || !!plugin.panel

  const expand = hasSettings
    ? h(
      'button',
      {
        class: 'bf-icon-btn bf-option-expand',
        type: 'button',
        'aria-label': `${plugin.name} settings`,
        onClick: () => card.classList.toggle('bf-open'),
      },
      icon('chevron'),
    )
    : null

  card.append(
    h(
      'div',
      { class: 'bf-option-head' },
      h(
        'div',
        { class: 'bf-option-text' },
        h('div', { class: 'bf-option-title' }, plugin.name, pcOnly),
        h('div', { class: 'bf-option-desc' }, plugin.description),
      ),
      expand,
      Switch(isEnabled(plugin.id), (v) => setEnabled(plugin.id, v), switchLabel, !available || !!plugin.required),
    ),
  )

  if (hasSettings) {

    card.append(
      h(
        'div',
        { class: 'bf-option-settings' },
        ...schema.map(([key, def]) => SettingControl(def, getPluginSetting(plugin, key), (v) => setPluginSetting(plugin, key, v))),
        plugin.panel?.(),
      ),
    )
  }

  return card
}