import { h } from '../core/dom'
import type { SettingDef } from '../core/plugins'
import { icon, type IconName } from './icons'

type Child = Node | string | null | undefined | false

export function Switch(checked: boolean, onChange: (value: boolean) => void, label?: string, disabled = false) {

  const input = h('input', {
    type: 'checkbox',
    role: 'switch',
    class: 'bf-switch-input',
    checked,
    disabled,
    'aria-label': label,
    onChange: () => onChange(input.checked),
  })

  return h('label', { class: 'bf-switch' }, input, h('span', { class: 'bf-switch-track' }))
}

// Default Fenrid's block
export function Section(title: string, description: string | null, ...children: Child[]) {

  return h(
    'section',
    { class: 'bf-section' },
    h('h3', { class: 'bf-section-title' }, title),
    description ? h('p', { class: 'bf-section-desc' }, description) : null,
    ...children,
  )
}

// Label and description on the left, control on the right
export function Row(label: string, description: string | undefined, control?: Node | null) {

  return h(
    'div',
    { class: 'bf-row' },
    h(
      'div',
      { class: 'bf-row-text' },
      h('div', { class: 'bf-row-label' }, label),
      description ? h('div', { class: 'bf-row-desc' }, description) : null,
    ),
    control ?? null,
  )
}

export function SwitchRow(label: string, description: string | undefined, checked: boolean, onChange: (v: boolean) => void) {

  return Row(label, description, Switch(checked, onChange, label))
}

export function Button(
  label: string,
  onClick: () => void,
  variant: 'primary' | 'secondary' | 'danger' = 'primary',
  iconName?: IconName,
) {

  return h(
    'button',
    { class: `bf-btn bf-btn-${variant}`, type: 'button', onClick },
    iconName ? icon(iconName, 16) : null,
    label,
  )
}

// Default Fenrid's control for a plugin setting definition
export function SettingControl(def: SettingDef, value: unknown, onChange: (value: unknown) => void): Node {

  switch (def.type) {

    case 'boolean':
      return SwitchRow(def.label, def.description, Boolean(value), onChange)

    case 'string': {

      const props = {
        class: 'bf-input',
        value: String(value ?? ''),
        placeholder: def.placeholder,
        onInput: (e: Event) => onChange((e.target as HTMLInputElement).value),
      }

      const field = def.multiline ? h('textarea', { ...props, rows: 4 }) : h('input', { ...props, type: 'text' })

      return h(
        'div',
        { class: 'bf-field' },
        h('label', { class: 'bf-row-label' }, def.label),
        def.description ? h('div', { class: 'bf-row-desc' }, def.description) : null,
        field,
      )
    }

    case 'number': {

      const field = h('input', {
        class: 'bf-input bf-input-number',
        type: 'number',
        value: String(value ?? def.default),
        min: def.min,
        max: def.max,
        step: def.step,
        onChange: (e: Event) => {

          const n = Number((e.target as HTMLInputElement).value)

          if (!Number.isNaN(n)) onChange(n)

        },
      })

      return Row(def.label, def.description, field)
    }

    case 'select': {

      const current = def.options.find((o) => o.value === value) ?? def.options[0]

      const label = h('span', { class: 'bf-dropdown-label' }, current?.label ?? '')
      const chevronSvg = icon('chevron', 16)

      const trigger = h(
        'button',
        {
          class: 'bf-dropdown-trigger',
          type: 'button',
          'aria-haspopup': 'listbox',
          'aria-expanded': 'false',
        },
        label,
        chevronSvg,
      )

      const menu = h('div', { class: 'bf-dropdown-menu', role: 'listbox' })

      const wrapper = h('div', { class: 'bf-dropdown' }, trigger, menu)

      const close = () => {
        trigger.setAttribute('aria-expanded', 'false')
        menu.classList.remove('bf-dropdown-open')
      }

      const buildItems = () => {

        menu.replaceChildren(
          ...def.options.map((o) => {

            const item = h(
              'div',
              {
                class: `bf-dropdown-item${o.value === value ? ' bf-dropdown-item-active' : ''}`,
                role: 'option',
                'aria-selected': o.value === value ? 'true' : 'false',
                onClick: (e: Event) => {
                  e.stopPropagation()
                  label.textContent = o.label
                  value = o.value
                  onChange(o.value)
                  close()
                  buildItems()
                },
              },
              o.label,
              o.value === value ? icon('check', 16) : null,
            )

            return item
          }),
        )
      }

      buildItems()

      trigger.addEventListener('click', (e) => {
        e.stopPropagation()

        const open = trigger.getAttribute('aria-expanded') === 'true'

        if (open) {
          close()
        } else {
          trigger.setAttribute('aria-expanded', 'true')
          menu.classList.add('bf-dropdown-open')
        }
      })

      const onOutside = (e: Event) => {

        if (!wrapper.contains(e.target as Node)) close()

      }

      document.addEventListener('pointerdown', onOutside, true)

      return Row(def.label, def.description, wrapper)
    }
  }
}