import { h } from '../core/dom'
import { definePlugin } from '../core/plugins'
import css from '../ui/polish/sidebar.css'

const VARIABLE = '--bf-sidebar-width'
const RESIZING = 'bf-sidebar-resizing'
const RAIL_WIDTH = 72
const DEFAULT_WIDTH = 270
const MIN_WIDTH = 220
const MAX_WIDTH = 480
const KEY_STEP = 10

const clamp = (width: number) => Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width)))

export default definePlugin({
    id: 'resizableSidebar',
    name: 'Resizable Channel List',
    description: 'Drag the edge of the channel list to make it wider or narrower, like on Discord. Double click the edge to reset it.',
    authors: ['Better Fenrid'],
    enabledByDefault: true,
    settings: {
        width: {
            type: 'number',
            label: 'Width',
            description: `In pixels, from ${MIN_WIDTH} to ${MAX_WIDTH}. Fenrid's own is ${DEFAULT_WIDTH}.`,
            default: DEFAULT_WIDTH,
            min: MIN_WIDTH,
            max: MAX_WIDTH,
        },
    },

    start(ctx) {

        const root = document.documentElement

        const show = (width: number) => {

            root.style.setProperty(VARIABLE, `${width}px`)
            handle.setAttribute('aria-valuenow', String(width))
        }

        const save = (width: number) => {

            show(width)
            ctx.setSetting('width', width)
        }

        const handle = h('div', {
            class: 'bf-sidebar-resizer',
            role: 'separator',
            tabindex: 0,
            'aria-label': 'Resize channel list',
            'aria-orientation': 'vertical',
            'aria-valuemin': MIN_WIDTH,
            'aria-valuemax': MAX_WIDTH,

            onPointerDown(event: PointerEvent) {

                if (event.button !== 0) return

                event.preventDefault()
                handle.setPointerCapture(event.pointerId)
                root.classList.add(RESIZING)
            },

            onPointerMove(event: PointerEvent) {

                if (handle.hasPointerCapture(event.pointerId)) show(clamp(event.clientX - RAIL_WIDTH))
            },

            onPointerUp(event: PointerEvent) {

                if (!handle.hasPointerCapture(event.pointerId)) return

                handle.releasePointerCapture(event.pointerId)
                root.classList.remove(RESIZING)
                save(clamp(event.clientX - RAIL_WIDTH))
            },

            onDblClick: () => save(DEFAULT_WIDTH),

            onKeyDown(event: KeyboardEvent) {

                const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key]

                if (!direction) return

                event.preventDefault()
                save(clamp(ctx.settings.width + direction * KEY_STEP))
            },
        })

        const mount = () => {

            if (document.body && !handle.isConnected) document.body.append(handle)
        }

        ctx.addStyle(css)
        show(clamp(ctx.settings.width))
        mount()

        ctx.onDomChange(mount)
        ctx.onSettingsChange(() => show(clamp(ctx.settings.width)))

        ctx.onStop(() => {

            handle.remove()
            root.classList.remove(RESIZING)
            root.style.removeProperty(VARIABLE)
        })
    },
})