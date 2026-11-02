import type { MenuTarget } from '../api/contextMenu'
import { openModal } from '../api/modal'
import { toast } from '../api/toast'
import { h } from '../core/dom'
import { getChannel, getMessage, getUser } from '../core/entities'
import { definePlugin } from '../core/plugins'
import { Button } from '../ui/components'

async function fetchUser(id: string): Promise<object | null> {

  try {

    const response = await fetch(`/api/users/${encodeURIComponent(id)}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })

    return response.ok ? await response.json() : null

  } catch {

    return null

  }
}

async function loadRaw({ kind, id }: MenuTarget): Promise<object | null> {

  if (!id) return null
  if (kind === 'message') return getMessage(id)
  if (kind === 'channel' || kind === 'category') return getChannel(id)

  return (await fetchUser(id)) ?? getUser(id)
}

export default definePlugin({
  id: 'viewRaw',
  name: 'View Raw',
  description: 'Adds "View Raw" to the message, channel, category and user menus to see and copy the raw JSON.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    ctx.addContextMenuItem({
      id: 'viewRaw',
      label: 'View Raw',
      icon: 'code',
      kinds: ['message', 'channel', 'category', 'user'],
      action: async (target) => {

        if (!target.id) return toast(`Could not read the ${target.kind} ID`, 'error')

        const raw = await loadRaw(target)
        const json = JSON.stringify(raw ?? { id: target.id }, null, 2)

        const copy = async () => {

          await navigator.clipboard.writeText(json)
          toast('Copied to clipboard', 'success')

        }

        // Direct messages arrive encrypted, so the only readable text is what's on screen
        const decrypted = target.kind === 'message' && raw && !('content' in raw) ? target.text : ''

        const close = openModal({
          title: `Raw ${target.kind}`,
          body: h(
            'div',
            {},
            raw ? null : h('p', { class: 'bf-row-desc' }, 'Better Fenrid hasn\'t received this data from Fenrid yet.'),
            decrypted ? h('p', { class: 'bf-row-desc' }, `Decrypted text: ${decrypted}`) : null,
            h('pre', { class: 'bf-pre' }, json),
          ),
          footer: [Button('Close', () => close(), 'secondary'), Button('Copy', copy)],
        })
      },
    })
  },
})