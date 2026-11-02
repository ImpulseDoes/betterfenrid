import { Selectors } from '../core/selectors'

let lastFocused: HTMLElement | null = null

// Remembers the box you typed in last, since the emoji picker or a menu takes the focus away from it
document.addEventListener('focusin', (event) => {

  const el = (event.target as Element | null)?.closest?.<HTMLElement>(Selectors.composer)

  if (el) lastFocused = el

}, true)

export function getComposer(): HTMLElement | null {

  if (lastFocused?.isConnected) return lastFocused

  const boxes = [...document.querySelectorAll<HTMLElement>(Selectors.composer)]

  return boxes.find((el) => !el.closest(Selectors.message)) ?? boxes[0] ?? null

}

export function insertText(text: string): boolean {

  const el = getComposer()

  if (!el) return false

  // Fenrid's box is a Tiptap editor. Focusing it through ProseMirror puts the caret back where it was
  const view = (el as unknown as { editor?: { view?: { focus(): void } } }).editor?.view

  if (view) view.focus()
  else el.focus()

  if (document.execCommand('insertText', false, text)) return true

  if (el instanceof HTMLTextAreaElement) {

    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!

    setter.call(el, el.value + text)

    el.dispatchEvent(new Event('input', { bubbles: true }))

    return true
  }

  return false
}