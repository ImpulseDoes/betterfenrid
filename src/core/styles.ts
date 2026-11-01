export interface ManagedStyle {
  set(css: string): void
  remove(): void
}

export function createStyle(css = ''): ManagedStyle {

  if ('adoptedStyleSheets' in Document.prototype && 'replaceSync' in CSSStyleSheet.prototype) {

    const sheet = new CSSStyleSheet()

    sheet.replaceSync(css)

    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]

    return {
      set: (next) => sheet.replaceSync(next),
      remove: () => {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet)
      },
    }
  }

  const el = document.createElement('style')

  el.textContent = css

  document.head.append(el)

  return {
    set: (next) => {
      el.textContent = next
    },
    remove: () => el.remove(),
  }
}