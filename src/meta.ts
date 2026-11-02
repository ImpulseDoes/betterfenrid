declare const __BF_VERSION__: string
declare const __BF_CHANGELOG__: Commit[]

export interface Commit {
  hash: string
  message: string
  date: string
}

export const NAME = 'Better Fenrid'
export const VERSION = __BF_VERSION__
export const REPO_URL = 'https://github.com/ImpulseDoes/betterfenrid'
export const DOWNLOAD_URL = `${REPO_URL}/releases/latest/download/betterfenrid.user.js`
export const CHANGELOG = __BF_CHANGELOG__
export const COMMIT = CHANGELOG[0]?.hash ?? null