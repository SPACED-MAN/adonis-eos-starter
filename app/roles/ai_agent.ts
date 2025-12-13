import type { RoleDefinition } from '#types/role_types'

/**
 * AI Agent Role
 *
 * Special role for AI/MCP system operations.
 * Used by the MCP server and external AI agents to create and modify content.
 *
 * Key characteristics:
 * - Can create and edit content (always stages to AI Review)
 * - Cannot publish or approve content (human approval required)
 * - Cannot access admin UI or manage users/settings
 * - Cannot delete content or access sensitive operations
 */
const aiAgentRole: RoleDefinition = {
  name: 'ai_agent',
  label: 'AI Agent',
  description:
    'System role for AI agents and MCP operations. Can create and edit content (staged to AI Review), but cannot publish or access admin settings.',
  permissions: [
    // Content - Can create and edit (AI Review only)
    'posts.create',
    'posts.edit',
    'posts.export',
    'posts.ai-review.save',

    // Media - Read-only access
    'media.view',

    // Agents - Can view available agents
    'agents.view',

    // Note: Explicitly CANNOT:
    // - Access admin UI ('admin.access')
    // - Publish content ('posts.publish')
    // - Approve reviews ('posts.review.approve', 'posts.ai-review.approve')
    // - Delete content ('posts.delete')
    // - Manage users or settings
    // - Upload/modify/delete media
  ],
}

export default aiAgentRole

