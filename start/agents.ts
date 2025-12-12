/**
 * Bootstrap file for agent registry
 * Scans app/agents directory and registers all agent definitions
 */

import { getDirname } from '@adonisjs/core/helpers'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import agentRegistry from '#services/agent_registry'
import type { AgentDefinition } from '#types/agent_types'

const agentsPath = join(getDirname(import.meta.url), '..', 'app', 'agents')

try {
  // Read all files in the agents directory
  const files = await readdir(agentsPath)

  // Filter for .ts and .js files (excluding .d.ts)
  const agentFiles = files.filter(
    (file) => (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts')
  )

  // Import and register each agent definition
  for (const file of agentFiles) {
    try {
      const modulePath = join(agentsPath, file)
      const module = await import(modulePath)
      const definition: AgentDefinition = module.default

      if (!definition || !definition.id) {
        console.warn(`⚠️  Agent file ${file} does not export a valid AgentDefinition`)
        continue
      }

      agentRegistry.register(definition)

      // In development, log registered agents
      if (process.env.NODE_ENV === 'development' && process.env.MCP_QUIET !== '1') {
        console.log(`✓ Registered agent: ${definition.name} (${definition.id})`)
      }
    } catch (error) {
      console.error(`❌ Failed to load agent from ${file}:`, error)
    }
  }

  // Log summary
  const enabledCount = agentRegistry.listEnabled().length
  const totalCount = agentRegistry.list().length

  if (process.env.NODE_ENV === 'development' && process.env.MCP_QUIET !== '1') {
    console.log(`\n📋 Agent Registry: ${enabledCount}/${totalCount} agents enabled`)
  }
} catch (error) {
  // If the agents directory doesn't exist yet, that's okay
  if ((error as any).code !== 'ENOENT') {
    console.error('❌ Failed to bootstrap agent registry:', error)
  }
}
