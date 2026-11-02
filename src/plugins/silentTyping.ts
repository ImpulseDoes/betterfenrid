import { GatewayOp, injectGatewayEvent, onGatewaySend } from '../api/network'
import { currentUserId } from '../api/profiles'
import { definePlugin } from '../core/plugins'

export default definePlugin({
  id: 'silentTyping',
  name: 'Silent Typing',
  description: 'Hides that you are typing.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,

  start(ctx) {

    ctx.onStop(
      onGatewaySend(({ op, d }) => {

        if (op !== GatewayOp.CLIENT_EVENT || !/^TYPING_/.test(d?.event)) return

        // Also stop "local" typing event from going off
        const me = d.event === 'TYPING_START' ? currentUserId() : null

        if (me) queueMicrotask(() => injectGatewayEvent('TYPING_STOP', d.topic, { user_id: me }))

        return false
      }),
    )
  },
})