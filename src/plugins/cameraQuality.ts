import { addMediaRule, type Encodings } from '../api/callMedia'
import { definePlugin } from '../core/plugins'

interface Preset {
    label: string
    width: number
    height: number
    frameRate: number
    kbps: number
}

// Fenrid's plans
const PRESETS: Record<string, Preset> = {
    '1080p30': { label: '1080p, 30 FPS', width: 1920, height: 1080, frameRate: 30, kbps: 1500 },
    '1080p60': { label: '1080p, 60 FPS', width: 1920, height: 1080, frameRate: 60, kbps: 3000 },
    '1440p60': { label: '1440p, 60 FPS', width: 2560, height: 1440, frameRate: 60, kbps: 5000 },
}

// Lower simulcast layers are for people watching in small tiles, they keep theirs
function raiseFullLayer(encodings: Encodings, bps: number, frameRate: number) {

    const full = encodings.filter((encoding) => !encoding.scaleResolutionDownBy || encoding.scaleResolutionDownBy <= 1)

    for (const encoding of full.length ? full : encodings.slice(-1)) {

        encoding.maxBitrate = bps
        encoding.maxFramerate = frameRate
    }
}

export default definePlugin({
    id: 'cameraQuality',
    name: 'Camera Quality',
    description: 'Picks the resolution, frame rate and bitrate of your camera in calls. Works from the next time you turn your camera on.',
    authors: ['Better Fenrid'],
    enabledByDefault: false,
    settings: {
        quality: {
            type: 'select',
            label: 'Quality',
            description: 'If your camera can\'t do this, you get the closest it can.',
            default: '1080p30',
            options: Object.entries(PRESETS).map(([value, preset]) => ({ label: preset.label, value })),
        },
        bitrate: {
            type: 'select',
            label: 'Bitrate',
            description: 'Auto uses what Fenrid gives the plan with that quality. Higher looks sharper, but needs a faster upload.',
            default: 'auto',
            options: [
                { label: 'Auto', value: 'auto' },
                ...[1500, 3000, 5000, 8000].map((kbps) => ({ label: `${kbps / 1000} Mbps`, value: String(kbps) })),
            ],
        },
    },

    start(ctx) {

        const preset = () => PRESETS[ctx.settings.quality] ?? PRESETS['1080p30']

        ctx.onStop(addMediaRule({
            kind: 'video',

            capture(constraints) {

                const { width, height, frameRate } = preset()

                return { ...constraints, width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: frameRate } }
            },

            encodings(encodings) {

                const { frameRate, kbps } = preset()
                const chosen = ctx.settings.bitrate === 'auto' ? kbps : Number(ctx.settings.bitrate)

                raiseFullLayer(encodings, chosen * 1000, frameRate)
            },
        }))
    },
})