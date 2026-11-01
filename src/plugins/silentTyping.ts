import { GatewayOp, injectGatewayEvent, onGatewaySend } from '../api/network'
import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'

function currentUserId(): string | null {

  const trigger = document.querySelector(Selectors.profileTrigger)

  return trigger ? (findProps(trigger, (props) => typeof props.currentUserId === 'string')?.currentUserId ?? null) : null
}

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