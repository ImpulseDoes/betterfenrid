import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const dir = join(homedir(), '.betterfenrid')
const keystore = join(dir, 'android-release.jks')
const passwordFile = join(dir, 'android-release-password.txt')
const base64File = join(dir, 'android-release-base64.txt')

const exe = process.platform === 'win32' ? 'keytool.exe' : 'keytool'

function findKeytool() {

  const candidates = []

  if (process.env.JAVA_HOME) candidates.push(join(process.env.JAVA_HOME, 'bin', exe))

  for (const base of ['C:/Program Files/JetBrains', 'C:/Program Files/Android']) {

    if (!existsSync(base)) continue

    for (const ide of readdirSync(base)) candidates.push(join(base, ide, 'jbr', 'bin', exe))
  }

  return candidates.find((file) => existsSync(file)) ?? 'keytool'
}

mkdirSync(dir, { recursive: true })

if (existsSync(keystore)) {

  console.log(`The key already exists: ${keystore}`)

} else {

  const password = randomBytes(24).toString('base64url')

  execFileSync(findKeytool(), [
    '-genkeypair',
    '-keystore', keystore,
    '-storetype', 'PKCS12',
    '-alias', 'betterfenrid',
    '-keyalg', 'RSA',
    '-keysize', '4096',
    '-validity', '10000',
    '-dname', 'CN=Better Fenrid',
    '-storepass', password,
  ], { stdio: ['ignore', 'ignore', 'inherit'] })

  writeFileSync(passwordFile, password)
  console.log(`Made a new key: ${keystore}`)
}

writeFileSync(base64File, readFileSync(keystore).toString('base64'))