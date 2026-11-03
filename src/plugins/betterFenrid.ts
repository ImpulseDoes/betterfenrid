import { definePlugin, type SelectSetting } from '../core/plugins'
import { ANIMATION_OPTIONS, animationCss, startAnimations, type AnimationStyle } from '../ui/polish/animations'
import clean from '../ui/polish/clean.css'
import icons from '../ui/polish/icons.css'
import motion from '../ui/polish/motion.css'

const animation = (label: string, description: string, value: AnimationStyle): SelectSetting => ({
    type: 'select',
    label,
    description,
    default: value,
    options: ANIMATION_OPTIONS,
})

const NO_BLUR = '[class*="backdrop-blur"] { backdrop-filter: none !important; }'

export default definePlugin({
    id: 'betterFenrid',
    name: 'Better Fenrid',
    description: 'Polishes Fenrid: animated icons, Discord-style animations for menus, dialogs, channels and messages, smoother motion and tidier details.',
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
        animMenus: animation('Menu animation', 'Right click and dropdown menus.', 'zoom'),
        animTooltips: animation('Tooltip animation', 'The labels you get when you hover a button or a server.', 'zoom'),
        animPopouts: animation('Popout animation', 'Profiles and the emoji picker.', 'slide'),
        animModals: animation('Dialog animation', 'Windows in the middle of the screen. Their dark background fades.', 'zoom'),
        animSettings: animation('Settings animation', 'Opening and closing settings.', 'zoom'),
        animChannels: animation('Channel switch animation', 'The chat slides in from the side of the channel list you moved to.', 'slide'),
        animServers: animation('Server switch animation', 'The channels and chat slide in from the side of the server list you moved to.', 'slide'),
        animMessages: animation('New message animation', 'New messages ease in at the bottom.', 'slide'),
        animDuration: {
            type: 'number',
            label: 'Animation length',
            description: 'In percent. 100 is the normal length, higher is slower, lower is snappier.',
            default: 100,
            min: 50,
            max: 200,
            step: 10,
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
                animationCss(ctx.settings),
            ].filter(Boolean).join('\n'))
        }

        update()
        ctx.onSettingsChange(update)
        ctx.onStop(startAnimations(() => ctx.settings))
    },
})