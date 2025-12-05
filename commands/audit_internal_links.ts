import { BaseCommand } from '@adonisjs/core/ace'
import { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

export default class AuditInternalLinks extends BaseCommand {
  static commandName = 'audit:internal-links'
  static description = 'Scan content for hardcoded internal URLs that should use post references'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    this.logger.info('🔍 Scanning for hardcoded internal URLs...\n')

    const issues: Array<{
      location: string
      postId: string
      postTitle: string
      postType: string
      field: string
      value: string
      suggestion: string
    }> = []

    // Get current domain patterns to detect
    const internalPatterns = [
      /^\/[^/]/, // Relative paths starting with /
      /^https?:\/\/localhost/,
      /^https?:\/\/127\.0\.0\.1/,
    ]

    // Scan module instances (both global and post-specific)
    const modules = await db
      .from('module_instances')
      .select('id', 'type', 'props', 'scope', 'global_slug')

    for (const module of modules) {
      const props = module.props || {}
      const findings = this.scanObject(props, internalPatterns)

      if (findings.length > 0) {
        // Get posts using this module
        const postModules = await db
          .from('post_modules')
          .join('posts', 'post_modules.post_id', 'posts.id')
          .where('post_modules.module_id', module.id)
          .select('posts.id', 'posts.title', 'posts.type', 'posts.slug')

        if (postModules.length > 0) {
          for (const pm of postModules) {
            for (const finding of findings) {
              issues.push({
                location: `Module: ${module.type}`,
                postId: String(pm.id),
                postTitle: pm.title || pm.slug,
                postType: pm.type,
                field: finding.path,
                value: finding.value,
                suggestion: finding.suggestion,
              })
            }
          }
        } else if (module.scope === 'global') {
          // Global module not attached to any post
          for (const finding of findings) {
            issues.push({
              location: `Global Module: ${module.type} (${module.global_slug})`,
              postId: 'N/A',
              postTitle: 'N/A',
              postType: 'N/A',
              field: finding.path,
              value: finding.value,
              suggestion: finding.suggestion,
            })
          }
        }
      }
    }

    // Scan custom field values
    const customFields = await db
      .from('post_custom_field_values')
      .join('posts', 'post_custom_field_values.post_id', 'posts.id')
      .select(
        'post_custom_field_values.field_slug',
        'post_custom_field_values.value',
        'posts.id as post_id',
        'posts.title',
        'posts.type',
        'posts.slug'
      )

    for (const cf of customFields) {
      const findings = this.scanObject(cf.value, internalPatterns)
      if (findings.length > 0) {
        for (const finding of findings) {
          issues.push({
            location: `Custom Field: ${cf.field_slug}`,
            postId: String(cf.post_id),
            postTitle: cf.title || cf.slug,
            postType: cf.type,
            field: finding.path,
            value: finding.value,
            suggestion: finding.suggestion,
          })
        }
      }
    }

    // Report findings
    if (issues.length === 0) {
      this.logger.success('✅ No hardcoded internal URLs found!')
      return
    }

    this.logger.warning(`⚠️  Found ${issues.length} hardcoded internal URL(s):\n`)

    // Group by post
    const byPost = new Map<string, typeof issues>()
    for (const issue of issues) {
      const key = `${issue.postId}|${issue.postTitle}`
      if (!byPost.has(key)) {
        byPost.set(key, [])
      }
      byPost.get(key)!.push(issue)
    }

    for (const [key, postIssues] of byPost.entries()) {
      const first = postIssues[0]
      this.logger.info(
        `📄 ${first.postTitle} (${first.postType}) - ID: ${first.postId}`
      )

      for (const issue of postIssues) {
        this.logger.info(`   ${issue.location}`)
        this.logger.info(`   Field: ${issue.field}`)
        this.logger.info(`   Value: ${this.colors.yellow(issue.value)}`)
        this.logger.info(`   ${this.colors.cyan(issue.suggestion)}`)
        this.logger.info('')
      }
    }

    this.logger.warning(
      `\n⚠️  Total: ${issues.length} issue(s) across ${byPost.size} post(s)`
    )
    this.logger.info(
      '\n💡 To fix these, edit the posts in the admin and switch to "Existing post" mode for internal links.\n'
    )
  }

  private scanObject(
    obj: any,
    patterns: RegExp[],
    path = ''
  ): Array<{ path: string; value: string; suggestion: string }> {
    const findings: Array<{ path: string; value: string; suggestion: string }> = []

    if (!obj || typeof obj !== 'object') return findings

    // Check for link objects
    if (obj.kind === 'url' && typeof obj.url === 'string') {
      if (patterns.some((p) => p.test(obj.url))) {
        findings.push({
          path: path || 'url',
          value: obj.url,
          suggestion: 'Convert to { kind: "post", postId: "...", ... }',
        })
      }
    }

    // Check for plain URL strings
    if (typeof obj === 'string') {
      if (patterns.some((p) => p.test(obj))) {
        findings.push({
          path: path || 'value',
          value: obj,
          suggestion: 'Use post reference instead of hardcoded URL',
        })
      }
    }

    // Recurse through arrays
    if (Array.isArray(obj)) {
      obj.forEach((item, idx) => {
        const itemPath = path ? `${path}[${idx}]` : `[${idx}]`
        findings.push(...this.scanObject(item, patterns, itemPath))
      })
    }

    // Recurse through object properties
    for (const [key, value] of Object.entries(obj)) {
      const keyPath = path ? `${path}.${key}` : key
      findings.push(...this.scanObject(value, patterns, keyPath))
    }

    return findings
  }
}

