export const WALLS_BASE = 'https://media.idoes.pl/public/walls/'

const IMAGE = /\.(?:jpe?g|png|webp|avif|gif)$/i
const FALLBACK = ['tree.jpg']

async function fromManifest() {

  const res = await fetch(`${WALLS_BASE}walls.json`, { signal: AbortSignal.timeout(15000) })

  if (!res.ok) return null

  const list = await res.json()

  return Array.isArray(list) ? list.map(fileOf).filter(Boolean) : null
}

function fileOf(entry) {

  if (typeof entry === 'string') return entry
  if (entry && typeof entry.id === 'string' && typeof entry.ext === 'string') return `${entry.id}.${entry.ext.replace(/^\./, '')}`

  return null
}

const clean = (files) => [...new Set(files)].filter((file) => file && !file.includes('/') && IMAGE.test(file)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

export async function listWalls() {

  try {

    const files = await fromManifest()

    if (files) {

      const walls = clean(files)

      console.log(`${walls.length} wallpapers from walls.json`)

      return walls
    }

  } catch (err) {

    console.warn(`couldn't read walls.json: ${err.message}`)

  }

  console.warn(`no walls.json, using the built-in list (${FALLBACK.join(', ')})`)

  return FALLBACK
}