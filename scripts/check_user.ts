import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'

/**
 * Check if user exists and optionally test password verification.
 *
 * Usage:
 *   tsx scripts/check_user.ts <email> [password]
 */

const appRoot = new URL('../', import.meta.url)

const importer = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, appRoot).href)
  }
  return import(filePath)
}

const ignitor = new Ignitor(appRoot, { importer })
const app = ignitor.createApp('console')

await app.init()
await app.boot()

const { default: User } = (await import('../app/models/user.js')) as any
const { default: hash } = (await import('@adonisjs/core/services/hash')) as any

const email = process.argv[2]
const password = process.argv[3]

if (!email) {
  console.error('Usage: tsx scripts/check_user.ts <email> [password]')
  await app.terminate()
  process.exit(1)
}

const user = await User.findBy('email', email)

    if (!user) {
      console.error(`User not found: ${email}`)
      await app.terminate()
      process.exit(0)
    }

console.log(`User found: ${user.email}`)
console.log(`User ID: ${user.id}`)
console.log(`Full Name: ${user.fullName}`)

if (password) {
  const isValid = await hash.verify(user.password, password)
  console.log(`Password verification: ${isValid ? 'SUCCESS ✓' : 'FAILED ✗'}`)

  if (!isValid) {
    console.warn('Password hash in DB (first 50 chars):')
    console.log(user.password.substring(0, 50) + '...')
  }
} else {
  console.log('Password hash (first 50 chars):')
  console.log(user.password.substring(0, 50) + '...')
}

await app.terminate()





