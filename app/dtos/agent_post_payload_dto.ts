import type { CanonicalPost } from '#services/post_serializer_service'
import { BaseModelDto } from './base_model_dto.js'

/**
 * AgentPostPayloadDto
 *
 * Payload shape sent to external agents (e.g. n8n) when running
 * an agent against a post from the editor dropdown.
 *
 * This is the JSON contract agents should expect:
 *
 * {
 *   "version": 1,
 *   "post": { ... },         // canonical post fields
 *   "modules": [ ... ],      // canonical modules
 *   "translations": [ ... ], // optional translation family metadata
 *   "context": { ... }       // arbitrary context from the UI
 * }
 */
export default class AgentPostPayloadDto extends BaseModelDto {
  declare version: CanonicalPost['version']
  declare post: CanonicalPost['post']
  declare modules: CanonicalPost['modules']
  declare translations: CanonicalPost['translations']
  declare context: Record<string, unknown>

  constructor(canonical?: CanonicalPost, context?: Record<string, unknown>) {
    super()
    if (!canonical) {
      // default-empty payload (not expected in normal flow)
      this.version = 1 as const
      this.post = {} as any
      this.modules = []
      this.translations = []
      this.context = context || {}
      return
    }

    this.version = canonical.version
    this.post = canonical.post
    this.modules = canonical.modules
    this.translations = canonical.translations ?? []
    this.context = context || {}
  }
}
