import { openModal } from '../api/modal'
import { Button } from '../ui/components'
import { CHANGELOG, COMMIT, DOWNLOAD_URL, NAME, REPO_URL, VERSION, type Commit } from '../meta'
import { h } from './dom'
import { settings } from './settings'

const NOTICE_DELAY_MS = 4_000
const FALLBACK_COUNT = 10

export function checkForUpdates() {
  window.open(DOWNLOAD_URL, '_blank', 'noopener')
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