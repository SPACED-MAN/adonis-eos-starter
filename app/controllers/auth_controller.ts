import type { HttpContext } from '@adonisjs/core/http'
import { loginValidator } from '#validators/auth'
import User from '#models/user'
import { adminPath } from '#services/admin_path_service'
import activityLogService from '#services/activity_log_service'

export default class AuthController {
  async showLogin({ inertia, auth }: HttpContext) {
    if (auth.isAuthenticated) {
      return inertia.location(adminPath())
    }
    return inertia.render('admin/login')
  }

  async login({ request, response, auth, session }: HttpContext) {
    // Validate request
    const { uid, password } = await request.validateUsing(loginValidator)

    try {
      // Verify credentials using the AuthFinder mixin method
      // This is timing-attack safe as per AdonisJS docs
      const user = await User.verifyCredentials(uid, password)

      // Prevent AI agent accounts from logging in via the web interface
      if ((user as any).role === 'ai_agent' || (user as any).role === 'workflow') {
        await activityLogService.log({
          action: 'user.login_blocked',
          userId: user.id,
          ip: request.ip(),
          userAgent: request.header('user-agent') || null,
          metadata: { reason: 'System roles cannot login via web' },
        })
        session.flash('error', 'System accounts are not allowed to login via the web interface')
        return response.redirect().back()
      }

      // Login the user
      await auth.use('web').login(user)

      // Log successful login
      await activityLogService.log({
        action: 'user.login',
        userId: user.id,
        ip: request.ip(),
        userAgent: request.header('user-agent') || null,
      })

      return response.redirect(adminPath())
    } catch (error) {
      // Log failed login attempt
      await activityLogService.log({
        action: 'user.login_failed',
        userId: null,
        ip: request.ip(),
        userAgent: request.header('user-agent') || null,
        metadata: { uid },
      })

      // verifyCredentials throws E_INVALID_CREDENTIALS on failure
      session.flash('error', 'Invalid credentials')
      return response.redirect().back()
    }
  }

  async logout({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    await auth.use('web').logout()

    // Log logout
    await activityLogService.log({
      action: 'user.logout',
      userId: user.id,
      ip: request.ip(),
      userAgent: request.header('user-agent') || null,
    })

    return response.redirect(adminPath('login'))
  }
}
