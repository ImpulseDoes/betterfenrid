export const ASSET_CDN = 'https://media.idoes.pl/betterfenrid'
export const ASSET_GITHUB = 'https://cdn.jsdelivr.net/gh/ImpulseDoes/betterfenrid@main/src/themes/assets'

const PROBE_FILE = 'impulse-home.jpg'
const PROBE_MS = 5000

function imageOk(url: string, timeoutMs: number): Promise<boolean | null> {

  return new Promise((resolve) => {

    const img = new Image()
    const done = (ok: boolean | null) => {
      img.onload = img.onerror = null
      img.src = ''
      resolve(ok)
    }

    const timer = window.setTimeout(() => done(null), timeoutMs)

    img.onload = () => {
      window.clearTimeout(timer)
      done(true)
    }

    img.onerror = () => {
      window.clearTimeout(timer)
      done(false)
    }

    img.src = url
  })
}

export function assetUrl(file: string, base: string): string {

  return `${base.replace(/\/$/, '')}/${file}`
}

export function assetVars(files: Record<string, string>, base: string): string {

  const decls = Object.entries(files).map(([name, file]) => `--${name}: url("${assetUrl(file, base)}")`)

  return decls.length ? `:root { ${decls.join('; ')}; }` : ''
}

export function startAssetBase(onChange: (base: string) => void): string {

  void imageOk(assetUrl(PROBE_FILE, ASSET_CDN), PROBE_MS).then((ok) => {

    if (ok === false) onChange(ASSET_GITHUB)

  })

  return ASSET_CDN
}