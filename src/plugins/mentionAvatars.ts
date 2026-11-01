import { avatarUrl, memberOf, mentionTextOf, watchProfileTriggers } from '../api/profiles'
import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'

const AVATAR = 'bf-mention-avatar'

export default definePlugin({
  id: 'mentionAvatars',
  name: 'Mention Avatars',
  description: 'Shows user avatars inside mentions.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    watchProfileTriggers(ctx, (trigger) => {

      const text = mentionTextOf(trigger)

      if (!text || text.querySelector(`.${AVATAR}`)) return

      const src = avatarUrl(memberOf(trigger)?.profiles)

      if (!src) return

      const img = h('img', { class: AVATAR, src, alt: '', loading: 'lazy', onError: () => img.remove() })

      text.prepend(img)
    })

    ctx.onStop(() => document.querySelectorAll(`.${AVATAR}`).forEach((img) => img.remove()))
  },
})