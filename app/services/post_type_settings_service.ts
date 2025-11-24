import db from '@adonisjs/lucid/services/db'

class PostTypeSettingsService {
  async isAutoRedirectEnabled(postType: string): Promise<boolean> {
    try {
      const row = await db.from('post_type_settings').where('post_type', postType).first()
      if (!row) return true
      return !!row.auto_redirect_on_slug_change
    } catch {
      // Table may not exist yet; default to enabled
      return true
    }
  }

  async setAutoRedirect(postType: string, enabled: boolean): Promise<void> {
    const now = new Date()
    const existing = await db.from('post_type_settings').where('post_type', postType).first()
    if (existing) {
      await db.from('post_type_settings').where('post_type', postType).update({
        auto_redirect_on_slug_change: enabled,
        updated_at: now,
      })
    } else {
      await db.table('post_type_settings').insert({
        post_type: postType,
        auto_redirect_on_slug_change: enabled,
        created_at: now,
        updated_at: now,
      })
    }
  }

  async isHierarchyEnabled(postType: string): Promise<boolean> {
    try {
      const row = await db.from('post_type_settings').where('post_type', postType).first()
      if (!row) return false
      return !!row.hierarchy_enabled
    } catch {
      return false
    }
  }

  async setHierarchy(postType: string, enabled: boolean): Promise<void> {
    const now = new Date()
    const existing = await db.from('post_type_settings').where('post_type', postType).first()
    if (existing) {
      await db.from('post_type_settings').where('post_type', postType).update({
        hierarchy_enabled: enabled,
        updated_at: now,
      })
    } else {
      await db.table('post_type_settings').insert({
        post_type: postType,
        hierarchy_enabled: enabled,
        auto_redirect_on_slug_change: true,
        created_at: now,
        updated_at: now,
      })
    }
  }
}

const postTypeSettingsService = new PostTypeSettingsService()
export default postTypeSettingsService


