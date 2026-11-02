import { avatarUrl, memberOf, mentionTextOf, watchProfileTriggers } from '../api/profiles'
import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import { Selectors } from '../core/selectors'

const AVATAR = 'bf-mention-avatar'
const MEDIA = `img:not(.${AVATAR}), video, picture, canvas`

function followsAvatar(trigger: Element): boolean {

  for (const el of [trigger, trigger.parentElement]) {

    const before = el?.previousSibling

    if (!(before instanceof Element)) continue

    const opensProfile = before.matches(Selectors.profileTrigger) || !!before.querySelector(Selectors.profileTrigger)

    if (opensProfile && (before.matches(MEDIA) || !!before.querySelector(MEDIA))) return true
  }

  return false
}

export default definePlugin({
  id: 'mentionAvatars',
  name: 'Mention Avatars',
  description: 'Shows user avatars inside mentions.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    watchProfileTriggers(ctx, (trigger) => {

      const text = mentionTextOf(trigger)

      if (!text || followsAvatar(trigger)) return void text?.querySelector(`.${AVATAR}`)?.remove()

      if (text.querySelector(`.${AVATAR}`)) return

      const src = avatarUrl(memberOf(trigger)?.profiles)

      if (!src) return

      const img = h('img', { class: AVATAR, src, alt: '', loading: 'lazy', onError: () => img.remove() })

      text.prepend(img)
    })

    ctx.onStop(() => document.querySelectorAll(`.${AVATAR}`).forEach((img) => img.remove()))
  },
})