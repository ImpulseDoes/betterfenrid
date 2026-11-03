// Builds the installer and the portable exe.
// electron-builder works in a temp folder because antivirus scans of a fresh exe on the Desktop
// lock it right when the icon and version get written (EBUSY). Only the finished files land in ./out.
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const root = path.join(__dirname, '..')
const work = path.join(os.tmpdir(), 'better-fenrid-build')
const out = path.join(root, 'out')

fs.rmSync(work, { recursive: true, force: true })

const env = { ...process.env }

// Set by some terminals, makes Electron tools behave like plain Node
delete env.ELECTRON_RUN_AS_NODE

execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['electron-builder', '--win', `-c.directories.output=${work}`], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

fs.mkdirSync(out, { recursive: true })

for (const file of fs.readdirSync(work)) {

  if (!/\.(exe|blockmap)$/.test(file)) continue

  fs.copyFileSync(path.join(work, file), path.join(out, file))
  console.log(`  -> out/${file}`)
}
