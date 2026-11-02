import { onApiRequestBody } from '../api/network'
import { definePlugin } from '../core/plugins'
import { Selectors } from '../core/selectors'

const SEND = /^\/api\/chat\/server\/messages(\/\d+)?$/
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/g
const TRAILING = /[.,!?;:)\]}]+$/

const GLOBAL_PARAMS = [
  /^utm_/, /^mtm_/, /^pk_/, /^hsa_/, /^_hs/, /^mc_[ce]id$/, /^__s$/,
  /^fbclid$/, /^gclid$/, /^gclsrc$/, /^dclid$/, /^gbraid$/, /^wbraid$/, /^msclkid$/, /^yclid$/, /^ttclid$/, /^twclid$/,
  /^igshid$/, /^igsh$/, /^mkt_tok$/, /^oly_(anon|enc)_id$/, /^vero_(conv|id)$/, /^rb_clickid$/, /^srsltid$/,
]

const SITE_PARAMS: [RegExp, RegExp[]][] = [
  [/(^|\.)(twitter|x)\.com$/, [/^s$/, /^t$/, /^ref_src$/, /^ref_url$/]],
  [/(^|\.)(youtube\.com|youtu\.be)$/, [/^si$/, /^feature$/, /^pp$/]],
  [/(^|\.)spotify\.com$/, [/^si$/, /^context$/, /^nd$/]],
  [/(^|\.)tiktok\.com$/, [/^is_from_webapp$/, /^sender_device$/, /^_r$/, /^_t$/, /^share_/]],
  [/(^|\.)reddit\.com$/, [/^share_id$/, /^ref$/, /^ref_source$/, /^rdt$/]],
  [/(^|\.)facebook\.com$/, [/^mibextid$/, /^__cft__/, /^__tn__$/, /^sfnsn$/]],
  [/(^|\.)linkedin\.com$/, [/^trk/, /^lipi$/, /^trackingId$/]],
  [/(^|\.)amazon\.[a-z.]+$/, [/^ref_?$/, /^pd_rd_/, /^pf_rd_/, /^content-id$/, /^_encoding$/, /^qid$/, /^sr$/, /^sprefix$/, /^crid$/, /^dib/, /^tag$/]],
  [/(^|\.)aliexpress\.[a-z.]+$/, [/^spm$/, /^scm/, /^pvid$/, /^algo_/, /^aff_/, /^sk$/, /^gps-id$/, /^_t$/]],
]

export function cleanUrl(raw: string): string {

  let url: URL

  try {

    url = new URL(raw)

  } catch {

    return raw

  }

  const host = url.hostname.toLowerCase()
  const rules = [...GLOBAL_PARAMS, ...SITE_PARAMS.filter(([site]) => site.test(host)).flatMap(([, params]) => params)]
  const keys = [...new Set(url.searchParams.keys())]
  const tracking = keys.filter((key) => rules.some((rule) => rule.test(key)))

  if (!tracking.length) return raw

  for (const key of tracking) url.searchParams.delete(key)

  // Amazon also hides tracking in the path: /dp/ID/ref=...
  if (/(^|\.)amazon\./.test(host)) url.pathname = url.pathname.replace(/\/ref=[^/]*$/, '')

  return url.toString().replace(/\?$/, '')
}

export function cleanText(text: string): string {

  return text.replace(URL_PATTERN, (match) => {

    const trailing = match.match(TRAILING)?.[0] ?? ''
    const link = trailing ? match.slice(0, -trailing.length) : match

    return cleanUrl(link) + trailing
  })
}

export default definePlugin({
  id: 'clearUrls',
  name: 'Clear URLs',
  description: 'Removes tracking junk like utm_source, fbclid and si= from links you send or paste.',
  authors: ['Better Fenrid'],
  enabledByDefault: true,

  start(ctx) {

    ctx.onStop(
      onApiRequestBody(({ url, method }, body) => {

        if (!SEND.test(url.pathname) || (method !== 'POST' && method !== 'PATCH') || typeof body?.content !== 'string') return

        const content = cleanText(body.content)

        return content === body.content ? undefined : { ...body, content }
      }),
    )

    const onPaste = (e: ClipboardEvent) => {

      const target = e.target as Element | null

      if (!target?.closest?.(Selectors.composer) || e.clipboardData?.types.includes('Files')) return

      const text = e.clipboardData?.getData('text/plain') ?? ''
      const cleaned = cleanText(text)

      if (cleaned === text) return

      // Stopped before the editor sees it, then typed in as if pasted
      e.preventDefault()
      e.stopImmediatePropagation()
      document.execCommand('insertText', false, cleaned)
    }

    window.addEventListener('paste', onPaste, true)

    ctx.onStop(() => window.removeEventListener('paste', onPaste, true))
  },
})