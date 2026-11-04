import { toast } from '../api/toast'
import { createLogger } from './logger'
import { settings } from './settings'
import { createStyle } from './styles'

const CACHE_KEY = 'BetterFenrid:fontCache'
const MAX_AGE = 90 * 24 * 60 * 60 * 1000
const API = 'https://fonts.googleapis.com/css2'
const WEIGHTS = 'wght@100;200;300;400;500;600;700;800;900'

interface CachedFont {
  css: string
  at: number
}

const log = createLogger('Fonts')

const cleanName = (font: string) => font.replace(/["'\\]/g, '').replace(/\s+/g, ' ').trim()

const titleCase = (name: string) => name.replace(/\b\w/g, (c) => c.toUpperCase())

function readCache(): Record<string, CachedFont> {

  try {

    const data = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')

    return data && typeof data === 'object' ? data : {}

  } catch {

    return {}

  }
}

function writeCache(family: string, css: string) {

  try {

    localStorage.setItem(CACHE_KEY, JSON.stringify({ [family.toLowerCase()]: { css, at: Date.now() } }))

  } catch { }
}

// Fenrid's CSP only lets stylesheets in with its nonce, which its own scripts carry
function pageNonce(): string {

  for (const el of document.querySelectorAll<HTMLElement>('script[nonce], style[nonce], link[nonce]')) {

    if (el.nonce) return el.nonce

  }

  return ''
}

function loadCss(query: string): Promise<string | null> {

  return new Promise((resolve) => {

    const link = document.createElement('link')
    const done = (css: string | null) => {
      link.remove()
      resolve(css)
    }

    link.rel = 'stylesheet'
    link.crossOrigin = 'anonymous'
    link.nonce = pageNonce()
    link.href = `${API}?${query}&display=swap`

    link.onload = () => {

      try {

        const rules = [...(link.sheet?.cssRules ?? [])].filter((rule) => rule instanceof CSSFontFaceRule)

        done(rules.length ? rules.map((rule) => rule.cssText).join('\n') : null)

      } catch {

        done(null)

      }
    }

    link.onerror = () => done(null)

      ; (document.head ?? document.documentElement).append(link)
  })
}

async function downloadFont(name: string): Promise<string | null> {

  // Google's names are case-sensitive. "lobster" most likely means "Lobster", so try that first
  const names = name === name.toLowerCase() ? [titleCase(name), name] : [name, titleCase(name)]

  for (const family of new Set(names)) {

    const css = await loadCss(`family=${encodeURIComponent(family).replace(/%20/g, '+')}:${WEIGHTS}`)

    if (css) return css
  }

  return null
}

export function startFonts() {

  const style = createStyle()

  let applied = ''
  let timer: ReturnType<typeof setTimeout> | undefined

  const apply = (family: string, css: string) => {

    applied = family
    style.set(css)
  }

  const sync = async () => {

    const { font, googleFont } = settings.get().core
    const name = cleanName(font)
    const key = name.toLowerCase()

    if (!googleFont || !name) {

      if (applied) apply('', '')
      return

    }

    if (applied === key) return

    const cached = readCache()[key]

    if (cached?.css) {

      apply(key, cached.css)

      if (Date.now() - cached.at < MAX_AGE) return

    }

    // Fenrid's scripts carry the nonce the stylesheet needs, and they're not parsed yet at document-start
    if (document.readyState === 'loading') await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }))

    const css = await downloadFont(name)

    if (cleanName(settings.get().core.font).toLowerCase() !== key) return

    if (!css) {

      if (!cached) {

        log.warn(`"${name}" was not found on Google Fonts`)
        toast(`"${name}" isn't on Google Fonts. Check the spelling, capitals matter (e.g. "JetBrains Mono").`, 'error', 5000)

      }

      return
    }

    writeCache(key, css)
    apply(key, css)
    log.info(`Loaded "${name}" from Google Fonts and cached it`)
  }

  void sync()

  // The font field saves on every keystroke, so wait until typing stops before asking Google
  settings.subscribe(() => {

    clearTimeout(timer)
    timer = setTimeout(() => void sync(), 900)

  })
}