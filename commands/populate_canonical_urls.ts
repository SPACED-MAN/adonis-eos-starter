import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Post from '#models/post'
import urlPatternService from '#services/url_pattern_service'

/**
 * Populate canonical URLs for all posts that don't have one set.
 * This is useful after migrating or when canonical URLs weren't automatically set.
 */
export default class PopulateCanonicalUrls extends BaseCommand {
  static commandName = 'populate:canonical-urls'
  static description = "Populate canonical URLs for all posts that don't have one set"

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('Populating canonical URLs for posts...')

    // Get all posts that don't have a canonical URL
    const posts = await Post.query().whereNull('canonical_url')

    if (posts.length === 0) {
      this.logger.success('All posts already have canonical URLs set')
      return
    }

    this.logger.info(`Found ${posts.length} posts without canonical URLs`)

    let updated = 0
    let failed = 0

    for (const post of posts) {
      try {
        const canonicalPath = await urlPatternService.buildPostPathForPost(post.id)
        post.canonicalUrl = canonicalPath
        await post.save()
        updated++

        if (updated % 10 === 0) {
          this.logger.info(`Progress: ${updated}/${posts.length} posts updated`)
        }
      } catch (error) {
        failed++
        this.logger.warning(`Failed to set canonical URL for post ${post.id}: ${error.message}`)
      }
    }

    this.logger.success(`✓ Updated ${updated} posts`)
    if (failed > 0) {
      this.logger.warning(`✗ Failed to update ${failed} posts`)
    }
  }
}
