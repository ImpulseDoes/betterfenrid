import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'

const FRAME = '.fenrid-safe-modal-frame'

function parseDomains(value: string): string[] {

  return value
    .split(/[\s,]+/)
    .map((d) => d.trim().toLowerCase().replace(/^\*\./, '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, ''))
    .filter(Boolean)
}

export default definePlugin({
  id: 'noLinkWarning',
  name: 'No Link Warning',
  description: 'Opens links straight away, without Fenrid\'s "Leaving Fenrid" warning.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    domains: {
      type: 'string',
      label: 'Only these sites',
      description: 'Separated by commas, like youtube.com, github.com. Their subdomains count too. Leave empty to skip the warning for every link.',
      default: '',
    },
  },

  start(ctx) {

    const allowed = (host: string) => {

      const domains = parseDomains(ctx.settings.domains)
      const name = host.toLowerCase().replace(/\.$/, '')

      return !domains.length || domains.some((d) => name === d || name.endsWith(`.${d}`))
    }

    const skip = (frame: Element) => {

      const props = findProps(frame, (p) => typeof p.onVisit === 'function' && p.url instanceof URL && 'onTrustDomainChange' in p)

      if (!props || !allowed(props.url.hostname)) return

      const el = frame as HTMLElement

      el.style.visibility = 'hidden'
      void props.onVisit()
    }

    ctx.onDomChange((added) => {

      for (const el of added) {

        if (el.matches(FRAME)) skip(el)
        else el.querySelectorAll(FRAME).forEach(skip)

      }
    })
  },
})