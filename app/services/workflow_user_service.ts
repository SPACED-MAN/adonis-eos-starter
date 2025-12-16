import hash from '@adonisjs/core/services/hash'
import User from '#models/user'
import type { WorkflowDefinition } from '#types/workflow_types'

function sanitizeToken(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._+-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildDefaultEmail(workflowId: string): string {
  const token = sanitizeToken(workflowId) || 'workflow'
  const local = `workflow+${token}`.slice(0, 64)
  return `${local}@workflows.local`
}

function buildDefaultUsername(workflowId: string): string {
  const token = sanitizeToken(workflowId) || 'workflow'
  const prefix = 'workflow:'
  const available = 50 - prefix.length
  return `${prefix}${token.slice(0, Math.max(0, available))}`
}

async function findUniqueEmail(preferredEmail: string): Promise<string> {
  const base = preferredEmail.trim().toLowerCase()
  if (!base) return buildDefaultEmail('workflow')
  const existing = await User.findBy('email', base)
  if (!existing) return base

  const [local, domain] = base.split('@')
  const safeDomain = domain || 'workflows.local'
  for (let i = 2; i < 1000; i++) {
    const candidateLocal = `${local}-${i}`.slice(0, 64)
    const candidate = `${candidateLocal}@${safeDomain}`
    const taken = await User.findBy('email', candidate)
    if (!taken) return candidate
  }
  return `${base}.${Date.now()}@workflows.local`
}

async function findUniqueUsername(preferredUsername: string | null): Promise<string | null> {
  const base = preferredUsername ? preferredUsername.trim() : ''
  if (!base) return null

  const existing = await User.query().whereRaw('LOWER(username) = LOWER(?)', [base]).first()
  if (!existing) return base

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`.slice(0, 50)
    const taken = await User.query().whereRaw('LOWER(username) = LOWER(?)', [candidate]).first()
    if (!taken) return candidate
  }

  return null
}

export async function getUserIdForWorkflow(workflowId: string): Promise<number | null> {
  const username = buildDefaultUsername(workflowId)
  try {
    const u = await User.query().whereRaw('LOWER(username) = LOWER(?)', [username]).first()
    return u?.id ?? null
  } catch {
    return null
  }
}

class WorkflowUserService {
  /**
   * Create or update per-workflow user accounts for attribution.
   *
   * - Idempotent: safe to run at every boot.
   * - Non-destructive: will not delete users; will not overwrite passwords for existing users.
   * - Least privilege: assigns role `workflow`.
   */
  async syncAtBoot(workflows: WorkflowDefinition[]): Promise<void> {
    if (process.env.WORKFLOW_USERS_BOOTSTRAP_DISABLED === '1') return

    let created = 0
    let updated = 0

    for (const workflow of workflows) {
      try {
        const cfg = workflow.userAccount
        if (!cfg) continue
        if (cfg.enabled === false) continue
        if (cfg.createAtBoot === false) continue
        if (workflow.enabled === false) continue

        const stableUsername = cfg.username
          ? await findUniqueUsername(cfg.username)
          : buildDefaultUsername(workflow.id)
        const username = stableUsername || buildDefaultUsername(workflow.id)

        const preferredEmail = cfg.email?.trim() ? cfg.email.trim() : buildDefaultEmail(workflow.id)

        let existing =
          (await User.query().whereRaw('LOWER(username) = LOWER(?)', [username]).first()) || null

        if (!existing) {
          const existingByEmail = await User.findBy('email', preferredEmail)
          if (existingByEmail && existingByEmail.role === 'workflow') {
            existing = existingByEmail
          }
        }

        const email = existing ? existing.email : await findUniqueEmail(preferredEmail)

        if (existing) {
          existing.fullName = workflow.name
          existing.role = 'workflow'
          existing.username = username

          if (cfg.email?.trim() && existing.email !== email) {
            existing.email = email
          }

          await existing.save()
          updated++
        } else {
          const pwd = await hash.make(`workflow:${workflow.id}:${Date.now()}`)
          const user = new User()
          user.email = email
          user.password = pwd
          user.fullName = workflow.name
          user.role = 'workflow'
          user.username = username
          await user.save()
          created++
        }
      } catch {
        // Never crash app boot for workflow user provisioning.
      }
    }

    if (process.env.NODE_ENV === 'development' && process.env.MCP_QUIET !== '1') {
      if (created > 0 || updated > 0) {
        console.log(`👤 Workflow users synced: ${created} created, ${updated} updated`)
      }
    }
  }
}

export default new WorkflowUserService()
