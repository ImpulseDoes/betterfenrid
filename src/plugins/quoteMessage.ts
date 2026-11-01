import { insertText } from '../api/composer'
import { toast } from '../api/toast'
import { definePlugin } from '../core/plugins'

export default definePlugin({
  id: 'quoteMessage',
  name: 'Quote Message',
  description: 'Adds "Quote Message" to the message menu, which pastes the message into your message box as a quote.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,
  settings: {
    addNewLine: {
      type: 'boolean',
      label: 'Add an empty line after the quote',
      description: 'So you can start typing your reply right away.',
      default: true,
    },
  },

  start(ctx) {

    ctx.addContextMenuItem({
      id: 'quote',
      label: 'Quote Message',
      icon: 'quote',
      visible: (msg) => msg.text.length > 0,
      action: (msg) => {

        const quote = msg.text.split('\n').map((line) => `> ${line}`).join('\n')
        const ok = insertText(quote + (ctx.settings.addNewLine ? '\n\n' : '\n'))

        if (!ok) toast('Could not find the message box', 'error')

      },
    })
  },
})