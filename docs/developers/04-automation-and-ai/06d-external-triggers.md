# External Agent Triggers

Adonis EOS allows triggering AI agents from external sources such as webhooks, CI/CD pipelines, or third-party automation tools (like n8n, Make, or custom scripts).

There are two primary ways to trigger agents externally:

1. **MCP (Model Context Protocol)**: Best for AI-to-AI communication.
2. **REST API**: Best for simple webhook or script triggers.

---

## 1. Triggering via MCP (Recommended for AI systems)

The EOS MCP server includes a `run_agent` tool specifically designed for external triggers.

### Tool: `run_agent`

**Parameters:**
- `agentId` (string, required): The ID of the agent to run (e.g., `general_assistant`).
- `postId` (string, optional): The ID of the post the agent should work on.
- `scope` (string, optional): The scope to run in (default: `dropdown`).
- `context` (object, optional): Additional context parameters for the agent.
- `openEndedContext` (string, optional): A freeform prompt for the agent (if supported).

**Example (n8n MCP Client Tool):**
```json
{
  "agentId": "graphic_designer",
  "postId": "uuid-of-post",
  "scope": "dropdown",
  "context": {
    "viewMode": "source"
  }
}
```

---

## 2. Triggering via REST API

If you prefer a standard HTTP request, you can use the external trigger endpoint.

### Endpoint: `POST /api/public/agents/:agentId/run`

**Authentication:**
Requires a secret key sent in one of the following headers:
- `X-Agent-Key: YOUR_SECRET`
- `Authorization: Bearer YOUR_SECRET`

The secret is determined by the `AGENT_TRIGGER_SECRET` environment variable. If not set, it falls back to `MCP_AUTH_TOKEN`.

**Request Body:**
```json
{
  "postId": "uuid-of-post",
  "scope": "dropdown",
  "context": {
    "any": "value"
  },
  "openEndedContext": "Summarize this post"
}
```

**cURL Example:**
```bash
curl -X POST http://your-eos-site.com/api/public/agents/general_assistant/run \
  -H "X-Agent-Key: your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "postId": "550e8400-e29b-41d4-a716-446655440000",
    "openEndedContext": "Check for spelling errors"
  }'
```

---

## Security Considerations

- **Secret Keys**: Always set a strong `AGENT_TRIGGER_SECRET` in your `.env` file.
- **Least Privilege**: Agents triggered externally still follow the same safety rules as internal agents. Suggestions are typically staged to **AI Review** rather than applied directly to the live post, unless the agent is specifically configured otherwise.
- **Rate Limiting**: Public endpoints are subject to EOS global rate limits. For high-volume triggers, ensure your IP is allowlisted or adjust `config/cms.ts` rate limit settings.

