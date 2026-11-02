import { insertText } from '../api/composer'
import { onApiRequestBody } from '../api/network'
import { toast } from '../api/toast'
import { definePlugin } from '../core/plugins'
import { findProps } from '../core/react'
import { Selectors } from '../core/selectors'

const SEND_PATH = /^\/api\/(chat\/server\/messages(\/\d+)?|dm\/conversations\/[^/]+\/messages(\/\d+)?)$/

// Same as Fenrid's own token: <:name:id> or <a:name:id>
const EMOJI_TOKEN = /<(a?):([A-Za-z0-9_]{2,32}):([1-9][0-9]*)>/g
const EMOJI_ID = /\/emojis\/([1-9][0-9]*)\.webp/

const HIDDEN = 'data-bf-fake-surge'
const UNLOCKED = 'data-bf-unlocked'
const IMAGE = 'bf-fake-emoji'
const HIDDEN_EMBED = 'data-bf-fake-surge-embed'

// Fenrid's inline and jumbo sizes, and the CDN sizes it loads for them
const INLINE = { display: 22, cdn: 48 }
const JUMBO = { display: 48, cdn: 128 }

interface Emoji {
    id: string
    name: string
    animated: boolean
}

function emojiUrl(emoji: Emoji, size = INLINE.cdn): string {

    return `${Selectors.cdn}/emojis/${emoji.id}.webp?size=${size}&animated=${emoji.animated}`
}

function emojiLink(emoji: Emoji, opts: { useHyperLinks: boolean; hyperLinkText: string }): string {

    const url = emojiUrl(emoji)

    return opts.useHyperLinks ? `[${opts.hyperLinkText.replaceAll('{{NAME}}', emoji.name)}](${url})` : url
}

function replaceTokens(content: string, opts: { useHyperLinks: boolean; hyperLinkText: string }): string {

    return content.replace(EMOJI_TOKEN, (match, animated, name, id, offset: number, full: string) => {

        const before = offset > 0 && !/\s/.test(full[offset - 1]) ? ' ' : ''
        const after = full[offset + match.length] && !/\s/.test(full[offset + match.length]) ? ' ' : ''

        return before + emojiLink({ id, name, animated: animated === 'a' }, opts) + after
    })
}

function pickerEmoji(button: Element): Emoji | null {

    const inner = button.querySelector('*')
    const props = inner && findProps(inner, (p) => typeof p.id === 'string' && typeof p.name === 'string' && 'animated' in p)

    if (props) return { id: props.id, name: props.name, animated: !!props.animated }

    const img = button.querySelector('img')
    const id = img?.getAttribute('src')?.match(EMOJI_ID)?.[1]

    return id ? { id, name: img!.alt.replace(/^:|:$/g, '') || 'emoji', animated: false } : null
}

function emojiIdOf(href: unknown): string | null {

    if (typeof href !== 'string') return null

    try {

        const url = new URL(href)

        return url.origin === Selectors.cdn ? url.pathname.match(/^\/emojis\/([1-9][0-9]*)\.webp$/)?.[1] ?? null : null

    } catch {

        return null

    }
}

// Fenrid tags both a message's wrapper and its row, the embeds may sit outside the row
function messageOf(el: Element): Element | null {

    let message = el.closest(Selectors.message)

    while (message?.parentElement?.closest(Selectors.message)) message = message.parentElement.closest(Selectors.message)

    return message
}

// Which emoji a "Processing GIF…" placeholder or an image preview belongs to, if any
function embedEmojiId(el: Element): string | null {

    const props = findProps(el, (p) => typeof p.url === 'string' || (p.embed && typeof p.embed === 'object'))

    if (!props) return null

    return emojiIdOf(props.url) ?? emojiIdOf(props.embed?.url) ?? emojiIdOf(props.embed?.image?.url)
}

function linkEmoji(link: HTMLAnchorElement): Emoji | null {

    const id = emojiIdOf(link.href)

    if (!id) return null

    // Only links that are just the emoji: a bare URL, or [name](url)
    const text = link.textContent?.trim() ?? ''

    if (text && text !== link.href && !text.startsWith(Selectors.cdn) && !/^:?[A-Za-z0-9_~]{1,32}:?$/.test(text)) return null

    const name = text && !text.startsWith('http') ? text.replace(/^:|:$/g, '') : 'emoji'

    return { id, name, animated: new URL(link.href).searchParams.get('animated') === 'true' }
}

export default definePlugin({
    id: 'fakeSurge',
    name: 'Fake Surge',
    description: 'Lets you pick Surge-locked emojis: they are sent as image links, and shown as emojis for you (like Vencord\'s FakeNitro).',
    authors: ['Better Fenrid community'],
    enabledByDefault: false,

    settings: {
        enableEmojiBypass: {
            type: 'boolean',
            label: 'Send locked emojis as links',
            description: 'Clicking an emoji marked "Requires Surge" in the picker puts its link in your message box.',
            default: true,
        },
        transformEmojis: {
            type: 'boolean',
            label: 'Show emoji links as emojis',
            description: 'Draws emoji links in the chat as emojis. Only you see this, unless others use the plugin too.',
            default: true,
        },
        useHyperLinks: {
            type: 'boolean',
            label: 'Use markdown links',
            description: 'Sends [name](url) instead of a bare URL. People without the plugin then see the name as well as the preview, with a bare URL Fenrid shows only the preview.',
            default: false,
        },
        hyperLinkText: {
            type: 'string',
            label: 'Link text',
            description: '{{NAME}} is replaced with the emoji name.',
            default: '{{NAME}}',
        },
        emojiSize: {
            type: 'select',
            label: 'Display size',
            description: 'Auto matches Fenrid: small in text, big when the message is only emojis.',
            default: 'auto',
            options: [
                { label: 'Auto', value: 'auto' },
                ...[16, 22, 32, 48, 64, 96, 128].map((s) => ({ label: `${s}px`, value: String(s) })),
            ],
        },
    },

    start(ctx) {

        const linkOptions = () => ({ useHyperLinks: ctx.settings.useHyperLinks, hyperLinkText: ctx.settings.hyperLinkText })

        // Fenrid turns locked tokens into :name: before sending, so this only catches tokens typed out by hand
        ctx.onStop(
            onApiRequestBody(({ url, method }, body) => {

                if (!ctx.settings.enableEmojiBypass || !SEND_PATH.test(url.pathname)) return
                if ((method !== 'POST' && method !== 'PATCH') || typeof body?.content !== 'string') return

                const next = replaceTokens(body.content, linkOptions())

                return next === body.content ? undefined : { ...body, content: next }
            }),
        )

        // Picker. Fenrid disables the locked buttons, which also stops their clicks from firing at all
        const unlockButton = (button: HTMLButtonElement) => {

            if (!button.disabled) return

            button.disabled = false
            button.setAttribute(UNLOCKED, '')
        }

        const unlock = (root: ParentNode) => {

            if (!ctx.settings.enableEmojiBypass) return

            if (root instanceof HTMLButtonElement && root.matches(Selectors.lockedEmoji)) unlockButton(root)

            root.querySelectorAll<HTMLButtonElement>(Selectors.lockedEmoji).forEach(unlockButton)
        }

        const relock = () => {

            document.querySelectorAll<HTMLButtonElement>(`[${UNLOCKED}]`).forEach((button) => {

                button.disabled = true
                button.removeAttribute(UNLOCKED)
            })
        }

        const lockedTarget = (event: Event) => {

            if (!ctx.settings.enableEmojiBypass) return null

            return (event.target as Element | null)?.closest?.<HTMLButtonElement>(Selectors.lockedEmoji) ?? null
        }

        // The picker reuses its buttons as you scroll, so one can turn locked without being added again
        const onHover = (event: Event) => {

            const button = lockedTarget(event)

            if (button) unlockButton(button)
        }

        // Keeps the caret in the message box
        const onMouseDown = (event: MouseEvent) => {

            if (lockedTarget(event)) event.preventDefault()
        }

        const onClick = (event: MouseEvent) => {

            const button = lockedTarget(event)

            if (!button) return

            // Before React sees it, so Fenrid doesn't handle the click on a locked emoji
            event.preventDefault()
            event.stopImmediatePropagation()

            const emoji = pickerEmoji(button)

            if (!emoji) return void toast('Could not read this emoji', 'error')

            if (!insertText(`${emojiLink(emoji, linkOptions())} `)) toast('Could not find the message box', 'error')
        }

        window.addEventListener('pointerover', onHover, true)
        window.addEventListener('mousedown', onMouseDown, true)
        window.addEventListener('click', onClick, true)

        ctx.onStop(() => {

            window.removeEventListener('pointerover', onHover, true)
            window.removeEventListener('mousedown', onMouseDown, true)
            window.removeEventListener('click', onClick, true)
            relock()
        })

        // Chat. Our image goes next to Fenrid's link, which is hidden, so React's own nodes stay put
        const sizeFor = (content: Element) => {

            const setting = ctx.settings.emojiSize

            if (setting !== 'auto') {

                const display = Number(setting) || INLINE.display

                return { display, cdn: display > INLINE.cdn ? JUMBO.cdn : INLINE.cdn }
            }

            const clone = content.cloneNode(true) as Element

            clone.querySelectorAll(`a[${HIDDEN}], .${IMAGE}`).forEach((el) => el.remove())

            return clone.textContent?.trim() ? INLINE : JUMBO
        }

        const render = (root: ParentNode) => {

            // Images whose link Fenrid has redrawn or removed
            for (const img of root.querySelectorAll(`.${IMAGE}`)) {

                if (!img.previousElementSibling?.hasAttribute(HIDDEN)) img.remove()

            }

            if (!ctx.settings.transformEmojis) return

            const links = [...root.querySelectorAll<HTMLAnchorElement>(Selectors.emojiLink)].filter(
                (link) => !link.hasAttribute(HIDDEN) && link.closest(Selectors.message),
            )

            for (const link of links) {

                const emoji = linkEmoji(link)

                if (!emoji) continue

                link.setAttribute(HIDDEN, '')

                const size = sizeFor(link.closest(Selectors.messageContent) ?? link.closest(Selectors.message)!)
                const img = document.createElement('img')

                img.className = IMAGE
                img.src = emojiUrl(emoji, size.cdn)
                img.alt = `:${emoji.name}:`
                img.title = `:${emoji.name}:`
                img.width = size.display
                img.height = size.display
                img.draggable = false
                img.dataset.emojiId = emoji.id

                link.after(img)
            }

            // Fenrid previews the link too, which would show the emoji twice
            for (const el of root.querySelectorAll(Selectors.mediaEmbed)) {

                const id = embedEmojiId(el)

                if (!id) continue

                // The placeholder always goes. The preview only while our emoji is there: once the preview loads,
                // Fenrid hides a bare URL, and with it our emoji
                const message = messageOf(el)
                const shown = el.matches(Selectors.pendingGif) || !!message?.querySelector(`.${IMAGE}[data-emoji-id="${id}"]`)

                el.toggleAttribute(HIDDEN_EMBED, shown)
            }
        }

        const reset = () => {

            document.querySelectorAll(`.${IMAGE}`).forEach((el) => el.remove())
            document.querySelectorAll(`[${HIDDEN}]`).forEach((el) => el.removeAttribute(HIDDEN))
            document.querySelectorAll(`[${HIDDEN_EMBED}]`).forEach((el) => el.removeAttribute(HIDDEN_EMBED))
        }

        ctx.onDomChange((added) => {

            for (const el of added) {

                if (el.classList.contains(IMAGE)) continue

                const root = messageOf(el) ?? el

                render(root)
                unlock(root)
            }
        })

        ctx.onSettingsChange(() => {

            reset()
            render(document)

            if (ctx.settings.enableEmojiBypass) unlock(document)
            else relock()
        })

        ctx.onStop(reset)

        render(document)
        unlock(document)
    },
})