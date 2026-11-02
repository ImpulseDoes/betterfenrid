import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { context, build } from 'esbuild'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const watch = process.argv.includes('--watch')
const version = process.env.BF_VERSION ?? pkg.version
const downloadUrl = 'https://github.com/ImpulseDoes/betterfenrid/releases/latest/download/betterfenrid.user.js'

function changelog() {

  try {

    const log = execFileSync('git', ['log', '-n', '40', '--no-merges', '--format=%h%x1f%s%x1f%cI'], { encoding: 'utf8' })

    return log.trim().split('\n').filter(Boolean).map((line) => {

      const [hash, message, date] = line.split('\x1f')

      return { hash, message, date }
    })

  } catch {

    return []

  }
}

const userscriptHeader = `// ==UserScript==
// @name         Better Fenrid
// @namespace    https://github.com/ImpulseDoes/betterfenrid
// @version      ${version}
// @description  ${pkg.description}
// @author       ${pkg.author}
// @license      MIT
// @match        https://fenrid.com/*
// @icon         https://fenrid.com/favicon.ico
// @homepageURL  https://github.com/ImpulseDoes/betterfenrid
// @supportURL   https://github.com/ImpulseDoes/betterfenrid/issues
// @updateURL    ${downloadUrl}
// @downloadURL  ${downloadUrl}
// @run-at       document-start
// @grant        none
// @inject-into  page
// @sandbox      raw
// ==/UserScript==
`

const common = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  loader: { '.css': 'text', '.jpg': 'dataurl' },
  define: { __BF_VERSION__: JSON.stringify(version), __BF_CHANGELOG__: JSON.stringify(changelog()) },
  legalComments: 'none',
  logLevel: 'info',
}

const targets = [
  // Plain bundle, for pasting into the console or other loaders
  { ...common, outfile: 'dist/betterfenrid.js', sourcemap: watch ? 'inline' : false },
  // Userscript for Tampermonkey / Violentmonkey
  { ...common, outfile: 'dist/betterfenrid.user.js', banner: { js: userscriptHeader } },
]

if (watch) {

  for (const options of targets) await (await context(options)).watch()

  console.log('Watching for changes…')

} else {

  await Promise.all(targets.map((options) => build(options)))

}