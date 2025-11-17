import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class RedirectsMiddleware {
  public async handle(ctx: HttpContext, next: () => Promise<void>) {
    // Only handle GET/HEAD
    if (!['GET', 'HEAD'].includes(ctx.request.method())) {
      await next()
      return
    }

    const path = ctx.request.url().split('?')[0] // path without query
    const locale = ctx.request.input('locale') || null

    // Try specific-locale redirect, then fallback without locale
    const redirect =
      (await db.from('url_redirects').where({ from_path: path, locale }).first()) ||
      (await db.from('url_redirects').where({ from_path: path, locale: null }).first())

    if (redirect) {
      return ctx.response.redirect(redirect.http_status || 301, redirect.to_path)
    }

    await next()
  }
}


