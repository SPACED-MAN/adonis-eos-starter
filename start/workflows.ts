/**
 * Bootstrap file for workflow registry
 * Scans app/workflows directory and registers all workflow definitions
 */

import { getDirname } from '@adonisjs/core/helpers'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import workflowRegistry from '#services/workflow_registry'
import type { WorkflowDefinition } from '#types/workflow_types'
import workflowUserService from '#services/workflow_user_service'

const workflowsPath = join(getDirname(import.meta.url), '..', 'app', 'workflows')

try {
  // Read all files in the workflows directory
  const files = await readdir(workflowsPath)

  // Filter for .ts and .js files (excluding .d.ts)
  const workflowFiles = files.filter(
    (file) => (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts')
  )

  // Import and register each workflow definition
  for (const file of workflowFiles) {
    try {
      const modulePath = join(workflowsPath, file)
      const module = await import(modulePath)
      const definition: WorkflowDefinition = module.default

      if (!definition || !definition.id) {
        console.warn(`⚠️  Workflow file ${file} does not export a valid WorkflowDefinition`)
        continue
      }

      workflowRegistry.register(definition)

      // In development, log registered workflows
      if (process.env.NODE_ENV === 'development' && process.env.MCP_QUIET !== '1') {
        console.log(`✓ Registered workflow: ${definition.name} (${definition.id})`)
      }
    } catch (error) {
      console.error(`❌ Failed to load workflow from ${file}:`, error)
    }
  }

  // Log summary
  const enabledCount = workflowRegistry.listEnabled().length
  const totalCount = workflowRegistry.list().length

  if (process.env.NODE_ENV === 'development' && process.env.MCP_QUIET !== '1') {
    console.log(`\n⚙️  Workflow Registry: ${enabledCount}/${totalCount} workflows enabled`)
  }

  // Boot-time provisioning of per-workflow user accounts (for attribution)
  await workflowUserService.syncAtBoot(workflowRegistry.listEnabled())
} catch (error) {
  // If the workflows directory doesn't exist yet, that's okay
  if ((error as any).code !== 'ENOENT') {
    console.error('❌ Failed to bootstrap workflow registry:', error)
  }
}
