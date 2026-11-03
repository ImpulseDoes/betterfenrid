const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

if (process.platform !== 'win32') {

  console.log('Media helper skipped: Windows only')
  process.exit(0)

}

const windir = process.env.WINDIR ?? 'C:\\Windows'
const framework = path.join(windir, 'Microsoft.NET', 'Framework64', 'v4.0.30319')
const metadata = path.join(windir, 'System32', 'WinMetadata')
const dir = path.join(__dirname, '..', 'src', 'media')
const source = path.join(dir, 'MediaHelper.cs')
const output = path.join(dir, 'media-helper.exe')

if (fs.existsSync(output) && fs.statSync(output).mtimeMs >= fs.statSync(source).mtimeMs) process.exit(0)

const references = [
  path.join(metadata, 'Windows.Foundation.winmd'),
  path.join(metadata, 'Windows.Media.winmd'),
  path.join(metadata, 'Windows.Storage.winmd'),
  path.join(framework, 'System.Runtime.dll'),
  path.join(framework, 'System.Runtime.InteropServices.WindowsRuntime.dll'),
]

execFileSync(path.join(framework, 'csc.exe'), [
  '/nologo',
  '/optimize+',
  '/target:exe',
  '/platform:anycpu',
  `/out:${output}`,
  ...references.map((file) => `/reference:${file}`),
  source,
], { stdio: 'inherit' })

console.log(`Built ${path.relative(process.cwd(), output)} (${(fs.statSync(output).size / 1024).toFixed(0)} KB)`)