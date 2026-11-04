import { createLogger } from './logger'
import { Selectors } from './selectors'
import { settings } from './settings'

export type SynthPreset = 'click' | 'mechanical' | 'typewriter' | 'bubble' | 'pop' | 'swoosh'

export const TYPING_PRESETS: { value: string; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'click', label: 'Soft click' },
  { value: 'mechanical', label: 'Mechanical keyboard' },
  { value: 'typewriter', label: 'Typewriter' },
  { value: 'bubble', label: 'Bubble' },
  { value: 'custom', label: 'My own file' },
]

export const SEND_PRESETS: { value: string; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'pop', label: 'Pop' },
  { value: 'swoosh', label: 'Swoosh' },
  { value: 'custom', label: 'My own file' },
]

export const FENRID_SOUNDS: { id: string; label: string }[] = [
  { id: 'new-message', label: 'New message' },
  { id: 'incoming-ring', label: 'Incoming call' },
  { id: 'outgoing-ring', label: 'Outgoing call' },
  { id: 'incoming-user', label: 'Someone joins the call' },
  { id: 'user-leave', label: 'Someone leaves the call' },
  { id: 'user-moved', label: 'Moved to another channel' },
  { id: 'muted', label: 'Mute' },
  { id: 'non-muted', label: 'Unmute' },
  { id: 'deaf', label: 'Deafen' },
  { id: 'non-deaf', label: 'Undeafen' },
  { id: 'deconnected', label: 'Disconnected' },
]

export const MAX_SOUND_BYTES = 3 * 1024 * 1024

const DB_NAME = 'BetterFenrid'
const STORE = 'sounds'
const FENRID_SOUND = /\/sounds?\/([\w-]+)\.(?:mp3|ogg|wav)(?:[?#].*)?$/

const log = createLogger('Sounds')
const urls = new Map<string, string>()
const blobs = new Map<string, Blob>()
const buffers = new Map<string, AudioBuffer>()
const names = new Map<string, string>()

let ctx: AudioContext | null = null

function openDb(): Promise<IDBDatabase> {

  return new Promise((resolve, reject) => {

    const req = indexedDB.open(DB_NAME, 1)

    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {

  const db = await openDb()

  return new Promise((resolve, reject) => {

    const req = run(db.transaction(STORE, mode).objectStore(STORE))

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).finally(() => db.close()) as Promise<T>
}

interface StoredSound {
  name: string
  blob: Blob
}

function remember(id: string, sound: StoredSound) {

  const old = urls.get(id)

  if (old) URL.revokeObjectURL(old)

  urls.set(id, URL.createObjectURL(sound.blob))
  blobs.set(id, sound.blob)
  names.set(id, sound.name)
  buffers.delete(id)
}

function forget(id: string) {

  const old = urls.get(id)

  if (old) URL.revokeObjectURL(old)

  urls.delete(id)
  blobs.delete(id)
  names.delete(id)
  buffers.delete(id)
}

async function loadAll() {

  const db = await openDb()

  await new Promise<void>((resolve, reject) => {

    const req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor()

    req.onsuccess = () => {

      const cursor = req.result

      if (!cursor) return resolve()

      const value = cursor.value as StoredSound

      if (value?.blob instanceof Blob) remember(String(cursor.key), value)

      cursor.continue()
    }

    req.onerror = () => reject(req.error)
  }).finally(() => db.close())
}

export const customSoundName = (id: string) => names.get(id) ?? null

export async function saveCustomSound(id: string, file: File) {

  if (file.size > MAX_SOUND_BYTES) throw new Error('The file is over 3 MB')

  // Refuse anything the browser can't actually play
  await decode(await file.arrayBuffer())

  const sound = { name: file.name, blob: new Blob([file], { type: file.type || 'audio/mpeg' }) }

  await withStore('readwrite', (store) => store.put(sound, id))
  remember(id, sound)
}

export async function removeCustomSound(id: string) {

  await withStore('readwrite', (store) => store.delete(id))
  forget(id)
}

function audio(): AudioContext {

  ctx ??= new AudioContext()

  if (ctx.state === 'suspended') void ctx.resume()

  return ctx
}

function decode(data: ArrayBuffer): Promise<AudioBuffer> {

  return audio().decodeAudioData(data.slice(0))
}

const volume = () => Math.min(1, Math.max(0, (Number(settings.get().core.soundVolume) || 0) / 100))

async function playCustom(id: string, gain: number) {

  const blob = blobs.get(id)

  if (!blob) return

  let buffer = buffers.get(id)

  // Straight from the Blob: fetching the blob: URL would hit Fenrid's connect-src
  if (!buffer) {

    buffer = await decode(await blob.arrayBuffer())
    buffers.set(id, buffer)

  }

  const ac = audio()
  const source = ac.createBufferSource()
  const out = ac.createGain()

  source.buffer = buffer
  out.gain.value = gain
  source.connect(out).connect(ac.destination)
  source.start()
}

function noise(ac: AudioContext, seconds: number): AudioBufferSourceNode {

  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * seconds), ac.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

  const source = ac.createBufferSource()

  source.buffer = buffer

  return source
}

function envelope(ac: AudioContext, peak: number, attack: number, decay: number): GainNode {

  const gain = ac.createGain()
  const t = ac.currentTime

  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)

  return gain
}

function tone(ac: AudioContext, type: OscillatorType, from: number, to: number, peak: number, length: number, out: AudioNode) {

  const osc = ac.createOscillator()
  const t = ac.currentTime

  osc.type = type
  osc.frequency.setValueAtTime(from, t)
  osc.frequency.exponentialRampToValueAtTime(to, t + length)
  osc.connect(envelope(ac, peak, 0.002, length)).connect(out)
  osc.start(t)
  osc.stop(t + length + 0.02)
}

function burst(ac: AudioContext, frequency: number, q: number, peak: number, length: number, out: AudioNode, kind: BiquadFilterType = 'bandpass') {

  const source = noise(ac, length + 0.02)
  const filter = ac.createBiquadFilter()
  const t = ac.currentTime

  filter.type = kind
  filter.frequency.value = frequency
  filter.Q.value = q
  source.connect(filter).connect(envelope(ac, peak, 0.001, length)).connect(out)
  source.start(t)
  source.stop(t + length + 0.02)
}

export function playSynth(preset: SynthPreset, gain = volume()) {

  if (gain <= 0) return

  const ac = audio()
  const out = ac.createGain()
  // A little variation per key, so fast typing doesn't sound like a machine gun
  const vary = 0.92 + Math.random() * 0.16

  out.gain.value = gain
  out.connect(ac.destination)

  switch (preset) {

    case 'click':
      burst(ac, 3200 * vary, 1.2, 0.5, 0.025, out)
      break

    case 'mechanical':
      burst(ac, 4200 * vary, 0.9, 0.55, 0.018, out)
      tone(ac, 'triangle', 170 * vary, 90, 0.5, 0.05, out)
      break

    case 'typewriter':
      burst(ac, 2600 * vary, 2.5, 0.8, 0.03, out)
      tone(ac, 'square', 1900 * vary, 1700, 0.05, 0.04, out)
      break

    case 'bubble':
      tone(ac, 'sine', 380 * vary, 900 * vary, 0.45, 0.07, out)
      break

    case 'pop':
      tone(ac, 'sine', 520, 180, 0.7, 0.12, out)
      break

    case 'swoosh':
      burst(ac, 1800, 0.6, 0.35, 0.22, out, 'highpass')
      break
  }
}

/** Plays a slot as set up: its preset, or the uploaded file for "custom" */
export function playSlot(slot: 'typing' | 'send', choice: string, gain = volume()) {

  if (choice === 'off' || gain <= 0) return
  if (choice === 'custom') void playCustom(slot, gain).catch((err) => log.warn('Could not play the sound', err))
  else playSynth(choice as SynthPreset, gain)
}

/** Plays Fenrid's sound, or the replacement for it */
export function previewFenridSound(id: string) {

  const url = urls.get(`fenrid:${id}`) ?? `/sounds/${id}.mp3`
  const el = new NativeAudio(url)

  void el.play().catch(() => { })
}

const NativeAudio = window.Audio

// Fenrid makes a new Audio(url) for every sound it plays, so swap the URL when there's a replacement
function hookFenridSounds() {

  const swap = (src: string | undefined) => {

    const id = src && FENRID_SOUND.exec(src)?.[1]

    return (id && urls.get(`fenrid:${id}`)) || src
  }

  class Audio extends NativeAudio {

    constructor(src?: string) {

      super(swap(src))

    }
  }

  window.Audio = Audio as typeof window.Audio
}

const PRINTABLE = /^.$/u

function watchTyping() {

  let last = 0

  document.addEventListener('keydown', (event) => {

    const { typingSound, sendSound } = settings.get().core

    if (typingSound === 'off' && sendSound === 'off') return
    if (event.ctrlKey || event.metaKey || event.altKey) return

    const box = (event.target as Element | null)?.closest?.(Selectors.composer)

    if (!box) return

    if (event.key === 'Enter' && !event.shiftKey) {

      if (sendSound !== 'off' && box.textContent?.trim()) playSlot('send', sendSound)
      return

    }

    if (typingSound === 'off') return
    if (!PRINTABLE.test(event.key) && event.key !== 'Backspace' && event.key !== 'Enter') return

    // Held keys repeat very fast, keep it to one sound every 35 ms
    const now = performance.now()

    if (now - last < 35) return

    last = now
    playSlot('typing', typingSound)

  }, true)
}

export function startSounds() {

  hookFenridSounds()
  watchTyping()

  loadAll().catch((err) => log.warn('Could not load custom sounds', err))
}