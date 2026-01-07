import db from '@adonisjs/lucid/services/db'
import path from 'node:path'
import { promisify } from 'node:util'
import { exec } from 'node:child_process'

const execAsync = promisify(exec)

export interface MediaUsage {
  inModules: any[]
  inOverrides: any[]
  inPosts: any[]
  inAgentExecutions: any[]
  inSettings: boolean
  inCodebase: string[]
}

class MediaUsageService {
  async getUsage(id: string, url: string): Promise<MediaUsage> {
    const dbUsage = await this.getDatabaseUsage(id, url)
    const codebaseUsage = await this.getCodebaseUsage(url)

    return {
      ...dbUsage,
      inCodebase: codebaseUsage,
    }
  }

  private async getDatabaseUsage(id: string, url: string) {
    const likeUrl = `%${url}%`
    const likeId = `%${id}%`

    const inModulesRaw = await db
      .from('module_instances')
      .leftJoin('post_modules', 'module_instances.id', 'post_modules.module_id')
      .leftJoin('posts', 'post_modules.post_id', 'posts.id')
      .where((query) => {
        // Exclude orphaned post-scoped modules (not attached to any post)
        query.where('module_instances.scope', 'global').orWhereNotNull('post_modules.id')
      })
      .andWhere((query) => {
        query
          .where((q) => {
            q.whereRaw(`module_instances.props::text ILIKE ?`, [likeUrl])
              .orWhereRaw(`COALESCE(module_instances.review_props::text, '') ILIKE ?`, [likeUrl])
              .orWhereRaw(`COALESCE(module_instances.ai_review_props::text, '') ILIKE ?`, [likeUrl])
          })
          .orWhere((q) => {
            q.whereRaw(`module_instances.props::text ILIKE ?`, [likeId])
              .orWhereRaw(`COALESCE(module_instances.review_props::text, '') ILIKE ?`, [likeId])
              .orWhereRaw(`COALESCE(module_instances.ai_review_props::text, '') ILIKE ?`, [likeId])
          })
      })
      .select(
        'module_instances.id',
        'module_instances.type',
        'module_instances.scope',
        'module_instances.global_slug as globalSlug',
        'posts.id as postId',
        'posts.title as postTitle'
      )
      .limit(20)

    const inOverridesRaw = await db
      .from('post_modules')
      .join('posts', 'post_modules.post_id', 'posts.id')
      .where((query) => {
        query
          .where((q) => {
            q.whereRaw(`post_modules.overrides::text ILIKE ?`, [likeUrl])
              .orWhereRaw(`COALESCE(post_modules.review_overrides::text, '') ILIKE ?`, [likeUrl])
              .orWhereRaw(`COALESCE(post_modules.ai_review_overrides::text, '') ILIKE ?`, [likeUrl])
          })
          .orWhere((q) => {
            q.whereRaw(`post_modules.overrides::text ILIKE ?`, [likeId])
              .orWhereRaw(`COALESCE(post_modules.review_overrides::text, '') ILIKE ?`, [likeId])
              .orWhereRaw(`COALESCE(post_modules.ai_review_overrides::text, '') ILIKE ?`, [likeId])
          })
      })
      .select('post_modules.id', 'posts.id as postId', 'posts.title as postTitle')
      .limit(20)

    const inPosts = await db
      .from('posts')
      .where('featured_media_id', id)
      .orWhereRaw(`COALESCE(review_draft::text, '') ILIKE ?`, [likeUrl])
      .orWhereRaw(`COALESCE(ai_review_draft::text, '') ILIKE ?`, [likeUrl])
      .orWhereRaw(`COALESCE(review_draft::text, '') ILIKE ?`, [likeId])
      .orWhereRaw(`COALESCE(ai_review_draft::text, '') ILIKE ?`, [likeId])
      .select('id', 'title', 'type')
      .limit(20)

    const inAgentExecutions = await db
      .from('agent_executions')
      .whereRaw(`response::text ILIKE ?`, [likeId])
      .orWhereRaw(`response::text ILIKE ?`, [likeUrl])
      .select('id', 'agent_id as agentId', 'created_at as createdAt')
      .limit(5)

    const inSettings = await db
      .from('site_settings')
      .where('logo_media_id', id)
      .orWhere('favicon_media_id', id)
      .orWhere('default_og_media_id', id)
      .select('id')

    return {
      inModules: inModulesRaw.map((m: any) => ({
        id: m.id,
        type: m.type,
        scope: m.scope,
        globalSlug: m.globalSlug,
        postId: m.postId,
        postTitle: m.postTitle,
      })),
      inOverrides: inOverridesRaw.map((o: any) => ({
        id: o.id,
        postId: o.postId,
        postTitle: o.postTitle,
      })),
      inPosts: inPosts.map((p: any) => ({ id: p.id, title: p.title, type: p.type })),
      inAgentExecutions: inAgentExecutions.map((e: any) => ({
        id: e.id,
        agentId: e.agentId,
        createdAt: e.createdAt,
      })),
      inSettings: inSettings.length > 0,
    }
  }

  private async getCodebaseUsage(url: string): Promise<string[]> {
    const filename = path.basename(url)
    if (!filename) return []

    const searchPaths = [
      path.join(process.cwd(), 'inertia'),
      path.join(process.cwd(), 'resources', 'views'),
      path.join(process.cwd(), 'app'),
    ]

    try {
      const pathsArg = searchPaths.map((p) => `"${p}"`).join(' ')
      const { stdout } = await execAsync(`grep -rl "${filename}" ${pathsArg} | head -n 10 || true`)
      return stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((p) => !p.includes('node_modules'))
        .map((p) => path.relative(process.cwd(), p))
    } catch {
      return []
    }
  }
}

export default new MediaUsageService()

