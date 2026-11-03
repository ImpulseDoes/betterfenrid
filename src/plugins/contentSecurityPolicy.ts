import { h } from '../core/dom'
import { definePlugin, inDesktopApp } from '../core/plugins'

function hasExtension() {

  return document.documentElement.dataset.bfCsp === '1'
}

export default definePlugin({
  id: 'contentSecurityPolicy',
  name: 'Content Security Policy',
  description: 'Lets Spotify, YouTube and GitHub run inside Fenrid. Desktop does this in the app. In the browser, load the unpacked extension from the extension folder.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  panel() {

    if (inDesktopApp()) return h('div', { class: 'bf-option-desc' }, 'On desktop the app applies this itself.')

    if (hasExtension()) return h('div', { class: 'bf-option-desc' }, 'The browser extension is loaded. Players in chat can run.')

    return h(
      'div',
      { class: 'bf-option-desc' },
      'In Chrome or Edge: chrome://extensions → Developer mode → Load unpacked → pick the extension folder in this repo. Then reload Fenrid.',
    )
  },

  start() {

    const set = window.BetterFenridNative?.setContentSecurityPolicy

    if (!set) return

    set(true)

    return () => set(false)
  },
})