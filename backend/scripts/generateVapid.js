// backend/scripts/generateVapid.js
// Genera las llaves VAPID y las agrega al .env si todavía no existen.
const fs = require('fs')
const path = require('path')
const webpush = require('web-push')

const envPath = path.join(__dirname, '..', '.env')
const env = fs.readFileSync(envPath, 'utf8')
if (/^VAPID_PUBLIC_KEY=/m.test(env)) {
  console.log('ℹ️  Ya existen llaves VAPID en el .env')
  process.exit(0)
}
const k = webpush.generateVAPIDKeys()
fs.copyFileSync(envPath, envPath + '.bak-vapid')
fs.appendFileSync(envPath, `\nVAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}\nVAPID_SUBJECT=mailto:jsvr0227@gmail.com\n`)
console.log('✅ Llaves VAPID agregadas al .env')
