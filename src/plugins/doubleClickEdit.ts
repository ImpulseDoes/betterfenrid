import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'
import { isDeletedMessage } from './deletedMessages'

const INTERACTIVE = 'a, button, img, video, audio, input, textarea, [contenteditable="true"], [role="button"]'

export default definePlugin({
  id: 'doubleClickEdit',
  name: 'Double Click To Edit',
  description: 'Double click one of your messages to edit it.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    const onDoubleClick = (event: MouseEvent) => {

      const target = event.target as Element

      const row = target.closest(Selectors.message)

      if (!row || target.closest(INTERACTIVE)) return

      const item = findProps(row, (props) => typeof props.onStartInlineEdit === 'function' && !!props.message)

      if (!item || item.message.author_id !== item.currentUserId || isDeletedMessage(item.message.id)) return

      // The double click has just selected a word, which would stay highlighted under the editor
      getSelection()?.removeAllRanges()

      item.onStartInlineEdit(item.message)
    }

    document.addEventListener('dblclick', onDoubleClick)

    ctx.onStop(() => document.removeEventListener('dblclick', onDoubleClick))
  },
})