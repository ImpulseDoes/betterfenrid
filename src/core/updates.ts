import { openModal } from '../api/modal'
import { toast } from '../api/toast'
import { Button } from '../ui/components'
import { CHANGELOG, COMMIT, DOWNLOAD_URL, NAME, REPO_URL, VERSION, type Commit } from '../meta'
import { h } from './dom'
import { settings } from './settings'

const NOTICE_DELAY_MS = 4_000
const FALLBACK_COUNT = 10

const READY_TOAST_MS = 10_000
const reloadHint = (version: string) => `${NAME} v${version} is downloaded. Press Ctrl+R to switch to it.`

// The desktop app updates the mod by itself, the userscript goes through its manager
export const updatesInApp = Boolean(window.BetterFenridNative?.updates)

export async function checkForUpdates() {

  const updates = window.BetterFenridNative?.updates

  if (!updates) return void window.open(DOWNLOAD_URL, '_blank', 'noopener')

  toast('Checking for updates…')

  const result = await updates.check()

  if (result.status === 'ready') toast(reloadHint(result.version ?? ''), 'success', READY_TOAST_MS)
  else if (result.status === 'latest') toast(`You're on the latest version (v${VERSION})`, 'success')
  else if (result.status === 'local') toast('Running a local build, updates are off')
  else toast(`Could not check for updates: ${result.error ?? 'unknown error'}`, 'error', 5000)
}

export function watchAppUpdates() {

  window.BetterFenridNative?.updates?.onReady(({ version }) => toast(reloadHint(version), 'success', READY_TOAST_MS))
}

function CommitItem(commit: Commit): Node {

  return h(
    'li',
    { class: 'bf-changelog-item' },
    h('span', { class: 'bf-changelog-text' }, commit.message),
    h('a', { class: 'bf-changelog-hash', href: `${REPO_URL}/commit/${commit.hash}`, target: '_blank', rel: 'noopener' }, commit.hash),
  )
}

export function openChangelog(commits: Commit[] = CHANGELOG.slice(0, FALLBACK_COUNT), title = 'What\'s new') {

  const close = openModal({
    title,
    body: h(
      'div',
      {},
      h('p', { class: 'bf-row-desc' }, `You're on ${NAME} v${VERSION}.`),
      commits.length ? h('ul', { class: 'bf-changelog' }, ...commits.map(CommitItem)) : h('div', { class: 'bf-empty' }, 'No changes listed for this build.'),
    ),
    footer: [
      Button('Full history', () => window.open(`${REPO_URL}/commits/main`, '_blank', 'noopener'), 'secondary'),
      Button('Close', () => close()),
    ],
  })
}

export function showUpdateNotice() {

  const { lastCommit, updateNotices } = settings.get().core

  if (!COMMIT || COMMIT === lastCommit) return

  settings.update((s) => {
    s.core.lastCommit = COMMIT
  })

  if (!lastCommit || !updateNotices) return

  const since = CHANGELOG.findIndex((commit) => commit.hash === lastCommit)
  const commits = CHANGELOG.slice(0, since < 0 ? FALLBACK_COUNT : since)

  setTimeout(() => openChangelog(commits, `${NAME} was updated`), NOTICE_DELAY_MS)
}