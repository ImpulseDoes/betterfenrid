import { definePlugin } from '../core/plugins'
import clean from '../ui/polish/clean.css'
import icons from '../ui/polish/icons.css'
import motion from '../ui/polish/motion.css'

const NO_BLUR = '[class*="backdrop-blur"] { backdrop-filter: none !important; }'

export default definePlugin({
    id: 'betterFenrid',
    name: 'Better Fenrid',
    description: 'Polishes Fenrid: animated icons, smoother motion and tidier details.',
    authors: ['Better Fenrid'],
    enabledByDefault: true,
    settings: {
        iconAnimations: {
            type: 'boolean',
            label: 'Animated icons',
            description: 'The bell rings, the settings gear turns, the microphone looks around, headphones open, and more. Follows your system\'s reduced motion setting.',
            default: true,
        },
        smootherMotion: {
            type: 'boolean',
            label: 'Smoother motion',
            description: 'Softer timing everywhere, and dialogs and menus that ease in.',
            default: true,
        },
        cleanerDetails: {
            type: 'boolean',
            label: 'Tidier details',
            description: 'Matches the corners of icon buttons, lines up the buttons next to your name, sits short channels above the message box, and uses a clearer ID icon.',
            default: true,
        },
        reduceBlur: {
            type: 'boolean',
            label: 'Turn off background blur',
            description: 'Lighter on older computers, because blur is the most expensive effect Fenrid draws. Overlays stay see-through, but look less frosted.',
            default: false,
        },
    },

    start(ctx) {

        const style = ctx.addStyle('')

        const update = () => {

            const { iconAnimations, smootherMotion, cleanerDetails, reduceBlur } = ctx.settings

            style.set([
                iconAnimations && icons,
                smootherMotion && motion,
                cleanerDetails && clean,
                reduceBlur && NO_BLUR,
            ].filter(Boolean).join('\n'))
        }

        update()
        ctx.onSettingsChange(update)
    },
})