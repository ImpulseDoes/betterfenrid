const fs = require('node:fs')
const path = require('node:path')
const UNUSED = ['dxcompiler.dll', 'dxil.dll']

exports.default = async function afterPack({ appOutDir }) {

  let saved = 0

  for (const file of UNUSED) {

    const target = path.join(appOutDir, file)

    if (!fs.existsSync(target)) continue

    saved += fs.statSync(target).size
    fs.rmSync(target)
  }

  console.log(`trimmed unused Chromium files  saved=${(saved / 1048576).toFixed(1)}MB`)
}