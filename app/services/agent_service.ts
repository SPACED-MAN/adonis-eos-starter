type Agent = {
  id: string
  name: string
  url: string
  /**
   * Shared secret/token for authenticating with the agent webhook.
   */
  secret?: string
  /**
   * Optional custom header name to send the secret with.
   * If omitted, the secret is sent as Authorization: Bearer <secret>.
   */
  secretHeader?: string
}

class AgentService {
  parseAgents(): Agent[] {
    const raw = process.env.CMS_AGENTS || '[]'
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed
          .map((a) => ({
            id: String(a.id || '').trim(),
            name: String(a.name || a.id || '').trim(),
            url: String(a.url || '').trim(),
            secret: a.secret ? String(a.secret) : undefined,
            secretHeader: a.secretHeader ? String(a.secretHeader) : undefined,
          }))
          .filter((a) => a.id && a.name && a.url)
      }
      return []
    } catch {
      return []
    }
  }
}

const agentService = new AgentService()
export default agentService
