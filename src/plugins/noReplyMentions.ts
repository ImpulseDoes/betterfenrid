import { definePlugin } from '../core/plugins'
import { Selectors } from '../core/selectors'

export default definePlugin({
  id: 'noReplyMentions',
  name: 'No Reply Mentions',
  description: 'Turns off the reply ping by default. You can still turn it on for a single reply.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,

  start(ctx) {

    // Set when you turn the ping on by hand, so it isn't switched straight back off
    let keepOn = false

    // Fenrid turns the ping back on for every new reply, so this has to keep up with it.
    // Pressing its own toggle also keeps the button showing the real state
    const sync = () => {

      const bar = document.querySelector(Selectors.replyBar)

      if (!bar) {

        keepOn = false

        return
      }

      if (!keepOn) bar.querySelector<HTMLElement>(Selectors.replyMentionOn)?.click()
    }

    const onClick = (event: MouseEvent) => {

      const toggle = (event.target as Element).closest(`${Selectors.replyBar} ${Selectors.replyMentionToggle}`)

      if (event.isTrusted && toggle) keepOn = !toggle.matches(Selectors.replyMentionOn)

      // Choosing Reply on another message changes the bar without adding anything to the page
      setTimeout(sync, 60)
    }

    document.addEventListener('click', onClick, true)

    ctx.onStop(() => document.removeEventListener('click', onClick, true))
    ctx.onDomChange(sync)
  },
})