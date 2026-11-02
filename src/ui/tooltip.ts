import { h } from '../core/dom'

const GAP = 8

const BOX = 'bf-tooltip border border-[#555c6b] bg-secondary-button text-text-primary shadow-xl rounded-lg px-3 py-2 text-sm font-semibold leading-4 text-center pointer-events-none'
const ARROW = 'bf-tooltip-arrow block size-2.5 box-border border-r border-b border-[#555c6b] bg-secondary-button'

let current: { tip: HTMLElement; target: Element } | null = null

function hide() {

  current?.tip.remove()
  current = null
}

function watch() {

  if (!current) return

  if (!current.target.isConnected) return hide()

  requestAnimationFrame(watch)
}

function show(target: Element, text: string) {

  hide()

  const tip = h('div', { class: BOX, role: 'tooltip' }, text, h('span', { class: ARROW, 'aria-hidden': 'true' }))

  document.body.append(tip)

  const anchor = target.getBoundingClientRect()
  const box = { width: tip.offsetWidth, height: tip.offsetHeight }
  const left = Math.min(Math.max(8, anchor.left + anchor.width / 2 - box.width / 2), innerWidth - box.width - 8)
  const above = anchor.top - box.height - GAP
  const top = above < 8 ? anchor.bottom + GAP : above

  tip.classList.toggle('bf-tooltip-below', above < 8)
  tip.style.left = `${left}px`
  tip.style.top = `${top}px`
  tip.style.setProperty('--bf-arrow-x', `${anchor.left + anchor.width / 2 - left}px`)

  current = { tip, target }

  requestAnimationFrame(watch)
}

/** A hover tooltip that looks like Fenrid's */
export function tooltip<T extends Element>(target: T, text: string): T {

  target.setAttribute('aria-label', text)

  if (target instanceof HTMLElement && target.tabIndex < 0) target.tabIndex = 0

  target.addEventListener('pointerenter', () => show(target, text))
  target.addEventListener('focus', () => show(target, text))
  target.addEventListener('pointerleave', hide)
  target.addEventListener('blur', hide)

  return target
}

window.addEventListener('scroll', hide, true)