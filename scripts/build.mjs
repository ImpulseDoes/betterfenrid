import { readFileSync } from 'node:fs'
import { context, build } from 'esbuild'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const watch = process.argv.includes('--watch')
const version = process.env.BF_VERSION ?? pkg.version
const downloadUrl = 'https://github.com/ImpulseDoes/betterfenrid/releases/latest/download/betterfenrid.user.js'

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
  define: { __BF_VERSION__: JSON.stringify(version) },
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