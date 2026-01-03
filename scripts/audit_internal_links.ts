import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'
import { fileURLToPath } from 'node:url'

/**
 * Scan content for hardcoded internal URLs that should use post references.
 *
 * Usage:
 *   tsx scripts/audit_internal_links.ts
 */

const appRoot = new URL('../', import.meta.url)

new Ignitor(appRoot, { logger: true })
  .tap((app) => {
    app.booting(async () => {
      await app.init()
      await app.boot()
    })
  })
  .run(async (app) => {
    const db = await app.container.make('lucid.db')
    console.log('🔍 Scanning for hardcoded internal URLs...\n')

    const issues: Array<{
      location: string
      postId: string
      postTitle: string
      postType: string
      field: string
      value: string
      suggestion: string
    }> = []

    const internalPatterns = [
      /^\/[^/]/,
      /^https?:\/\/localhost/,
      /^https?:\/\/127\.0\.0\.1/,
    ]

    // Scan module instances
    const modules = await db
      .from('module_instances')
      .select('id', 'type', 'props', 'scope', 'global_slug')

    for (const module of modules) {
      const props = module.props || {}
      const findings = scanObject(props, internalPatterns)

      if (findings.length > 0) {
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
      const findings = scanObject(cf.value, internalPatterns)
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

    if (issues.length === 0) {
      console.log('✅ No hardcoded internal URLs found!')
      return
    }

    console.warn(`⚠️  Found ${issues.length} hardcoded internal URL(s):\n`)

    const byPost = new Map<string, typeof issues>()
    for (const issue of issues) {
      const key = `${issue.postId}|${issue.postTitle}`
      if (!byPost.has(key)) {
        byPost.set(key, [])
      }
      byPost.get(key)!.push(issue)
    }

    for (const [, postIssues] of byPost.entries()) {
      const first = postIssues[0]
      console.log(`📄 ${first.postTitle} (${first.postType}) - ID: ${first.postId}`)

      for (const issue of postIssues) {
        console.log(`   ${issue.location}`)
        console.log(`   Field: ${issue.field}`)
        console.log(`   Value: ${issue.value}`)
        console.log(`   ${issue.suggestion}`)
        console.log('')
      }
    }

    console.warn(`\n⚠️  Total: ${issues.length} issue(s) across ${byPost.size} post(s)`)
    console.log(
      '\n💡 To fix these, edit the posts in the admin and switch to "Existing post" mode for internal links.\n'
    )
  })

function scanObject(
  obj: any,
  patterns: RegExp[],
  path = ''
): Array<{ path: string; value: string; suggestion: string }> {
  const findings: Array<{ path: string; value: string; suggestion: string }> = []

  if (!obj || typeof obj !== 'object') return findings

  if (obj.kind === 'url' && typeof obj.url === 'string') {
    if (patterns.some((p) => p.test(obj.url))) {
      findings.push({
        path: path || 'url',
        value: obj.url,
        suggestion: 'Convert to { kind: "post", postId: "...", ... }',
      })
    }
  }

  if (typeof obj === 'string') {
    if (patterns.some((p) => p.test(obj))) {
      findings.push({
        path: path || 'value',
        value: obj,
        suggestion: 'Use post reference instead of hardcoded URL',
      })
    }
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      const itemPath = path ? `${path}[${idx}]` : `[${idx}]`
      findings.push(...scanObject(item, patterns, itemPath))
    })
  } else {
    for (const [key, value] of Object.entries(obj)) {
      const keyPath = path ? `${path}.${key}` : key
      findings.push(...scanObject(value, patterns, keyPath))
    }
  }

  return findings
}

