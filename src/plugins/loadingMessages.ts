import { definePlugin } from '../core/plugins'

const LINE = 'main[aria-busy="true"] [role="status"] p.italic'
const AUTHOR = `${LINE} + p`
const FENRID_LINES = 25
const cssString = (text: string) => `"${text.replace(/[\\"]/g, '\\$&').replace(/\s+/g, ' ')}"`
const parseLines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean)

function buildCss(line: string, author: string): string {

  return `
    ${LINE}, ${AUTHOR} { font-size: 0; line-height: 0; }
    ${LINE}::after { display: block; content: ${cssString(line)}; font-size: 0.875rem; line-height: 1.5rem; }
    ${AUTHOR}::after { display: block; content: ${cssString(author)}; font-size: 11px; line-height: 1.5; letter-spacing: 0.18em; }
    @media (min-width: 40rem) { ${LINE}::after { font-size: 1rem; } }
    ${author ? '' : `${AUTHOR} { display: none; }`}
  `
}

export default definePlugin({
  id: 'loadingMessages',
  name: 'Loading Messages',
  description: 'Replaces the messages on Fenrid\'s loading screen with your own.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    messages: {
      type: 'string',
      label: 'Messages',
      description: 'One per line, a random one shows each time. Leave empty for Fenrid\'s.',
      default: 'Also try Fencord!\nStealing your biscuts...\nBreaking Discord for you...\nInstalling Discord...',
      multiline: true,
    },
    author: {
      type: 'string',
      label: 'Signature',
      description: 'The small text under the message. Leave empty to hide it.',
      default: 'Better Fenrid',
    },
    keepFenridMessages: {
      type: 'boolean',
      label: 'Keep Fenrid\'s messages too',
      description: 'Mixes yours in with Fenrid\'s own.',
      default: false,
    },
  },

  start(ctx) {

    const style = ctx.addStyle('')

    const update = () => {

      const lines = parseLines(ctx.settings.messages)
      const pool = lines.length + (ctx.settings.keepFenridMessages ? FENRID_LINES : 0)
      const line = lines[Math.floor(Math.random() * pool)]

      style.set(line ? buildCss(line, ctx.settings.author.trim()) : '')
    }

    update()
    ctx.onSettingsChange(update)
  },
})