import { BaseMail } from '@adonisjs/mail'
import User from '#models/user'

export default class ForgotPasswordMail extends BaseMail {
  constructor(
    private user: User,
    private resetUrl: string
  ) {
    super()
  }

  /**
   * The "prepare" method is called by the mailer to prepare
   * the email message for sending.
   */
  async prepare() {
    this.message
      .to(this.user.email)
      .subject('Reset your password')
      .htmlView('emails/forgot_password', {
        user: this.user,
        resetUrl: this.resetUrl,
      })
  }
}

