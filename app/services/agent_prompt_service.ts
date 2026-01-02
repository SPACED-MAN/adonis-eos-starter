import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Agent Prompt Service
 *
 * Centralizes shared protocols and instructions for AI agents to ensure consistency
 * and reduce prompt repetition across the codebase.
 * Protocols are read dynamically from the app/agents/protocols directory.
 */

// Memoization cache for protocols
const protocolCache: Record<string, string> = {}

/**
 * Maps ProtocolKey to its corresponding filename in app/agents/protocols
 */
const PROTOCOL_FILE_MAP = {
	AGENT_CAPABILITIES: 'agent_capabilities.md',
	CONTENT_QUALITY: 'content_quality.md',
	MODULE_HANDLING: 'module_handling.md',
	MEDIA_HANDLING: 'media_handling.md',
	VIDEO_HANDLING: 'video_handling.md',
	TRANSLATION_PROTOCOL: 'translation_protocol.md',
} as const

export type ProtocolKey = keyof typeof PROTOCOL_FILE_MAP

/**
 * Reads a protocol from the filesystem or cache
 */
function getProtocol(key: ProtocolKey): string {
	if (protocolCache[key]) {
		return protocolCache[key]
	}

	try {
		const baseDir = path.dirname(fileURLToPath(import.meta.url))
		// We are in app/services, protocols are in app/agents/protocols
		const filePath = path.resolve(baseDir, '..', 'agents', 'protocols', PROTOCOL_FILE_MAP[key])

		if (fs.existsSync(filePath)) {
			const content = fs.readFileSync(filePath, 'utf-8').trim()
			protocolCache[key] = content
			return content
		}
	} catch (error) {
		console.error(`Failed to read agent protocol [${key}]:`, error)
	}

	return ''
}

/**
 * Builds a system prompt by combining agent-specific instructions with shared protocols.
 */
export function buildSystemPrompt(agentPersona: string, protocolKeys: ProtocolKey[]): string {
	const protocols = protocolKeys
		.map((key) => getProtocol(key))
		.filter(Boolean)
		.join('\n\n')

	return `${agentPersona.trim()}\n\n${protocols}\n\nCRITICAL: You must respond with a JSON object ONLY. No conversational text.
Example for tool calls:
{
  "summary": "Brief description",
  "tool_calls": [
    { "tool": "tool_name", "params": { "key": "value" } }
  ]
}

Only return the JSON object.`
}
