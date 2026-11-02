export type Encodings = RTCRtpEncodingParameters[]

export interface MediaRule {
    kind: 'audio' | 'video'
    capture?: (constraints: MediaTrackConstraints) => MediaTrackConstraints
    encodings?: (encodings: Encodings) => void
}

const rules = new Set<MediaRule>()
const screenTracks = new WeakSet<MediaStreamTrack>()

let installed = false

const isScreen = (track: MediaStreamTrack) => screenTracks.has(track) || 'displaySurface' in (track.getSettings?.() ?? {})

function applyEncodings(track: MediaStreamTrack, encodings: Encodings) {

    if (isScreen(track)) return

    for (const rule of rules) {

        if (rule.kind === track.kind) rule.encodings?.(encodings)

    }
}

function install() {

    if (installed) return

    installed = true

    const media = MediaDevices.prototype
    const peer = RTCPeerConnection.prototype
    const sender = RTCRtpSender.prototype

    const getUserMedia = media.getUserMedia
    const getDisplayMedia = media.getDisplayMedia
    const addTransceiver = peer.addTransceiver
    const setParameters = sender.setParameters

    media.getUserMedia = function (this: MediaDevices, constraints) {

        let patched = constraints

        for (const rule of rules) {

            const wanted = patched?.[rule.kind]

            if (wanted && rule.capture) patched = { ...patched, [rule.kind]: rule.capture(typeof wanted === 'object' ? wanted : {}) }

        }

        return getUserMedia.call(this, patched)
    }

    // Fenrid checks this exists to decide if screen sharing is supported, mobile browsers don't have it
    if (typeof getDisplayMedia === 'function') {

        media.getDisplayMedia = async function (this: MediaDevices, constraints) {

            const stream = await getDisplayMedia.call(this, constraints)

            stream.getTracks().forEach((track) => screenTracks.add(track))

            return stream
        }
    }

    peer.addTransceiver = function (this: RTCPeerConnection, trackOrKind, init) {

        if (rules.size && trackOrKind instanceof MediaStreamTrack) {

            // Edited in place: on Firefox LiveKit reads the audio bitrate back from this array to write it into the SDP
            const encodings = init?.sendEncodings?.length ? init.sendEncodings : [{}]

            applyEncodings(trackOrKind, encodings)
            init = { ...init, sendEncodings: encodings }
        }

        return addTransceiver.call(this, trackOrKind, init)
    }

    sender.setParameters = function (this: RTCRtpSender, parameters, ...rest) {

        if (this.track && parameters?.encodings?.length) applyEncodings(this.track, parameters.encodings)

        return setParameters.call(this, parameters, ...rest)
    }
}

// The patches stay in place after the last rule goes: with no rules they only pass calls through, and undoing them
// could drop whatever another script wrapped on top
export function addMediaRule(rule: MediaRule): () => void {

    install()
    rules.add(rule)

    return () => rules.delete(rule)
}