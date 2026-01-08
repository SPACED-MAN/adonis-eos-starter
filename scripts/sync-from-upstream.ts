#!/usr/bin/env node
/**
 * Sync fixes from the  repository to downstream projects.
 *
 * This script uses git subtree merge to pull changes from the  repo
 * into the current project. It's designed to be run from within a project
 * that was created from the CMS instance.
 *
 * Usage:
 *   npm run sync:quality-ready              # Sync latest from main branch
 *   npm run sync:quality-ready:commit v0.1.1  # Sync specific tag/commit
 */

import { execSync } from 'child_process'
import { readFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'

const UPSTREAM_REMOTE_NAME = 'quality-ready'
const DEFAULT_BRANCH = 'main'

interface SyncOptions {
  commitOrTag?: string
  dryRun?: boolean
}

/**
 * Get the  repository URL from package.json or use default
 */
function getUpstreamRepoUrl(): string {
  try {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))

    // Check if repository URL is defined
    if (packageJson.repository?.url) {
      return packageJson.repository.url.replace(/\.git$/, '')
    }
  } catch (error) {
    // Fall through to default
  }

  // Default to the public  repo
  return 'https://github.com/spaced-man/quality-ready.git'
}

/**
 * Check if we're in a git repository
 */
function isGitRepo(): boolean {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Check if  remote exists
 */
function hasUpstreamRemote(): boolean {
  try {
    execSync(`git remote get-url ${UPSTREAM_REMOTE_NAME}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Add or update the  remote
 */
function ensureUpstreamRemote(repoUrl: string): void {
  if (hasUpstreamRemote()) {
    console.log(`✓  remote already exists`)
    // Update URL in case it changed
    try {
      execSync(`git remote set-url ${UPSTREAM_REMOTE_NAME} ${repoUrl}`, { stdio: 'ignore' })
    } catch {
      // Ignore errors
    }
  } else {
    console.log(`📦 Adding  remote: ${repoUrl}`)
    execSync(`git remote add ${UPSTREAM_REMOTE_NAME} ${repoUrl}`, { stdio: 'inherit' })
  }
}

/**
 * Fetch latest from  repository
 */
function fetchUpstream(target: string = DEFAULT_BRANCH): void {
  console.log(`\n🔄 Fetching latest from  (${target})...`)
  try {
    execSync(`git fetch ${UPSTREAM_REMOTE_NAME} ${target}`, { stdio: 'inherit' })
  } catch (error) {
    console.error(
      `\n❌ Failed to fetch from . Check your network connection and the repository URL.`
    )
    throw error
  }
}

/**
 * Show what files would change
 */
function showChanges(target: string): void {
  console.log(`\n📋 Files that would change from :`)
  try {
    const diff = execSync(`git diff --name-status HEAD ${UPSTREAM_REMOTE_NAME}/${target}`, {
      encoding: 'utf-8',
    })

    if (diff.trim()) {
      console.log(diff)
    } else {
      console.log('  (no changes detected)')
    }
  } catch (error) {
    // If there's no common ancestor, that's okay - we'll still try to merge
    console.log('  (unable to show diff - may be first sync)')
  }
}

/**
 * Perform the subtree merge
 */
function performSubtreeMerge(target: string, dryRun: boolean = false): void {
  if (dryRun) {
    console.log(
      `\n🔍 [DRY RUN] Would merge: git subtree pull --prefix=. ${UPSTREAM_REMOTE_NAME} ${target} --squash`
    )
    return
  }

  console.log(`\n🔄 Merging changes from ...`)
  try {
    execSync(
      `git subtree pull --prefix=. ${UPSTREAM_REMOTE_NAME} ${target} --squash -m "Sync fixes from  (${target})"`,
      { stdio: 'inherit' }
    )
    console.log(`\n✅ Successfully merged changes from !`)
  } catch (error) {
    console.error(`\n❌ Merge failed. You may need to resolve conflicts manually.`)
    console.error(`\n💡 Tip: Use 'git status' to see conflicted files.`)
    throw error
  }
}

/**
 * Check for merge conflicts
 */
function checkConflicts(): boolean {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' })
    const hasConflicts = status.includes('UU') || status.includes('AA') || status.includes('DD')

    if (hasConflicts) {
      console.log(`\n⚠️  Merge conflicts detected!`)
      console.log(`\n📝 Conflicted files:`)
      execSync('git diff --name-only --diff-filter=U', { stdio: 'inherit' })
      console.log(`\n💡 Resolve conflicts manually, then:`)
      console.log(`   git add <resolved-files>`)
      console.log(`   git commit`)
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Ensure destination directories exist for incoming files
 */
function ensureDirectories(target: string, dryRun: boolean = false): void {
  try {
    const diff = execSync(`git diff --name-status HEAD ${UPSTREAM_REMOTE_NAME}/${target}`, {
      encoding: 'utf-8',
    })

    const lines = diff.split('\n').filter(Boolean)
    for (const line of lines) {
      const parts = line.split(/\s+/)
      const status = parts[0]
      // For renames (R), the new path is in parts[2]
      const filePath = status.startsWith('R') ? parts[2] : parts[1]

      if (status === 'A' || status === 'M' || status.startsWith('R')) {
        const dir = dirname(filePath)
        if (dir !== '.' && !existsSync(dir)) {
          if (dryRun) {
            console.log(`🔍 [DRY RUN] Would create directory: ${dir}`)
          } else {
            console.log(`📁 Creating directory: ${dir}`)
            mkdirSync(dir, { recursive: true })
          }
        }
      }
    }
  } catch (error) {
    // If diff fails, it might be because there's no common ancestor yet
    // In that case, we can try to list all files in the target
    try {
      const files = execSync(`git ls-tree -r --name-only ${UPSTREAM_REMOTE_NAME}/${target}`, {
        encoding: 'utf-8',
      })
      const lines = files.split('\n').filter(Boolean)
      for (const filePath of lines) {
        const dir = dirname(filePath)
        if (dir !== '.' && !existsSync(dir)) {
          if (dryRun) {
            console.log(`🔍 [DRY RUN] Would create directory: ${dir}`)
          } else {
            console.log(`📁 Creating directory: ${dir}`)
            mkdirSync(dir, { recursive: true })
          }
        }
      }
    } catch (e) {
      // Ignore if both fail
    }
  }
}

/**
 * Main sync function
 */
async function syncFromUpstream(options: SyncOptions = {}): Promise<void> {
  const { commitOrTag, dryRun = false } = options

  console.log(`\n🚀  Sync Tool\n`)

  // Validate we're in a git repo
  if (!isGitRepo()) {
    console.error(`❌ Error: Not in a git repository.`)
    console.error(`   This script must be run from within a git-initialized project.`)
    process.exit(1)
  }

  // Check for uncommitted changes
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' })
    if (status.trim() && !dryRun) {
      console.error(`\n❌ Error: You have uncommitted changes.`)
      console.error(`   Please commit or stash your changes before syncing.`)
      console.error(`\n   Uncommitted files:`)
      console.error(status)
      process.exit(1)
    }
  } catch {
    // Ignore - might be in a weird state
  }

  // Get upstream repo URL
  const repoUrl = getUpstreamRepoUrl()
  console.log(`📍  repository: ${repoUrl}`)

  // Determine target (commit/tag or branch)
  const target = commitOrTag || DEFAULT_BRANCH
  console.log(`🎯 Target: ${target}`)

  // Ensure remote exists
  ensureUpstreamRemote(repoUrl)

  // Fetch latest
  fetchUpstream(target)

  // Show what would change
  showChanges(target)

  // Ensure directories exist for incoming files
  ensureDirectories(target, dryRun)

  // Perform merge
  performSubtreeMerge(target, dryRun)

  if (!dryRun) {
    // Check for conflicts
    const hasConflicts = checkConflicts()

    if (!hasConflicts) {
      console.log(`\n✨ Sync complete! Review the changes and test before deploying.`)
      console.log(`\n📝 Next steps:`)
      console.log(`   1. Review changes: git log -1`)
      console.log(`   2. Test your application`)
      console.log(`   3. Commit if everything looks good`)
    }
  } else {
    console.log(`\n🔍 Dry run complete. Run without --dry-run to apply changes.`)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const commitOrTag = args.find((arg) => !arg.startsWith('--'))
const dryRun = args.includes('--dry-run') || args.includes('-d')

// Run sync
syncFromUpstream({ commitOrTag, dryRun }).catch((error: any) => {
  console.error(`\n❌ Sync failed:`, error.message)
  process.exit(1)
})
