import { h } from '../core/dom'
import { icon } from '../ui/icons'

export interface ModalOptions {
  title: string
  body: Node | string
  footer?: Node[]
}

export function openModal({ title, body, footer = [] }: ModalOptions): () => void {

  const close = () => {

    backdrop.remove()
    document.removeEventListener('keydown', onKey, true)

  }

  const onKey = (e: KeyboardEvent) => {

    if (e.key === 'Escape') {

      e.stopPropagation()
      close()

    }
  }

  const closeBtn = h('button', { class: 'bf-icon-btn', 'aria-label': 'Close', onClick: close }, icon('close'))

  const backdrop = h(
    'div',
    {
      class: 'bf-root bf-modal-backdrop',
      onMousedown: (e: MouseEvent) => e.target === backdrop && close(),
    },
    h(
      'div',
      { class: 'bf-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', { class: 'bf-modal-header' }, h('h2', {}, title), closeBtn),
      h('div', { class: 'bf-modal-body' }, body),
      footer.length ? h('footer', { class: 'bf-modal-footer' }, ...footer) : null,
    ),
  )

  document.addEventListener('keydown', onKey, true)
  document.body.append(backdrop)

  return close
}