import { BaseCommand, args } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'

export default class CheckUser extends BaseCommand {
  static commandName = 'check:user'
  static description = 'Check if user exists and optionally test password verification'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'User email address' })
  declare email: string

  @args.string({ description: 'Password to verify (optional)', required: false })
  declare password?: string

  async run() {
    const user = await User.findBy('email', this.email)

    if (!user) {
      this.logger.error(`User not found: ${this.email}`)
      return
    }

    this.logger.info(`User found: ${user.email}`)
    this.logger.info(`User ID: ${user.id}`)
    this.logger.info(`Full Name: ${user.fullName}`)

    // Test password verification if password provided
    if (this.password) {
      const isValid = await hash.verify(user.password, this.password)
      this.logger.info(`Password verification: ${isValid ? 'SUCCESS ✓' : 'FAILED ✗'}`)

      if (!isValid) {
        this.logger.warning('Password hash in DB (first 50 chars):')
        this.logger.info(user.password.substring(0, 50) + '...')
      }
    } else {
      this.logger.info('Password hash (first 50 chars):')
      this.logger.info(user.password.substring(0, 50) + '...')
    }
  }
}
