#!/usr/bin/env node
/**
 * Sync fixes from the Adonis EOS starter repository to downstream projects.
 *
 * This script uses git subtree merge to pull changes from the starter repo
 * into the current project. It's designed to be run from within a project
 * that was created from the starter kit.
 *
 * Usage:
 *   npm run sync:starter              # Sync latest from main branch
 *   npm run sync:starter:commit v0.1.1  # Sync specific tag/commit
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

const STARTER_REMOTE_NAME = 'starter'
const DEFAULT_BRANCH = 'main'

interface SyncOptions {
  commitOrTag?: string
  dryRun?: boolean
}

/**
 * Get the starter repository URL from package.json or use default
 */
function getStarterRepoUrl(): string {
  try {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))

    // Check if repository URL is defined
    if (packageJson.repository?.url) {
      return packageJson.repository.url.replace(/\.git$/, '')
    }
  } catch (error) {
    // Fall through to default
  }

  // Default to the public starter repo
  return 'https://github.com/spaced-man/adonis-eos-starter.git'
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
 * Check if starter remote exists
 */
function hasStarterRemote(): boolean {
  try {
    execSync(`git remote get-url ${STARTER_REMOTE_NAME}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Add or update the starter remote
 */
function ensureStarterRemote(repoUrl: string): void {
  if (hasStarterRemote()) {
    console.log(`✓ Starter remote already exists`)
    // Update URL in case it changed
    try {
      execSync(`git remote set-url ${STARTER_REMOTE_NAME} ${repoUrl}`, { stdio: 'ignore' })
    } catch {
      // Ignore errors
    }
  } else {
    console.log(`📦 Adding starter remote: ${repoUrl}`)
    execSync(`git remote add ${STARTER_REMOTE_NAME} ${repoUrl}`, { stdio: 'inherit' })
  }
}

/**
 * Fetch latest from starter repository
 */
function fetchStarter(target: string = DEFAULT_BRANCH): void {
  console.log(`\n🔄 Fetching latest from starter (${target})...`)
  try {
    execSync(`git fetch ${STARTER_REMOTE_NAME} ${target}`, { stdio: 'inherit' })
  } catch (error) {
    console.error(
      `\n❌ Failed to fetch from starter. Check your network connection and the repository URL.`
    )
    throw error
  }
}

/**
 * Show what files would change
 */
function showChanges(target: string): void {
  console.log(`\n📋 Files that would change from starter:`)
  try {
    const diff = execSync(`git diff --name-status HEAD ${STARTER_REMOTE_NAME}/${target}`, {
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
      `\n🔍 [DRY RUN] Would merge: git subtree pull --prefix=. ${STARTER_REMOTE_NAME} ${target} --squash`
    )
    return
  }

  console.log(`\n🔄 Merging changes from starter...`)
  try {
    execSync(
      `git subtree pull --prefix=. ${STARTER_REMOTE_NAME} ${target} --squash -m "Sync fixes from starter (${target})"`,
      { stdio: 'inherit' }
    )
    console.log(`\n✅ Successfully merged changes from starter!`)
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
 * Main sync function
 */
async function syncFromStarter(options: SyncOptions = {}): Promise<void> {
  const { commitOrTag, dryRun = false } = options

  console.log(`\n🚀 Adonis EOS Starter Sync Tool\n`)

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

  // Get starter repo URL
  const repoUrl = getStarterRepoUrl()
  console.log(`📍 Starter repository: ${repoUrl}`)

  // Determine target (commit/tag or branch)
  const target = commitOrTag || DEFAULT_BRANCH
  console.log(`🎯 Target: ${target}`)

  // Ensure remote exists
  ensureStarterRemote(repoUrl)

  // Fetch latest
  fetchStarter(target)

  // Show what would change
  showChanges(target)

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
syncFromStarter({ commitOrTag, dryRun }).catch((error) => {
  console.error(`\n❌ Sync failed:`, error.message)
  process.exit(1)
})
