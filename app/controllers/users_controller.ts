import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import LocaleService from '#services/locale_service'
import CreatePost from '#actions/posts/create_post'
import siteSettingsService from '#services/site_settings_service'
import PostCustomFieldValue from '#models/post_custom_field_value'
import activityLogService from '#services/activity_log_service'
import { createUserValidator, updateUserValidator, resetPasswordValidator } from '#validators/user'

export default class UsersController {
  /**
   * POST /api/users (admin)
   */
  async store({ request, response, auth }: HttpContext) {
    const { email, password, role, username, fullName } =
      await request.validateUsing(createUserValidator)

    // Non-admins cannot create Administrator accounts
    const me = auth.use('web').user as any
    if (me.role !== 'admin' && role === 'admin') {
      return response.forbidden({ error: 'Not allowed to create Administrator accounts' })
    }

    // Uniqueness checks
    const emailExists = await db.from('users').where('email', email).first()
    if (emailExists) {
      return response.status(409).json({ error: 'Email already in use' })
    }
    if (username) {
      const usernameExists = await db
        .from('users')
        .whereRaw('LOWER(username) = LOWER(?)', [username as string])
        .first()
      if (usernameExists) {
        return response.status(409).json({ error: 'Username already in use' })
      }
    }

    const hashed = await hash.make(password)
    const now = new Date()
    const [created] = await db
      .table('users')
      .insert({
        email,
        password: hashed,
        role,
        username: username || null,
        full_name: fullName || null,
        created_at: now,
        updated_at: now,
      })
      .returning(['id', 'email', 'username', 'full_name', 'role', 'created_at', 'updated_at'])

    try {
      await activityLogService.log({
        action: 'user.create',
        userId: Number((created as any).id),
        entityType: 'user',
        entityId: (created as any).id,
      })
    } catch {
      /* ignore logging errors */
    }

    return response.created({
      data: {
        id: (created as any).id,
        email: (created as any).email,
        username: (created as any).username ?? null,
        fullName: (created as any).full_name ?? null,
        role: (created as any).role,
        createdAt: (created as any).created_at,
        updatedAt: (created as any).updated_at,
      },
    })
  }

  /**
   * GET /api/users (admin)
   */
  async index({ response }: HttpContext) {
    const rows = await db
      .from('users')
      .orderBy('created_at', 'desc')
      .select('id', 'email', 'username', 'full_name', 'role', 'created_at', 'updated_at')
    return response.ok({
      data: rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        username: r.username ?? null,
        fullName: r.full_name ?? null,
        role: r.role,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    })
  }

  /**
   * GET /api/users/:id/profile (admin)
   * Returns the profile post id for a given user, or null if none.
   */
  async profileForUser({ params, response }: HttpContext) {
    const { id } = params
    const userId = Number(id)
    if (!Number.isFinite(userId) || userId <= 0) {
      return response.badRequest({ error: 'Invalid user id' })
    }
    const row = await db.from('posts').where({ type: 'profile', author_id: userId }).first()
    if (!row) return response.ok({ id: null })
    return response.ok({ id: (row as any).id })
  }

  /**
   * POST /api/users/:id/profile (admin)
   * Create a profile post for the given user if missing; returns the id.
   */
  async createProfileForUser({ params, response }: HttpContext) {
    const { id } = params
    const userId = Number(id)
    if (!Number.isFinite(userId) || userId <= 0) {
      return response.badRequest({ error: 'Invalid user id' })
    }
    // If exists, return it
    const existing = await db.from('posts').where({ type: 'profile', author_id: userId }).first()
    if (existing) return response.ok({ id: (existing as any).id })
    // Fallback locale
    const defaultLocaleRow = await db.from('locales').where('is_default', true).first()
    const locale = (defaultLocaleRow as any)?.code || 'en'
    const user = await db.from('users').where('id', userId).first()
    if (!user) return response.notFound({ error: 'User not found' })
    const base = String((user as any).full_name || (user as any).email || `user-${userId}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const slug = `${base || 'user'}-${userId}`
    const title = (user as any).full_name
      ? `${(user as any).full_name}'s Profile`
      : `User ${userId} Profile`
    const now = new Date()
    const [created] = await db
      .table('posts')
      .insert({
        id: (await import('node:crypto')).randomUUID(),
        type: 'profile',
        slug,
        title,
        status: 'draft',
        locale,
        user_id: userId,
        author_id: userId,
        created_at: now,
        updated_at: now,
      })
      .returning('*')
    return response.created({ id: (created as any).id })
  }

  /**
   * PATCH /api/users/:id (admin) - update name/email/role
   */
  async update({ params, request, response, auth }: HttpContext) {
    const { id } = params
    const { email, role, username, fullName } = await request.validateUsing(updateUserValidator)

    const row = await db.from('users').where('id', id).first()
    if (!row) return response.notFound({ error: 'User not found' })

    const me = auth.use('web').user as any
    const isSuperAdmin = me.role === 'admin'

    // Non-admins cannot modify Administrator accounts or promote anyone to admin
    if (!isSuperAdmin) {
      if ((row as any).role === 'admin') {
        return response.forbidden({ error: 'Not allowed to modify Administrator accounts' })
      }
      if (role === 'admin') {
        return response.forbidden({ error: 'Not allowed to promote users to Administrator' })
      }
    }

    // Unique email check when changing
    if (email !== undefined) {
      const existing = await db.from('users').where('email', email).andWhereNot('id', id).first()
      if (existing) {
        return response.status(409).json({ error: 'Email already in use' })
      }
    }
    // Unique username check when changing (when provided)
    if (username !== undefined) {
      const existingU = await db
        .from('users')
        .whereRaw('LOWER(username) = LOWER(?)', [username as string])
        .andWhereNot('id', id)
        .first()
      if (existingU) {
        return response.status(409).json({ error: 'Username already in use' })
      }
    }
    const now = new Date()
    const update: any = { updated_at: now }
    if (email !== undefined) update.email = email
    if (role !== undefined) update.role = role
    if (username !== undefined) update.username = username
    if (fullName !== undefined) update.full_name = fullName
    const count = await db.from('users').where('id', id).update(update)
    if (!count) return response.notFound({ error: 'User not found' })
    // Activity log
    try {
      const ua = (request as any).request?.headers?.['user-agent'] || null
      const ip = (request as any).ip()
      await activityLogService.log({
        action: 'user.update',
        userId: Number(id),
        entityType: 'user',
        entityId: id,
        ip,
        userAgent: typeof ua === 'string' ? ua : null,
        metadata: { changed: Object.keys(update) },
      })
    } catch {
      /* ignore logging errors */
    }
    const user = await db.from('users').where('id', id).first()
    return response.ok({
      data: {
        id: user.id,
        email: user.email,
        username: user.username ?? null,
        fullName: user.full_name ?? null,
        role: user.role,
        updatedAt: user.updated_at,
      },
    })
  }

  /**
   * PATCH /api/users/:id/password (admin)
   */
  async resetPassword({ params, request, response, auth }: HttpContext) {
    const { id } = params
    const { password } = await request.validateUsing(resetPasswordValidator)

    const row = await db.from('users').where('id', id).first()
    if (!row) return response.notFound({ error: 'User not found' })

    // Non-admins cannot reset passwords for Administrator accounts
    const me = auth.use('web').user as any
    if (me.role !== 'admin' && (row as any).role === 'admin') {
      return response.forbidden({
        error: 'Not allowed to reset passwords for Administrator accounts',
      })
    }

    const hashed = await hash.make(password)
    const now = new Date()
    const count = await db
      .from('users')
      .where('id', id)
      .update({ password: hashed, updated_at: now })
    if (!count) return response.notFound({ error: 'User not found' })
    try {
      const ua = (request as any).request?.headers?.['user-agent'] || null
      const ip = (request as any).ip()
      await activityLogService.log({
        action: 'user.password.reset',
        userId: Number(id),
        entityType: 'user',
        entityId: id,
        ip,
        userAgent: typeof ua === 'string' ? ua : null,
      })
    } catch {}
    return response.ok({ message: 'Password updated' })
  }

  /**
   * DELETE /api/users/:id (admin)
   */
  async destroy({ params, auth, response }: HttpContext) {
    const { id } = params
    // Prevent self-deletion to avoid accidental lockout
    const meId = (auth.use('web').user as any)?.id
    if (String(meId) === String(id)) {
      return response.badRequest({ error: 'You cannot delete your own account' })
    }
    const row = await db.from('users').where('id', id).first()
    if (!row) return response.notFound({ error: 'User not found' })

    // Non-admins cannot delete Administrator accounts
    const me = auth.use('web').user as any
    if (me.role !== 'admin' && (row as any).role === 'admin') {
      return response.forbidden({ error: 'Not allowed to delete Administrator accounts' })
    }

    await db.from('users').where('id', id).delete()
    try {
      await activityLogService.log({
        action: 'user.delete',
        userId: Number(id),
        entityType: 'user',
        entityId: id,
      })
    } catch {}
    return response.noContent()
  }

  /**
   * GET /api/profile/status - current user profile status and role enablement
   */
  async profileStatus({ auth, response }: HttpContext) {
    if (!auth.use('web').isAuthenticated) return response.unauthorized({ error: 'Auth required' })
    const me: any = auth.use('web').user
    const site = await siteSettingsService.get()
    const enabledRoles: string[] = Array.isArray((site as any).profileRolesEnabled)
      ? (site as any).profileRolesEnabled
      : []
    const enabledForRole = enabledRoles.length === 0 || enabledRoles.includes(me?.role)
    let hasProfile = false
    let profilePostId: string | undefined
    let profileThumbUrl: string | undefined
    if (enabledForRole) {
      const row = await db.from('posts').where({ type: 'profile', author_id: me.id }).first()
      if (row) {
        hasProfile = true
        profilePostId = (row as any).id
        try {
          // Resolve profile_image custom field value by slug (assumes value stores media id string)
          const val = await PostCustomFieldValue.query()
            .where({ postId: (row as any).id, fieldSlug: 'profile_image' })
            .first()
          const mediaId =
            val && (val as any).value
              ? typeof (val as any).value === 'string'
                ? (val as any).value
                : String((val as any).value?.id || (val as any).value)
              : null
          if (mediaId) {
            const m = await db.from('media_assets').where('id', mediaId).first()
            if (m) {
              const meta = (m as any).metadata || {}
              const adminThumb = process.env.MEDIA_ADMIN_THUMBNAIL_VARIANT || 'thumb'
              const variants = Array.isArray((meta as any).variants) ? (meta as any).variants : []
              const found = variants.find((v: any) => v?.name === adminThumb)
              profileThumbUrl = found && found.url ? found.url : (m as any).url
            }
          }
        } catch {
          /* ignore */
        }
      }
    }
    return response.ok({ data: { enabledForRole, hasProfile, profilePostId, profileThumbUrl } })
  }

  /**
   * POST /api/users/me/profile - create profile post for current user
   */
  async createMyProfile({ auth, response }: HttpContext) {
    if (!auth.use('web').isAuthenticated) return response.unauthorized({ error: 'Auth required' })
    const me: any = auth.use('web').user
    // Enforce one per user (db unique also protects)
    const existing = await db.from('posts').where({ type: 'profile', author_id: me.id }).first()
    if (existing) {
      return response
        .status(409)
        .json({ error: 'Profile already exists', id: (existing as any).id })
    }
    const locale = await LocaleService.getDefaultLocale()
    const slugBase = (me.fullName || me.email || `user-${me.id}`)
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const slug = `${slugBase || 'user'}-${me.id}`
    const title =
      me.fullName && me.fullName.trim() ? `${me.fullName}'s Profile` : `User ${me.id} Profile`
    try {
      const post = await CreatePost.handle({
        type: 'profile',
        locale,
        slug,
        title,
        status: 'draft',
        userId: me.id,
      })
      try {
        await activityLogService.log({
          action: 'profile.create',
          userId: Number(me.id),
          entityType: 'post',
          entityId: post.id,
        })
      } catch {}
      return response.created({ id: post.id })
    } catch (e: any) {
      const status = e?.statusCode || 400
      return response.status(status).json({ error: e?.message || 'Failed to create profile' })
    }
  }
}
