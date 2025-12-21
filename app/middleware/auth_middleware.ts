import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'
import { adminPath } from '#services/admin_path_service'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 */
export default class AuthMiddleware {
  /**
   * The URL to redirect to, when authentication fails
   */
  redirectTo = adminPath('login')

  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    const guardsToUse: (keyof Authenticators)[] =
      options.guards && options.guards.length > 0 ? options.guards : ['web']
    await ctx.auth.authenticateUsing(guardsToUse as any, { loginRoute: this.redirectTo })
    return next()
  }
}
