import { h } from '../core/dom'

type ToastKind = 'info' | 'success' | 'error'

let host: HTMLElement | null = null

export function toast(message: string, kind: ToastKind = 'info', durationMs = 2500) {

  if (!host?.isConnected) {

    host = h('div', { class: 'bf-toasts' })

    document.body.append(host)
  }

  const el = h('div', { class: `bf-toast bf-toast-${kind}`, role: 'status' }, message)

  host.append(el)

  setTimeout(() => {

    el.classList.add('bf-toast-out')
    el.addEventListener('animationend', () => el.remove(), { once: true })

  }, durationMs)
}