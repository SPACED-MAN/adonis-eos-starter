import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'

/**
 * Check if user exists and optionally test password verification.
 *
 * Usage:
 *   tsx scripts/check_user.ts <email> [password]
 */

const appRoot = new URL('../', import.meta.url)

new Ignitor(appRoot, { logger: true })
  .tap((app) => {
    app.booting(async () => {
      await app.init()
      await app.boot()
    })
  })
  .run(async (app) => {
    const User = (await app.container.make('#models/user')).default
    const hash = await app.container.make('adonis.hash')

    const email = process.argv[2]
    const password = process.argv[3]

    if (!email) {
      console.error('Usage: tsx scripts/check_user.ts <email> [password]')
      process.exit(1)
    }

    const user = await User.findBy('email', email)

    if (!user) {
      console.error(`User not found: ${email}`)
      return
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
  })




