import { definePlugin } from '../core/plugins'

export default definePlugin({
  id: 'translate',
  name: 'Translate',
  description: 'Adds "Translate" to the message menu, which opens the message in Google Translate.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    target: {
      type: 'select',
      label: 'Translate to',
      default: 'en',
      options: [
        { label: 'English', value: 'en' },
        { label: 'Polski', value: 'pl' },
        { label: 'Deutsch', value: 'de' },
        { label: 'Español', value: 'es' },
        { label: 'Français', value: 'fr' },
        { label: 'Українська', value: 'uk' },
      ],
    },
  },

  start(ctx) {

    ctx.addMessageMenuItem({
      id: 'translate',
      label: 'Translate',
      icon: '',
      visible: (msg) => msg.text.length > 0,
      action: (msg) => {

        const url = new URL('https://translate.google.com/')

        url.searchParams.set('sl', 'auto')
        url.searchParams.set('tl', ctx.settings.target)
        url.searchParams.set('text', msg.text)
        url.searchParams.set('op', 'translate')

        window.open(url, '_blank', 'noopener')

      },
    })
  },
})