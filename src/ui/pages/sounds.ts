import { toast } from '../../api/toast'
import { h } from '../../core/dom'
import { settings } from '../../core/settings'
import {
  FENRID_SOUNDS,
  SEND_PRESETS,
  TYPING_PRESETS,
  customSoundName,
  playSlot,
  previewFenridSound,
  removeCustomSound,
  saveCustomSound,
} from '../../core/sounds'
import { Button, Row, Section, SettingControl } from '../components'

const buttons = (...children: Node[]) => h('div', { class: 'bf-sound-buttons' }, ...children)

export function SoundsSection(refresh: () => void): Node {

  const s = settings.get().core

  let target = ''

  const picker = h('input', {
    type: 'file',
    accept: 'audio/*,.mp3,.ogg,.wav,.m4a,.webm',
    hidden: true,
    onChange: async () => {

      const file = picker.files?.[0]

      picker.value = ''

      if (!file || !target) return

      try {

        await saveCustomSound(target, file)
        toast(`Using ${file.name}`, 'success')
        refresh()

      } catch (err) {

        toast(`Couldn't use that file: ${(err as Error).message || 'it doesn\'t look like audio'}`, 'error', 4000)

      }
    },
  })

  const upload = (id: string, label = 'Upload') => Button(label, () => {

    target = id
    picker.click()

  }, 'secondary')

  const remove = (id: string) => Button('Reset', async () => {

    await removeCustomSound(id)
    refresh()

  }, 'secondary')

  // "custom" needs a file, so show where to give it one
  const fileRow = (slot: 'typing' | 'send') => {

    const name = customSoundName(slot)

    return Row(
      'Your file',
      name ? `Playing ${name}` : 'Pick a short sound, up to 3 MB. It stays in this browser.',
      buttons(upload(slot, name ? 'Replace' : 'Upload'), ...(name ? [remove(slot)] : [])),
    )
  }

  const choice = (slot: 'typing' | 'send', label: string, description: string, options: { value: string; label: string }[], value: string) => [
    SettingControl(
      { type: 'select', label, description, default: 'off', options },
      value,
      (next) => {

        settings.update((x) => {

          if (slot === 'typing') x.core.typingSound = String(next)
          else x.core.sendSound = String(next)

        })

        playSlot(slot, String(next))
        refresh()

      },
    ),
    value === 'custom' ? fileRow(slot) : null,
  ]

  return Section(
    'Sounds',
    'Sounds while you type and send, and your own files in place of Fenrid\'s sounds.',
    SettingControl(
      { type: 'number', label: 'Volume', description: 'For the typing and sending sounds, in percent.', default: 60, min: 0, max: 100, step: 5 },
      s.soundVolume,
      (next) => settings.update((x) => { x.core.soundVolume = Number(next) }),
    ),
    ...choice('typing', 'Typing sound', 'Plays on each key in the message box.', TYPING_PRESETS, s.typingSound),
    ...choice('send', 'Send sound', 'Plays when you send a message.', SEND_PRESETS, s.sendSound),
    h('div', { class: 'bf-row-label bf-sound-heading' }, 'Fenrid\'s sounds'),
    ...FENRID_SOUNDS.map(({ id, label }) => {

      const slot = `fenrid:${id}`
      const name = customSoundName(slot)

      return Row(
        label,
        name ? `Replaced with ${name}` : 'Fenrid\'s own sound',
        buttons(
          Button('Play', () => previewFenridSound(id), 'secondary'),
          upload(slot, name ? 'Replace' : 'Upload'),
          ...(name ? [remove(slot)] : []),
        ),
      )
    }),
    picker,
  )
}