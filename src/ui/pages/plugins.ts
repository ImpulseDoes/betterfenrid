import { h } from '../../core/dom'
import { getPlugins, getPluginSetting, isEnabled, setEnabled, setPluginSetting, type Plugin } from '../../core/plugins'
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
  const card = h('div', { class: 'bf-option' })

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
        h('div', { class: 'bf-option-title' }, plugin.name),
        h('div', { class: 'bf-option-desc' }, plugin.description),
      ),
      expand,
      Switch(isEnabled(plugin.id), (v) => setEnabled(plugin.id, v), `Enable ${plugin.name}`),
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