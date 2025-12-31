import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Agent Design Context Service
 *
 * Dynamically extracts design tokens (like colors) from the application's CSS
 * to provide context for AI agents (especially media generation agents).
 */
class AgentDesignContextService {
  private tokensPath = join(process.cwd(), 'inertia/css/tokens.css')
  private cachedContext: string | null = null
  private lastReadTime: number = 0
  private CACHE_TTL = 1000 * 60 * 5 // 5 minutes cache

  /**
   * Get the design context as a formatted string for AI consumption
   */
  async getDesignContext(): Promise<string> {
    const now = Date.now()
    if (this.cachedContext && now - this.lastReadTime < this.CACHE_TTL) {
      return this.cachedContext
    }

    try {
      const content = await readFile(this.tokensPath, 'utf-8')
      const standoutColors = this.extractStandoutColors(content)

      if (standoutColors.length === 0) {
        return ''
      }

      this.cachedContext = [
        'BRAND DESIGN CONTEXT:',
        'The following standout colors are defined in the application design system and should be used to inform visual generation:',
        ...standoutColors.map((c) => `- ${c.name}: ${c.value}`),
        '',
        'Use these color names or their visual equivalents in prompts to maintain brand consistency.',
      ].join('\n')

      this.lastReadTime = now
      return this.cachedContext
    } catch (error) {
      console.error('Failed to read design tokens for agent context:', error)
      return ''
    }
  }

  /**
   * Extract standout colors from the CSS content
   */
  private extractStandoutColors(content: string): Array<{ name: string; value: string }> {
    const colors: Array<{ name: string; value: string }> = []

    // 1. Extract base standout colors
    const standoutRegex = /--color-standout-(\w+):\s*(.+?);/g
    let match
    while ((match = standoutRegex.exec(content)) !== null) {
      const name = `Standout ${match[1].charAt(0).toUpperCase() + match[1].slice(1)}`
      let value = match[2].trim()

      // Resolve variables if possible
      value = this.resolveVariable(value, content)

      colors.push({ name, value })
    }

    // 2. Extract dark mode overrides for standout colors
    const darkSectionMatch = content.match(/\.dark[\s\S]+?\{([\s\S]+?)\}/)
    if (darkSectionMatch) {
      const darkContent = darkSectionMatch[1]
      const darkStandoutRegex = /--color-standout-(\w+):\s*(.+?);/g
      while ((match = darkStandoutRegex.exec(darkContent)) !== null) {
        const name = `Standout ${match[1].charAt(0).toUpperCase() + match[1].slice(1)} (Dark Mode)`
        let value = match[2].trim()

        // Resolve variables
        value = this.resolveVariable(value, content)

        colors.push({ name, value })
      }
    }

    return colors
  }

  /**
   * Helper to resolve CSS variables like var(--color-teal-800)
   */
  private resolveVariable(value: string, allContent: string): string {
    const varRegex = /var\((--[\w-]+)\)/
    const match = value.match(varRegex)

    if (match) {
      const varName = match[1]
      // Simple lookup for the value of this variable in the same file
      const lookupRegex = new RegExp(`${varName}:\\s*(.+?);`)
      const lookupMatch = allContent.match(lookupRegex)

      if (lookupMatch) {
        return this.resolveVariable(lookupMatch[1].trim(), allContent)
      }

      // If not found in file, it might be a tailwind color. 
      // Try to make it human readable: --color-emerald-100 -> Emerald 100
      if (varName.startsWith('--color-')) {
        return varName
          .replace('--color-', '')
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      }
    }

    return value
  }
}

const agentDesignContextService = new AgentDesignContextService()
export default agentDesignContextService

