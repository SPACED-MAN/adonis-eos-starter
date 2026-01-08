/**
 * Roles bootstrap (code-first, registry-based)
 *
 * Register all roles from app/roles and expose them via the role registry.
 */

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import app from '@adonisjs/core/services/app'
import roleRegistry from '#services/role_registry'
import type { RoleDefinition } from '#types/role_types'

// Auto-register all roles found in app/roles/*
try {
  const dir = app.makePath('app', 'roles')
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    for (const file of files) {
      try {
        const full = path.join(dir, file)
        const mod = await import(pathToFileURL(full).href)
        const def = (mod?.default || mod) as RoleDefinition | RoleDefinition[]
        if (Array.isArray(def)) {
          for (const item of def) {
            if (item && typeof item === 'object') {
              roleRegistry.register(item)
            }
          }
        } else if (def && typeof def === 'object') {
          roleRegistry.register(def)
        }
      } catch {
        // Skip broken role defs; do not crash boot
      }
    }
  }
} catch {
  // Ignore FS errors at boot
}

// Log registered roles (development only)
if (process.env.NODE_ENV === 'development' && process.env.MCP_QUIET !== '1') {
  const roles = roleRegistry.list()
  console.log(
    `👤 Registered ${roles.length} roles: ${roles.map((r) => `${r.name} (${r.label})`).join(', ')}`
  )
}
