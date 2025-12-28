/**
 * MCP Layout Configuration
 *
 * Defines project-specific layout rules and roles for AI guidance.
 */
export const mcpLayoutConfig = {
  /**
   * Preferred structural order by role.
   * Modules will be suggested in this order when planning a page.
   */
  rolePriority: [
    'hero',
    'intro',
    'logos',
    'features',
    'body',
    'stats',
    'gallery',
    'testimonials',
    'faq',
    'pricing',
    'form',
    'callout',
    'signup',
    'bottom-bar',
  ],

  /**
   * Fallback role inference when no module-specific keywords match.
   */
  fallbackInference: [
    { pattern: /\bhero\b/i, roles: ['hero'] },
    { pattern: /\bcta\b|\bcall to action\b|\bcallout\b/i, roles: ['callout'] },
    { pattern: /\bfeatures?\b/i, roles: ['features'] },
    { pattern: /\bcontent\b|\bprose\b|\bbody\b/i, roles: ['body'] },
  ],

  /**
   * Automatic field mapping when creating a post from a brief.
   * Defines which modules should be auto-populated and how.
   */
  seedMapping: [
    {
      type: 'hero',
      map: (data: { title: string; excerpt: string; h1: string | null; paras: string[] }) => ({
        title: data.title || data.h1 || '',
        subtitle: data.excerpt || (data.paras.length > 0 ? data.paras[0] : ''),
      }),
    },
    {
      type: 'prose-with-media',
      map: (data: { h2s: string[]; paras: string[] }) => ({
        title: data.h2s.length > 0 ? data.h2s[0] : '',
        body: data.paras.length > 0 ? data.paras[0] : '',
      }),
    },
  ],
}
