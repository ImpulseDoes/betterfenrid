export type AnimationStyle = 'off' | 'fade' | 'zoom' | 'slide' | 'pop' | 'blur' | 'tilt'

export const ANIMATION_OPTIONS: { label: string; value: AnimationStyle }[] = [
    { label: 'Off', value: 'off' },
    { label: 'Fade', value: 'fade' },
    { label: 'Zoom', value: 'zoom' },
    { label: 'Slide', value: 'slide' },
    { label: 'Pop', value: 'pop' },
    { label: 'Blur', value: 'blur' },
    { label: 'Tilt', value: 'tilt' },
]

export interface AnimationSettings {
    animTooltips: string
    animMenus: string
    animPopouts: string
    animModals: string
    animSettings: string
    animChannels: string
    animServers: string
    animMessages: string
    animDuration: number
}

type Style = Exclude<AnimationStyle, 'off'>
type Frame = Record<string, string | number>

const STYLES: Style[] = ['fade', 'zoom', 'slide', 'pop', 'blur', 'tilt']

const HIDDEN: Record<Style, (x: string, y: string) => Frame> = {
    fade: () => ({ opacity: 0 }),
    zoom: () => ({ opacity: 0, transform: 'scale(0.94)' }),
    slide: (x, y) => ({ opacity: 0, transform: `translate(${x}, ${y})` }),
    pop: () => ({ opacity: 0, transform: 'scale(0.82)' }),
    blur: () => ({ opacity: 0, filter: 'blur(6px)', transform: 'scale(1.02)' }),
    tilt: (x, y) => ({ opacity: 0, transform: `perspective(900px) rotateX(-12deg) translate(${x}, ${y})` }),
}

const EASE_IN = 'cubic-bezier(0.16, 1, 0.3, 1)'
const EASE_POP = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const EASE_OUT = 'cubic-bezier(0.4, 0, 1, 1)'
const EXIT_SHARE = 0.65
const SWITCH_OFFSET = 14
const MESSAGE_OFFSET = 8
const SWITCH_WINDOW = 900

const enterEase = (style: Style) => style === 'pop' ? EASE_POP : EASE_IN
const cssFrame = (frame: Frame) => Object.entries(frame).map(([k, v]) => `${k}: ${v};`).join(' ')

const KEYFRAMES = STYLES.map((style) => {

    const hidden = cssFrame(HIDDEN[style]('var(--bf-x, 0px)', 'var(--bf-y, 6px)'))

    return `@keyframes bf-anim-${style}-in { from { ${hidden} } }\n@keyframes bf-anim-${style}-out { to { ${hidden} } }`

}).join('\n')

// Radix says which side of the button a menu or tooltip opened on, so it comes out of the button
const SIDES = `
[data-side="top"] { --bf-x: 0px; --bf-y: 6px; }
[data-side="bottom"] { --bf-x: 0px; --bf-y: -6px; }
[data-side="left"] { --bf-x: 6px; --bf-y: 0px; }
[data-side="right"] { --bf-x: -6px; --bf-y: 0px; }
[data-bf-ghost], [data-bf-ghost] * { animation: none !important; transition: none !important; pointer-events: none !important; }`

interface Part {
    select: string
    fade?: boolean
}

interface FloatingModule {
    setting: keyof AnimationSettings
    duration: number
    // Elements that animate when they appear. html makes these win over Better Fenrid's own motion
    open: string[]
    // Radix elements that are closing, which Radix keeps until the animation ends
    closing?: string[]
    ghost?: { root: string; parts: Part[] }
    fade?: string[]
    fadeClosing?: string[]
}

const FLOATING: FloatingModule[] = [
    {
        setting: 'animTooltips',
        duration: 140,
        open: ['.group\\/tooltip[data-state$="open"]'],
        closing: ['.group\\/tooltip[data-state="closed"]'],
    },
    {
        setting: 'animMenus',
        duration: 170,
        open: [
            '[data-radix-menu-content][data-state="open"]',
            'body > [role="menu"].fixed:not([data-bf-ghost])',
            '.z-\\[999\\].animate-in.zoom-in-95',
        ],
        closing: ['[data-radix-menu-content][data-state="closed"]'],
        ghost: { root: '[role="menu"].fixed', parts: [{ select: ':scope' }] },
    },
    {
        setting: 'animPopouts',
        duration: 210,
        open: [
            'body > [data-animated-media-hover-root][role="dialog"]:not([data-bf-ghost])',
            'body > .fixed.z-\\[90\\]:not([data-bf-ghost])',
            'body > .fixed.z-\\[1000\\]:not([data-bf-ghost])',
        ],
        ghost: {
            root: '[data-animated-media-hover-root][role="dialog"], .fixed.z-\\[90\\], .fixed.z-\\[1000\\]',
            parts: [{ select: ':scope' }],
        },
    },
    {
        setting: 'animModals',
        duration: 240,
        open: [
            '.fenrid-safe-modal-frame > [role="dialog"]',
            '.fenrid-safe-modal-frame > .relative',
            '[role="dialog"][data-state="open"]:not(.inset-x-0)',
        ],
        closing: ['[role="dialog"][data-state="closed"]:not(.inset-x-0)'],
        fade: ['.fenrid-safe-modal-frame:not([data-bf-ghost])', '.fixed.inset-0[data-state="open"]:not([role])'],
        fadeClosing: ['.fixed.inset-0[data-state="closed"]:not([role])'],
        ghost: {
            root: '.fenrid-safe-modal-frame',
            parts: [{ select: ':scope', fade: true }, { select: ':scope > [role="dialog"], :scope > .relative' }],
        },
    },
    {
        setting: 'animSettings',
        duration: 280,
        open: ['.fenrid-settings-root'],
        fade: ['.fenrid-settings-layer:not([data-bf-ghost])'],
        ghost: {
            root: '.fenrid-settings-layer',
            parts: [{ select: ':scope', fade: true }, { select: '.fenrid-settings-root' }],
        },
    },
]

const CHANNEL_LIST = '.lg\\:w-\\[270px\\], .w-\\[270px\\]'
const CONTENT = 'main.bg-main-chat-area, main.bg-chat-background, main[class*="--main-chat-area"]'
const SCROLLER = '[class*="overflow-anchor:none"][class*="overflow-y-auto"]'
const MESSAGE = '[data-message-id], [class~="lg:[contain:style]"]'
const RAIL_WIDTH = 72

const style = (value: string): Style | null => (STYLES as string[]).includes(value) ? value as Style : null

export function animationCss(s: AnimationSettings): string {

    const scale = Math.min(200, Math.max(50, s.animDuration || 100)) / 100
    const rules: string[] = []

    for (const module of FLOATING) {

        const chosen = style(s[module.setting] as string)

        if (!chosen) continue

        const enter = Math.round(module.duration * scale)
        const exit = Math.round(enter * EXIT_SHARE)
        const is = (list: string[]) => `html :is(${list.join(', ')})`

        rules.push(`${is(module.open)} { animation: bf-anim-${chosen}-in ${enter}ms ${enterEase(chosen)} backwards; }`)

        if (module.closing) rules.push(`${is(module.closing)} { animation: bf-anim-${chosen}-out ${exit}ms ${EASE_OUT} forwards; }`)
        if (module.fade) rules.push(`${is(module.fade)} { animation: bf-anim-fade-in ${enter}ms ${EASE_IN} backwards; }`)
        if (module.fadeClosing) rules.push(`${is(module.fadeClosing)} { animation: bf-anim-fade-out ${exit}ms ${EASE_OUT} forwards; }`)
    }

    return `@media (prefers-reduced-motion: no-preference) {\n${KEYFRAMES}\n${SIDES}\n[data-radix-menu-content] { transform-origin: var(--radix-popper-transform-origin); }\nbody > [role="menu"].fixed { transform-origin: top left; }\n${rules.join('\n')}\n}`
}

export function startAnimations(read: () => AnimationSettings): () => void {

    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const scale = () => Math.min(200, Math.max(50, read().animDuration || 100)) / 100
    const chosen = (setting: keyof AnimationSettings) => reduced.matches ? null : style(read()[setting] as string)

    const ghosts = new Set<Element>()
    const scrolled = new WeakMap<Element, number>()

    // A removed element forgets how far it was scrolled, so remember it beforehand
    const onScroll = (event: Event) => {

        if (event.target instanceof Element) scrolled.set(event.target, event.target.scrollTop)
    }

    const animate = (el: Element, frame: Frame, duration: number, easing: string, entering: boolean) =>
        el.animate([entering ? { ...frame, offset: 0 } : { ...frame, offset: 1 }], { duration, easing, fill: entering ? 'backwards' : 'forwards' })

    const leaveBehind = (node: Element, module: FloatingModule, chosenStyle: Style) => {

        const copy = node.cloneNode(true) as HTMLElement

        copy.setAttribute('data-bf-ghost', '')
        copy.setAttribute('aria-hidden', 'true')
        copy.inert = true
        document.body.append(copy)
        ghosts.add(copy)

        const from = [node, ...node.querySelectorAll('*')]
        const to = [copy, ...copy.querySelectorAll('*')]

        from.forEach((el, i) => {

            const top = scrolled.get(el)

            if (top) to[i].scrollTop = top
        })

        const duration = Math.round(module.duration * scale() * EXIT_SHARE)
        const done = () => {

            copy.remove()
            ghosts.delete(copy)
        }

        const runs = module.ghost!.parts.flatMap((part) => {

            const targets = part.select === ':scope' ? [copy] : [...copy.querySelectorAll(part.select)]

            return targets.map((el) => animate(el, HIDDEN[part.fade ? 'fade' : chosenStyle]('0px', '6px'), duration, EASE_OUT, false))
        })

        Promise.all(runs.map((run) => run.finished)).then(done, done)
        setTimeout(done, duration + 200)
    }

    // Channels and servers come in from the side of the list you moved towards
    let lastPath = location.pathname
    let lastTop = { rail: NaN, list: NaN }
    let switching: { until: number; frame: Frame; duration: number; easing: string; server: boolean } | null = null
    const switched = new WeakSet<Element>()

    const activeTops = () => {

        const tops = { rail: NaN, list: NaN }

        for (const link of document.querySelectorAll('a[aria-current="page"]')) {

            const box = link.getBoundingClientRect()

            if (!box.height) continue

            if (box.left < RAIL_WIDTH) tops.rail = box.top
            else if (link.closest(CHANNEL_LIST)) tops.list = box.top
        }

        return tops
    }

    const playSwitch = (el: Element) => {

        if (!switching || switched.has(el)) return

        switched.add(el)
        animate(el, switching.frame, switching.duration, switching.easing, true)
    }

    const onNavigate = (from: string, to: string) => {

        const [, a, fromServer, fromChannel] = from.split('/')
        const [, b, toServer, toChannel] = to.split('/')
        const server = a !== b || fromServer !== toServer
        const tops = activeTops()
        const before = server ? lastTop.rail : lastTop.list
        const after = server ? tops.rail : tops.list

        lastTop = tops

        // A server link without a channel is sent on to one, which isn't a second switch
        if (!server && (fromChannel === toChannel || !fromChannel)) return

        const chosenStyle = chosen(server ? 'animServers' : 'animChannels')

        if (!chosenStyle) return

        const down = !(after < before)
        const offset = `${down ? SWITCH_OFFSET : -SWITCH_OFFSET}px`
        const duration = Math.round((server ? 300 : 260) * scale())

        switching = {
            until: performance.now() + SWITCH_WINDOW,
            frame: HIDDEN[chosenStyle]('0px', offset),
            duration,
            easing: enterEase(chosenStyle),
            server,
        }

        for (const el of document.querySelectorAll(server ? `${CONTENT}, ${CHANNEL_LIST}` : CONTENT)) {

            switched.delete(el)
            playSwitch(el)
        }
    }

    const isMessage = (n: Node): n is Element => n instanceof Element && n.matches(MESSAGE)

    const onMessages = (record: MutationRecord) => {

        const list = record.target as Element

        if (!list.matches(SCROLLER) || record.addedNodes.length > 3) return
        // A message that swaps its temporary id for the real one is replaced, not new
        if ([...record.removedNodes].some(isMessage)) return

        const chosenStyle = chosen('animMessages')

        if (!chosenStyle) return

        for (const n of record.addedNodes) {

            if (!isMessage(n) || !n.isConnected) continue
            // Older messages loaded above aren't new
            if (n.nextElementSibling && isMessage(n.nextElementSibling)) continue

            animate(n, HIDDEN[chosenStyle]('0px', `${MESSAGE_OFFSET}px`), Math.round(220 * scale()), enterEase(chosenStyle), true)
        }
    }

    const observer = new MutationObserver((records) => {

        // Runs after React's commit and before the browser paints, so nothing flashes
        if (location.pathname !== lastPath) {

            const from = lastPath

            lastPath = location.pathname
            onNavigate(from, lastPath)
        }

        if (switching && performance.now() > switching.until) switching = null

        for (const record of records) {

            if (record.target === document.body) {

                for (const n of record.removedNodes) {

                    if (!(n instanceof Element) || n.hasAttribute('data-bf-ghost')) continue

                    const module = FLOATING.find((m) => m.ghost && n.matches(m.ghost.root))
                    const chosenStyle = module && chosen(module.setting)

                    if (module && chosenStyle) leaveBehind(n, module, chosenStyle)
                }
            }

            if (!record.addedNodes.length) continue

            if (!switching) {

                onMessages(record)
                continue
            }

            // The real page often replaces a loading skeleton a moment later, so it gets the same entrance
            const targets = switching.server ? `${CONTENT}, ${CHANNEL_LIST}` : CONTENT

            for (const n of record.addedNodes) if (n instanceof Element && n.matches(targets)) playSwitch(n)
        }
    })

    const begin = () => {

        lastTop = activeTops()
        observer.observe(document.body, { childList: true, subtree: true })
    }

    document.addEventListener('scroll', onScroll, { capture: true, passive: true })

    if (document.body) begin()
    else document.addEventListener('DOMContentLoaded', begin, { once: true })

    return () => {

        observer.disconnect()
        document.removeEventListener('DOMContentLoaded', begin)
        document.removeEventListener('scroll', onScroll, { capture: true })

        for (const ghost of ghosts) ghost.remove()
        ghosts.clear()
    }
}