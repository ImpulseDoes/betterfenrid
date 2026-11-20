const TAG = 0xe0000

export const RUN = /[\u{E0020}-\u{E007E}]+/gu
export const BIO_LIMIT = 190

const MARKER = '<bf>'
const THEME = /\[#[0-9a-f]{1,6},#[0-9a-f]{1,6}\]|\{[^{}\s]+\}/i

export const encode = (text: string) => String.fromCodePoint(...[...text].map((c) => TAG + c.charCodeAt(0)))
export const decode = (run: string) => String.fromCharCode(...[...run].map((c) => c.codePointAt(0)! - TAG))

const runs = (bio: string) => [...bio.matchAll(RUN)].map(([run]) => decode(run))

export function editRuns(bio: string, edit: (text: string) => string): string {
  return bio.replace(RUN, (run) => encode(edit(decode(run))))
}

export const hasMarker = (bio: string) => runs(bio).some((text) => text.includes(MARKER))

export const withoutMarker = (bio: string) => editRuns(bio, (text) => text.split(MARKER).join(''))

export const withMarker = (bio: string) => hasMarker(bio) ? bio : withoutMarker(bio).trimEnd() + encode(MARKER)

export const usesBetterFenrid = (bio: unknown) => typeof bio === 'string' && runs(bio).some((text) => text.includes(MARKER) || THEME.test(text))