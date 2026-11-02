import { fiberOf, findFiber, stateHooks, type StateHook } from '../core/react'

const QUALITIES = ['720p', '1080p', '1440p']
const FRAME_RATES = [15, 24, 30, 60]

export const STREAM_UNLOCKED = 'data-bf-stream-unlocked'
const PICKED = 'data-bf-stream-picked'
const UPSELL = 'data-bf-stream-upsell'

export interface StreamOptions {
    enabled: () => boolean
    // 'auto' or kbps
    bitrate: () => string
}

interface Option {
    hook: StateHook
    value: string | number
}

function optionOf(button: Element): Option | null {

    const key = fiberOf(button)?.key

    if (key == null) return null

    const modal = findFiber(button, (f) => typeof f.memoizedProps?.onConfirm === 'function' && 'userPlan' in f.memoizedProps)

    if (!modal) return null

    const hooks = stateHooks(modal)

    if (QUALITIES.includes(key)) {

        const hook = hooks.find((h) => QUALITIES.includes(h.value as string))

        return hook ? { hook, value: key } : null
    }

    const fps = Number(key)

    if (FRAME_RATES.includes(fps)) {

        const hook = hooks.find((h) => FRAME_RATES.includes(h.value as number))

        return hook ? { hook, value: fps } : null
    }

    return null
}

function constraint(value: unknown): number {

    if (typeof value === 'number') return value

    if (value && typeof value === 'object') {

        const range = value as { exact?: number; ideal?: number; max?: number }

        return Number(range.exact ?? range.ideal ?? range.max ?? 0)
    }

    return 0
}

// What Fenrid gives the plan that unlocks each choice, in kbps
function planBitrate(height: number, frameRate: number): number {

    if (height >= 1440) return 8000
    if (height >= 1080) return frameRate >= 60 ? 7000 : 5000
    if (frameRate >= 60) return 3000

    return 0
}

export function startStreamBypass(options: StreamOptions) {

    let active = true

    const unlock = (root: ParentNode) => {

        if (!options.enabled()) return

        for (const button of root.querySelectorAll<HTMLButtonElement>('button[disabled]')) {

            if (!optionOf(button)) continue

            button.disabled = false
            button.setAttribute(STREAM_UNLOCKED, '')
        }

        paint()
    }

    const relock = () => {

        document.querySelectorAll<HTMLButtonElement>(`[${STREAM_UNLOCKED}]`).forEach((button) => {

            button.disabled = true
            button.removeAttribute(STREAM_UNLOCKED)
            button.removeAttribute(PICKED)
        })

        document.querySelectorAll(`[${UPSELL}]`).forEach((el) => el.removeAttribute(UPSELL))
    }

    // Fenrid only highlights choices your plan allows, and nags about the rest
    const paint = () => {

        for (const button of document.querySelectorAll(`[${STREAM_UNLOCKED}]`)) {

            const option = optionOf(button)

            button.toggleAttribute(PICKED, !!option && option.hook.value === option.value)

            const body = button.parentElement?.parentElement?.parentElement

            for (const section of body?.children ?? []) {

                if (section.querySelector('h4')) section.setAttribute(UPSELL, '')

            }
        }
    }

    const onClick = (event: MouseEvent) => {

        const button = (event.target as Element | null)?.closest?.(`[${STREAM_UNLOCKED}]`)

        if (button && options.enabled()) {

            event.preventDefault()
            event.stopImmediatePropagation()

            const option = optionOf(button)

            option?.hook.set(option.value)
        }

        requestAnimationFrame(paint)
    }

    window.addEventListener('click', onClick, true)

    // Fenrid CAPS it by plan when it publishes, so the full size layer of a screen track is raised on its way out
    const requested = new WeakMap<MediaStreamTrack, { height: number; frameRate: number }>()

    const isScreen = (track: MediaStreamTrack) => requested.has(track) || (track.kind === 'video' && 'displaySurface' in (track.getSettings?.() ?? {}))

    const bitrateFor = (track: MediaStreamTrack): { bps: number; raiseOnly: boolean } | null => {

        if (!active || !options.enabled() || !isScreen(track)) return null

        const setting = options.bitrate()

        if (setting !== 'auto') return { bps: Number(setting) * 1000, raiseOnly: false }

        const settings = track.getSettings?.() ?? {}
        const asked = requested.get(track) ?? { height: settings.height ?? 0, frameRate: settings.frameRate ?? 0 }
        const kbps = planBitrate(asked.height, asked.frameRate)

        return kbps ? { bps: kbps * 1000, raiseOnly: true } : null
    }

    const boost = (encodings: RTCRtpEncodingParameters[], target: { bps: number; raiseOnly: boolean }) => {

        // Lower simulcast layers keep theirs
        const full = encodings.filter((e) => !e.scaleResolutionDownBy || e.scaleResolutionDownBy <= 1)

        for (const encoding of full.length ? full : encodings.slice(-1)) {

            if (!target.raiseOnly || (encoding.maxBitrate ?? 0) < target.bps) encoding.maxBitrate = target.bps

        }
    }

    const media = MediaDevices.prototype
    const peer = RTCPeerConnection.prototype
    const sender = RTCRtpSender.prototype

    const getDisplayMedia = media.getDisplayMedia
    const addTransceiver = peer.addTransceiver
    const setParameters = sender.setParameters

    const patchedGetDisplayMedia: typeof getDisplayMedia = async function (this: MediaDevices, constraints) {

        const stream = await getDisplayMedia.call(this, constraints)
        const video = typeof constraints?.video === 'object' ? constraints.video : {}

        for (const track of stream.getVideoTracks()) {

            requested.set(track, { height: constraint(video.height), frameRate: constraint(video.frameRate) })

        }

        return stream
    }

    const patchedAddTransceiver: typeof addTransceiver = function (this: RTCPeerConnection, trackOrKind, init) {

        const target = trackOrKind instanceof MediaStreamTrack ? bitrateFor(trackOrKind) : null

        if (target) {

            const encodings = init?.sendEncodings?.length ? init.sendEncodings.map((e) => ({ ...e })) : [{}]

            boost(encodings, target)
            init = { ...init, sendEncodings: encodings }
        }

        return addTransceiver.call(this, trackOrKind, init)
    }

    const patchedSetParameters: typeof setParameters = function (this: RTCRtpSender, parameters, ...rest) {

        const target = this.track ? bitrateFor(this.track) : null

        if (target && parameters?.encodings?.length) boost(parameters.encodings, target)

        return setParameters.call(this, parameters, ...rest)
    }

    // Fenrid checks this exists to decide if screen sharing is supported, mobile browsers don't have it
    if (typeof getDisplayMedia === 'function') media.getDisplayMedia = patchedGetDisplayMedia
    peer.addTransceiver = patchedAddTransceiver
    sender.setParameters = patchedSetParameters

    return {
        unlock,
        relock,
        stop() {

            active = false
            relock()
            window.removeEventListener('click', onClick, true)

            // Someone may have wrapped ours since, they keep working because ours now just passes through
            if (media.getDisplayMedia === patchedGetDisplayMedia) media.getDisplayMedia = getDisplayMedia
            if (peer.addTransceiver === patchedAddTransceiver) peer.addTransceiver = addTransceiver
            if (sender.setParameters === patchedSetParameters) sender.setParameters = setParameters
        },
    }
}