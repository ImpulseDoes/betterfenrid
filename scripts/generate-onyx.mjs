import { writeFileSync } from 'node:fs'

const PAGES = ['/', '/channels/me', '/auth/login']
const OUTPUT = new URL('../src/themes/onyx.generated.css', import.meta.url)

const COLOR_PROPS = [
  'background-color',
  'color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  '--tw-gradient-from',
  '--tw-gradient-via',
  '--tw-gradient-to',
  '--tw-ring-color',
  '--tw-ring-offset-color',
]

const INTERACTIVE = /:hover|:focus|:active|\[data-highlighted\]|\[data-state|\[aria-selected/
const BRAND_BLUES = new Set(['3149c4', '3b50cc', '3246be', '443ee9'])

function measure(hex) {

  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))

  return {
    lum: 0.2126 * r + 0.7152 * g + 0.0722 * b,
    sat: Math.max(r, g, b) - Math.min(r, g, b),
  }
}

function surfaceFor(lum, interactive) {

  const levels = ['--onyx-base', '--onyx-raised', '--onyx-raised-2', '--onyx-raised-3']
  const level = lum <= 14 ? 0 : lum <= 30 ? 1 : lum <= 44 ? 2 : 3

  // Something that lights up on hover has to end up lighter than what it sits on
  return levels[Math.min(level + (interactive ? 1 : 0), levels.length - 1)]
}

function replacement(prop, hex, interactive) {

  const { lum, sat } = measure(hex)

  if (prop === 'color') {

    if (sat > 30 || lum < 125 || lum > 235) return null

    return lum >= 195 ? '--text-primary' : lum >= 150 ? '--text-secondary' : '--text-muted'
  }

  if (BRAND_BLUES.has(hex)) return prop === 'background-color' ? '--primary-action' : null

  // Below that it's black, which Fenrid uses for overlays and shadows
  if (sat > 40 || lum > 80 || lum < 4) return null

  if (prop.startsWith('border') || prop.startsWith('outline') || prop === '--tw-ring-color') {

    return lum < 50 ? '--onyx-line' : '--onyx-line-strong'
  }

  return surfaceFor(lum, interactive)
}

function withAlpha(variable, alpha) {

  const value = `var(${variable})`

  return alpha == null ? value : `color-mix(in srgb, ${value} ${alpha}%, transparent)`
}

async function fetchStylesheets() {

  const urls = new Set()

  for (const page of PAGES) {

    const html = await (await fetch(`https://fenrid.com${page}`, { headers: { 'user-agent': 'Mozilla/5.0' } })).text()

    for (const [path] of html.matchAll(/\/_next\/static\/[^"\\ ]+\.css/g)) urls.add(path)
  }

  const sheets = await Promise.all([...urls].map(async (path) => (await fetch(`https://fenrid.com${path}`)).text()))

  return sheets.join('\n')
}

function generate(css) {

  const rules = new Map()

  for (const [, selector, declarations] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {

    // Utility classes are the ones with escapes in their names: .bg-\[\#111\], .hover\:bg-gray-800
    if (!selector.includes('\\')) continue

    const interactive = INTERACTIVE.test(selector)

    for (const declaration of declarations.split(';')) {

      const colon = declaration.indexOf(':')
      const prop = declaration.slice(0, colon).trim()
      const color = declaration.slice(colon + 1).match(/#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?\b/)

      if (!color || !COLOR_PROPS.includes(prop)) continue

      const variable = replacement(prop, color[1].toLowerCase(), interactive)

      if (!variable) continue

      const alpha = color[2] ? Math.round((parseInt(color[2], 16) / 255) * 100) : null
      const important = declaration.includes('!important') ? '!important' : ''

      rules.set(`${selector.trim()}|${prop}`, { selector: selector.trim(), prop, value: withAlpha(variable, alpha) + important })
    }
  }

  return [...rules.values()].map(({ selector, prop, value }) => `${selector}{${prop}:${value}}`).join('\n')
}

const css = generate(await fetchStylesheets())

writeFileSync(OUTPUT, `${css}\n`)

console.log(`${css.split('\n').length} rules written to src/themes/onyx.generated.css`)