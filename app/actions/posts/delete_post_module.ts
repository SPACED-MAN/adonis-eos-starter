import db from '@adonisjs/lucid/services/db'
import postTypeConfigService from '#services/post_type_config_service'
import PostSnapshotService from '#services/post_snapshot_service'

type DeletePostModuleParams = {
  postModuleId: string
  mode?: 'publish' | 'review' | 'ai-review'
}

export class DeletePostModuleException extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'DeletePostModuleException'
  }
}

export default class DeletePostModule {
  /**
   * Removes a module from a post.
   * If mode is 'review' or 'ai-review', it marks the module as deleted in the draft snapshot.
   * If mode is 'publish', it deletes the join record.
   */
  static async handle({ postModuleId, mode = 'publish' }: DeletePostModuleParams): Promise<void> {
    const row = await db.from('post_modules').where('id', postModuleId).first()
    if (!row) {
      throw new DeletePostModuleException('Post module not found', 404)
    }

    // Disallow module operations when modules are disabled for the post type
    const postRow = await db.from('posts').where('id', row.post_id).first()
    if (postRow) {
      const cfg = postTypeConfigService.getUiConfig(postRow.type)
      const modulesEnabled = cfg.modulesEnabled !== false && cfg.urlPatterns.length > 0
      if (!modulesEnabled) {
        throw new DeletePostModuleException('Modules are disabled for this post type')
      }
    }

    // Check if locked
    if (row.locked) {
      throw new DeletePostModuleException('Cannot delete a locked module')
    }

    if (mode === 'review') {
      await db
        .from('post_modules')
        .where('id', postModuleId)
        .update({ review_deleted: true, updated_at: new Date() })
    } else if (mode === 'ai-review') {
      await db
        .from('post_modules')
        .where('id', postModuleId)
        .update({ ai_review_deleted: true, updated_at: new Date() })
    } else {
      await db.from('post_modules').where('id', postModuleId).delete()
    }

    // Refresh atomic draft if in a draft mode to keep JSON consistent with granular columns
    if (mode === 'review' || mode === 'ai-review') {
      await PostSnapshotService.refreshAtomicDraft(row.post_id, mode)
    }
  }
}

