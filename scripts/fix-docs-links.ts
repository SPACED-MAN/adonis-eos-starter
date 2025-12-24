import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Maps CMS slugs to markdown file paths
 * This mirrors the logic in documentation_seeder.ts
 */
const slugToFileMap: Record<string, { file: string; dir: string }> = {
  // Root
  overview: { file: '00-index.md', dir: 'root' },
  
  // Editors
  editors: { file: '00-quick-start.md', dir: 'editors' },
  'content-management': { file: '01-content-management.md', dir: 'editors' },
  'roles-permissions': { file: '02-roles-permissions.md', dir: 'editors' },
  'review-workflow': { file: '03-review-workflow.md', dir: 'editors' },
  media: { file: '04-media.md', dir: 'editors' },
  translations: { file: '05-translations.md', dir: 'editors' },
  'modules-guide': { file: '06-modules-guide.md', dir: 'editors' },
  'seo-and-ab-testing': { file: '07-seo-and-ab-testing.md', dir: 'editors' },
  
  // Developers
  developers: { file: '00-getting-started.md', dir: 'developers' },
  'content-management-overview': { file: '01-content-management-overview.md', dir: 'developers' },
  theming: { file: '02-theming.md', dir: 'developers' },
  'building-modules': { file: '03-building-modules.md', dir: 'developers' },
  'api-reference': { file: '04-api-reference.md', dir: 'developers' },
  'automation-and-integrations': { file: '05-automation-and-integrations.md', dir: 'developers' },
  'seo-and-routing': { file: '06-seo-and-routing.md', dir: 'developers' },
  internationalization: { file: '07-internationalization.md', dir: 'developers' },
  taxonomies: { file: '08-taxonomies.md', dir: 'developers' },
  'ai-agents': { file: '09-ai-agents.md', dir: 'developers' },
  mcp: { file: '10-mcp.md', dir: 'developers' },
  'cli-and-operations': { file: '12-cli-and-operations.md', dir: 'developers' },
  'review-workflow-developers': { file: '13-review-workflow.md', dir: 'developers' },
  'media-pipeline': { file: '14-media-pipeline.md', dir: 'developers' },
  'preview-system': { file: '15-preview-system.md', dir: 'developers' },
  menus: { file: '16-menus.md', dir: 'developers' },
  'custom-fields': { file: '17-custom-fields.md', dir: 'developers' },
  'rbac-and-permissions': { file: '18-rbac-and-permissions.md', dir: 'developers' },
  deployment: { file: '19-deployment.md', dir: 'developers' },
  'update-philosophy': { file: '20-update-philosophy.md', dir: 'developers' },
  'advanced-customization': { file: '22-advanced-customization.md', dir: 'developers' },
  'user-interaction': { file: '24-user-interaction.md', dir: 'developers' },
}

/**
 * Convert CMS path to relative markdown path
 */
function cmsPathToRelative(
  cmsPath: string,
  currentFile: { file: string; dir: string }
): string {
  // Handle /docs/for-developers and /docs/for-editors
  let normalizedPath = cmsPath
    .replace('/docs/for-developers', '/docs/developers')
    .replace('/docs/for-editors', '/docs/editors')
  
  // Handle root paths: /docs/developers or /docs/editors
  const rootMatch = normalizedPath.match(/^\/docs\/(developers|editors)$/)
  if (rootMatch) {
    const rootSlug = rootMatch[1] === 'developers' ? 'developers' : 'editors'
    const target = slugToFileMap[rootSlug]
    if (target) {
      return getRelativePath(currentFile, target)
    }
    return cmsPath
  }
  
  // Handle nested paths: /docs/developers/theming or /docs/editors/content-management
  const nestedMatch = normalizedPath.match(/^\/docs\/(developers|editors)\/(.+)$/)
  if (nestedMatch) {
    const slug = nestedMatch[2]
    const target = slugToFileMap[slug]
    if (target) {
      return getRelativePath(currentFile, target)
    }
    return cmsPath
  }
  
  // Handle /docs/overview
  if (normalizedPath === '/docs/overview') {
    const target = slugToFileMap['overview']
    if (target) {
      return getRelativePath(currentFile, target)
    }
  }
  
  return cmsPath // Return as-is if we can't resolve
}

/**
 * Get relative path from current file to target file
 */
function getRelativePath(
  current: { file: string; dir: string },
  target: { file: string; dir: string }
): string {
  // Same file
  if (current.file === target.file && current.dir === target.dir) {
    return target.file
  }
  
  // Same directory
  if (current.dir === target.dir) {
    return target.file
  }
  
  // Different directories
  if (current.dir === 'root') {
    // From root to subdirectory
    return `${target.dir}/${target.file}`
  } else if (target.dir === 'root') {
    // From subdirectory to root
    return `../${target.file}`
  } else {
    // Between subdirectories
    return `../${target.dir}/${target.file}`
  }
}

/**
 * Replace CMS paths with relative markdown paths in content
 */
function replaceCmsPaths(
  content: string,
  currentFile: { file: string; dir: string }
): string {
  // Match markdown links: [text](/docs/...)
  return content.replace(
    /\[([^\]]+)\]\((\/docs\/[^)]+)\)/g,
    (_match, text, path) => {
      const relativePath = cmsPathToRelative(path, currentFile)
      return `[${text}](${relativePath})`
    }
  )
}

async function main() {
  const docsPath = join(process.cwd(), 'docs')
  const files: Array<{ file: string; path: string; dir: string }> = []
  
  // Collect all markdown files
  try {
    const rootFiles = await readdir(docsPath)
    for (const file of rootFiles.filter((f) => f.endsWith('.md'))) {
      files.push({ file, path: join(docsPath, file), dir: 'root' })
    }
  } catch {}
  
  try {
    const editorsPath = join(docsPath, 'editors')
    const editorFiles = await readdir(editorsPath)
    for (const file of editorFiles.filter((f) => f.endsWith('.md'))) {
      files.push({ file, path: join(editorsPath, file), dir: 'editors' })
    }
  } catch {}
  
  try {
    const developersPath = join(docsPath, 'developers')
    const developerFiles = await readdir(developersPath)
    for (const file of developerFiles.filter((f) => f.endsWith('.md'))) {
      files.push({ file, path: join(developersPath, file), dir: 'developers' })
    }
  } catch {}
  
  // Process each file
  for (const fileInfo of files) {
    const content = await readFile(fileInfo.path, 'utf-8')
    const updated = replaceCmsPaths(content, fileInfo)
    
    if (content !== updated) {
      await writeFile(fileInfo.path, updated, 'utf-8')
      console.log(`✓ Updated ${fileInfo.dir}/${fileInfo.file}`)
    }
  }
  
  console.log('\n✅ All markdown files updated with relative paths!')
}

main().catch(console.error)

