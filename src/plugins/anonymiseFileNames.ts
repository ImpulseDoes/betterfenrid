import { definePlugin } from '../core/plugins'

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

const ours = new WeakSet<Event>()

function randomName(length: number): string {

  const bytes = crypto.getRandomValues(new Uint8Array(length))

  return Array.from(bytes, (byte) => CHARS[byte % CHARS.length]).join('')
}

function timestamp(date = new Date()): string {

  const pad = (n: number) => String(n).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

function extensionOf(name: string): string {

  return name.match(/(\.tar)?\.[a-z0-9]{1,10}$/i)?.[0].toLowerCase() ?? ''
}

function clean(name: string): string {

  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 100)
}

export default definePlugin({
  id: 'anonymiseFileNames',
  name: 'Anonymise File Names',
  description: 'Gives files you upload a new name, so names like IMG_20261107_passwords.png don\'t give anything away. The extension stays. Works for files you pick, paste or drag in.',
  authors: ['Better Fenrid'],
  enabledByDefault: false,
  settings: {
    method: {
      type: 'select',
      label: 'New name',
      default: 'random',
      options: [
        { label: 'Random letters and numbers', value: 'random' },
        { label: 'Date and time of the upload', value: 'timestamp' },
        { label: 'Always the same name', value: 'fixed' },
      ],
    },
    length: {
      type: 'number',
      label: 'Random name length',
      description: 'Used with random names.',
      default: 8,
      min: 4,
      max: 32,
      step: 1,
    },
    fixedName: {
      type: 'string',
      label: 'Name',
      description: 'Used with "Always the same name". Several files at once get -2, -3 and so on.',
      default: 'file',
    },
  },

  start(ctx) {

    const rename = (files: File[]): File[] => {

      const used = new Set<string>()
      const base = ctx.settings.method === 'timestamp' ? timestamp() : clean(ctx.settings.fixedName) || 'file'

      return files.map((file) => {

        const extension = extensionOf(file.name)
        let name = ctx.settings.method === 'random' ? randomName(ctx.settings.length) : base

        for (let n = 2; used.has(name); n++) name = ctx.settings.method === 'random' ? randomName(ctx.settings.length) : `${base}-${n}`

        used.add(name)

        return new File([file], name + extension, { type: file.type, lastModified: file.lastModified })
      })
    }

    const transferWith = (from: DataTransfer): DataTransfer => {

      const copy = new DataTransfer()

      for (const type of from.types) {

        if (type === 'Files') continue

        try {

          copy.setData(type, from.getData(type))

        } catch { }
      }

      for (const file of rename(Array.from(from.files))) copy.items.add(file)

      return copy
    }

    // Picking files: swap the input's files before Fenrid reads them
    const onChange = (event: Event) => {

      const input = event.target

      if (!(input instanceof HTMLInputElement) || input.type !== 'file' || !input.files?.length) return

      const copy = new DataTransfer()

      for (const file of rename(Array.from(input.files))) copy.items.add(file)

      input.files = copy.files
    }

    // Pasted and dropped files can't be swapped in place, so the event is sent again with renamed copies
    const onPaste = (event: ClipboardEvent) => {

      if (ours.has(event) || !event.clipboardData?.files.length || !event.target) return

      event.preventDefault()
      event.stopImmediatePropagation()

      const copy = new ClipboardEvent('paste', { clipboardData: transferWith(event.clipboardData), bubbles: true, cancelable: true, composed: true })

      ours.add(copy)
      event.target.dispatchEvent(copy)
    }

    const onDrop = (event: DragEvent) => {

      if (ours.has(event) || !event.dataTransfer?.files.length || !event.target) return

      event.preventDefault()
      event.stopImmediatePropagation()

      const copy = new DragEvent('drop', {
        dataTransfer: transferWith(event.dataTransfer),
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      })

      ours.add(copy)
      event.target.dispatchEvent(copy)
    }

    window.addEventListener('change', onChange, true)
    window.addEventListener('paste', onPaste, true)
    window.addEventListener('drop', onDrop, true)

    ctx.onStop(() => {

      window.removeEventListener('change', onChange, true)
      window.removeEventListener('paste', onPaste, true)
      window.removeEventListener('drop', onDrop, true)
    })
  },
})