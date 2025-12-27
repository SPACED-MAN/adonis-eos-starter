import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import string from '@adonisjs/core/helpers/string'
import mail from '@adonisjs/mail/services/main'
import ForgotPasswordMail from '#mails/forgot_password_mail'
import vine from '@vinejs/vine'

export default class PasswordResetsController {
  /**
   * GET /admin/forgot-password
   */
  async showForgot({ inertia }: HttpContext) {
    return inertia.render('admin/auth/forgot-password')
  }

  /**
   * POST /admin/forgot-password
   */
  async sendEmail({ request, response, session }: HttpContext) {
    const { email } = await request.validateUsing(
      vine.compile(
        vine.object({
          email: vine.string().email(),
        })
      )
    )

    const user = await User.findBy('email', email)

    if (user) {
      const token = string.random(64)
      const expiresAt = DateTime.now().plus({ hours: 1 })

      // Store token
      await db.table('password_reset_tokens').insert({
        email,
        token,
        expires_at: expiresAt.toSQL(),
        created_at: DateTime.now().toSQL(),
      })

      // Send email
      const resetUrl = `${request.protocol()}://${request.host()}/admin/reset-password?token=${token}`
      await mail.send(new ForgotPasswordMail(user, resetUrl))
    }

    // Always show success message to prevent user enumeration
    session.flash(
      'success',
      'If an account exists with that email, we have sent password reset instructions.'
    )
    return response.redirect().back()
  }

  /**
   * GET /admin/reset-password
   */
  async showReset({ request, inertia, response, session }: HttpContext) {
    const token = request.input('token')

    if (!token) {
      return response.redirect().toPath('/admin/login')
    }

    const record = await db
      .from('password_reset_tokens')
      .where('token', token)
      .where('expires_at', '>', DateTime.now().toSQL())
      .first()

    if (!record) {
      session.flash('error', 'Invalid or expired token.')
      return response.redirect().toPath('/admin/login')
    }

    return inertia.render('admin/auth/reset-password', { token })
  }

  /**
   * POST /admin/reset-password
   */
  async reset({ request, response, session }: HttpContext) {
    const { token, password } = await request.validateUsing(
      vine.compile(
        vine.object({
          token: vine.string(),
          password: vine.string().minLength(8).confirmed(),
        })
      )
    )

    const record = await db
      .from('password_reset_tokens')
      .where('token', token)
      .where('expires_at', '>', DateTime.now().toSQL())
      .first()

    if (!record) {
      session.flash('error', 'Invalid or expired token.')
      return response.redirect().toPath('/admin/login')
    }

    const user = await User.findBy('email', record.email)

    if (!user) {
      session.flash('error', 'User not found.')
      return response.redirect().toPath('/admin/login')
    }

    // Update password
    user.password = password
    await user.save()

    // Delete token
    await db.from('password_reset_tokens').where('email', record.email).delete()

    session.flash('success', 'Your password has been reset successfully.')
    return response.redirect().toPath('/admin/login')
  }
}
