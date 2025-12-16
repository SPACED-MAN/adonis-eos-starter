import type { HttpContext } from '@adonisjs/core/http'
import UrlRedirect from '#models/url_redirect'

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
    // First try exact locale match (when provided in query),
    // then any redirect for this from_path regardless of locale.
    const redirect =
      (locale ? await UrlRedirect.query().where({ fromPath: path, locale }).first() : null) ||
      (await UrlRedirect.query().where({ fromPath: path }).first())

    if (redirect) {
      // Correct argument order: redirect(url, status)
      return ctx.response.redirect(
        redirect.toPath,
        (redirect as any).httpStatus || (redirect as any).http_status || 301
      )
    }

    await next()
  }
}
