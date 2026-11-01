import { Selectors } from '../core/selectors'

export function getComposer(): HTMLElement | null {

  return document.querySelector<HTMLElement>(Selectors.composer)

}

export function insertText(text: string): boolean {

  const el = getComposer()

  if (!el) return false

  el.focus()

  if (document.execCommand('insertText', false, text)) return true

  if (el instanceof HTMLTextAreaElement) {

    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!

    setter.call(el, el.value + text)

    el.dispatchEvent(new Event('input', { bubbles: true }))

    return true
  }

  return false
}