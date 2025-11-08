import type { HttpContext } from '@adonisjs/core/http'
import { loginValidator } from '#validators/auth'
import User from '#models/user'

export default class AuthController {
  async showLogin({ inertia, auth }: HttpContext) {
    if (auth.isAuthenticated) {
      return inertia.location('/admin')
    }
    return inertia.render('admin/login')
  }

  async login({ request, response, auth, session }: HttpContext) {
    // Validate request
    const { email, password } = await request.validateUsing(loginValidator)

    try {
      // Verify credentials using the AuthFinder mixin method
      // This is timing-attack safe as per AdonisJS docs
      const user = await User.verifyCredentials(email, password)

      // Login the user
      await auth.use('web').login(user)

      return response.redirect('/admin')
    } catch (error) {
      // verifyCredentials throws E_INVALID_CREDENTIALS on failure
      session.flash('error', 'Invalid email or password')
      return response.redirect().back()
    }
  }

  async logout({ response, auth }: HttpContext) {
    await auth.use('web').logout()
    return response.redirect('/admin/login')
  }
}
