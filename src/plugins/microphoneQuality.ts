import { addMediaRule } from '../api/callMedia'
import { definePlugin } from '../core/plugins'

export default definePlugin({
    id: 'microphoneQuality',
    name: 'Microphone Quality',
    description: 'Picks the bitrate of your microphone in calls. Works from the next time you join a call.',
    authors: ['Better Fenrid'],
    enabledByDefault: false,
    settings: {
        bitrate: {
            type: 'select',
            label: 'Bitrate',
            description: 'Most useful for music or a good microphone. Speech rarely sounds better above 128 kbps.',
            default: '256',
            options: [128, 192, 256, 320, 510].map((kbps) => ({ label: `${kbps} kbps`, value: String(kbps) })),
        },
    },

    start(ctx) {

        ctx.onStop(addMediaRule({
            kind: 'audio',

            encodings(encodings) {

                encodings[0].maxBitrate = Number(ctx.settings.bitrate) * 1000
            },
        }))
    },
})