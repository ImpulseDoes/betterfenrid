import { readFileSync } from 'node:fs'
import { context, build } from 'esbuild'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const watch = process.argv.includes('--watch')

const userscriptHeader = `// ==UserScript==
// @name         Better Fenrid
// @namespace    https://github.com/ImpulseDoes/betterfenrid
// @version      ${pkg.version}
// @description  ${pkg.description}
// @author       ${pkg.author}
// @license      MIT
// @match        https://fenrid.com/*
// @icon         https://fenrid.com/favicon.ico
// @homepageURL  https://github.com/ImpulseDoes/betterfenrid
// @supportURL   https://github.com/ImpulseDoes/betterfenrid/issues
// @run-at       document-end
// @grant        none
// ==/UserScript==
`

const common = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  loader: { '.css': 'text' },
  define: { __BF_VERSION__: JSON.stringify(pkg.version) },
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