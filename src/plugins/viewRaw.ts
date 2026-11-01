import { openModal } from '../api/modal'
import { toast } from '../api/toast'
import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { Button } from '../ui/components'

export default definePlugin({
  id: 'viewRaw',
  name: 'View Raw',
  description: 'Adds "View Raw" to the message menu to see and copy a message\'s plain text.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,
  settings: {
    showId: {
      type: 'boolean',
      label: 'Show message ID',
      default: true,
    },
  },

  start(ctx) {

    ctx.addMessageMenuItem({
      id: 'viewRaw',
      label: 'View Raw',
      icon: 'code',
      action: (msg) => {

        const copy = async () => {

          await navigator.clipboard.writeText(msg.text)
          toast('Copied to clipboard', 'success')

        }

        const close = openModal({
          title: 'Raw message',
          body: h(
            'div',
            {},
            ctx.settings.showId && msg.id ? h('p', { class: 'bf-row-desc' }, `ID: ${msg.id}`) : null,
            h('pre', { class: 'bf-pre' }, msg.text || '(no text)'),
          ),
          footer: [Button('Close', () => close(), 'secondary'), Button('Copy', copy)],
        })
      },
    })
  },
})