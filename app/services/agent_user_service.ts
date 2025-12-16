import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import type { AgentDefinition } from '#types/agent_types'

function sanitizeToken(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildDefaultEmail(agentId: string): string {
  const token = sanitizeToken(agentId) || 'agent'
  // Ensure the local-part stays within reasonable bounds.
  const local = `agent+${token}`.slice(0, 64)
  return `${local}@agents.local`
}

function buildDefaultUsername(agentId: string): string {
  const token = sanitizeToken(agentId) || 'agent'
  // 50 char limit in migration; keep prefix + token within that.
  const prefix = 'agent:'
  const available = 50 - prefix.length
  return `${prefix}${token.slice(0, Math.max(0, available))}`
}

async function findUniqueEmail(preferredEmail: string): Promise<string> {
  const base = preferredEmail.trim().toLowerCase()
  if (!base) return buildDefaultEmail('agent')
  const existing = await User.findBy('email', base)
  if (!existing) return base

  // If taken, suffix incrementally.
  const [local, domain] = base.split('@')
  const safeDomain = domain || 'agents.local'
  for (let i = 2; i < 1000; i++) {
    const candidateLocal = `${local}-${i}`.slice(0, 64)
    const candidate = `${candidateLocal}@${safeDomain}`
    const taken = await User.findBy('email', candidate)
    if (!taken) return candidate
  }
  // fallback: should never happen
  return `${base}.${Date.now()}@agents.local`
}

async function findUniqueUsername(preferredUsername: string | null): Promise<string | null> {
  const base = preferredUsername ? preferredUsername.trim() : ''
  if (!base) return null

  // Case-insensitive unique index; rely on DB constraint by probing via query.
  const existing = await User.query().whereRaw('LOWER(username) = LOWER(?)', [base]).first()
  if (!existing) return base

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`.slice(0, 50)
    const taken = await User.query().whereRaw('LOWER(username) = LOWER(?)', [candidate]).first()
    if (!taken) return candidate
  }

  return null
}

export async function getUserIdForAgent(agentId: string): Promise<number | null> {
  const username = buildDefaultUsername(agentId)
  try {
    const u = await User.query().whereRaw('LOWER(username) = LOWER(?)', [username]).first()
    return u?.id ?? null
  } catch {
    return null
  }
}

export type SyncAgentUsersOptions = {
  /**
   * Disable bootstrap entirely (useful for some test/CI flows).
   */
  disabled?: boolean
}

class AgentUserService {
  /**
   * Create or update per-agent user accounts for attribution.
   *
   * - Idempotent: safe to run at every boot.
   * - Non-destructive: will not delete users; will not overwrite passwords for existing users.
   * - Least privilege: assigns role `ai_agent`.
   */
  async syncAtBoot(agents: AgentDefinition[], options: SyncAgentUsersOptions = {}): Promise<void> {
    if (options.disabled) return
    if (process.env.AGENT_USERS_BOOTSTRAP_DISABLED === '1') return

    let created = 0
    let updated = 0

    for (const agent of agents) {
      try {
        const cfg = agent.userAccount
        if (!cfg) continue
        if (cfg.enabled === false) continue
        if (cfg.createAtBoot === false) continue
        if (agent.enabled === false) continue

        // Use stable "default" identifiers to allow MCP to map agentId -> user reliably.
        // Only use custom email/username if explicitly provided.
        const stableUsername = cfg.username
          ? await findUniqueUsername(cfg.username)
          : buildDefaultUsername(agent.id)
        const username = stableUsername || buildDefaultUsername(agent.id)

        // Determine email:
        // - If a custom email is provided, try to use it (unique).
        // - Otherwise, generate an internal email based on agent id, but de-conflict if necessary.
        const preferredEmail = cfg.email?.trim() ? cfg.email.trim() : buildDefaultEmail(agent.id)

        // Prefer finding by username (stable agentId -> user mapping).
        let existing =
          (await User.query().whereRaw('LOWER(username) = LOWER(?)', [username]).first()) || null

        // If not found by username, also check by preferred email to avoid duplicates
        // (e.g., when users were imported from development-export.json)
        if (!existing) {
          const existingByEmail = await User.findBy('email', preferredEmail)
          if (existingByEmail && existingByEmail.role === 'ai_agent') {
            existing = existingByEmail
          }
        }

        // Only generate a unique email if we're creating a new user
        const email = existing ? existing.email : await findUniqueEmail(preferredEmail)

        if (existing) {
          // Update metadata (but do not rotate password). Avoid changing email unless:
          // - userAccount.email is explicitly set (operator intent), AND
          // - the email differs.
          existing.fullName = agent.name
          existing.role = 'ai_agent'
          existing.username = username

          if (cfg.email?.trim() && existing.email !== email) {
            existing.email = email
          }

          await existing.save()
          updated++
        } else {
          const pwd = await hash.make(`agent:${agent.id}:${Date.now()}`)
          const user = new User()
          user.email = email
          user.password = pwd
          user.fullName = agent.name
          user.role = 'ai_agent'
          user.username = username
          await user.save()
          created++
        }
      } catch {
        // Never crash app boot for agent user provisioning.
      }
    }

    if (process.env.NODE_ENV === 'development' && process.env.MCP_QUIET !== '1') {
      if (created > 0 || updated > 0) {
        console.log(`👤 Agent users synced: ${created} created, ${updated} updated`)
      }
    }
  }
}

export default new AgentUserService()
