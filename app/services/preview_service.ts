import db from '@adonisjs/lucid/services/db'
import { createHmac, randomBytes } from 'node:crypto'
import cmsConfig from '#config/cms'

/**
 * Preview Service
 *
 * Manages secure, time-limited preview links for draft/review content.
 */
class PreviewService {
  private readonly secret: string

  constructor() {
    this.secret = cmsConfig.preview.secret || 'fallback-secret-please-configure'
  }

  /**
   * Generate a secure preview token
   */
  private generateToken(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Sign a token for verification
   */
  private signToken(token: string, postId: string, expiresAt: Date): string {
    const data = `${token}:${postId}:${expiresAt.toISOString()}`
    return createHmac('sha256', this.secret).update(data).digest('hex')
  }

  /**
   * Verify a token signature
   */
  private verifySignature(
    token: string,
    postId: string,
    expiresAt: Date,
    signature: string
  ): boolean {
    const expected = this.signToken(token, postId, expiresAt)
    return expected === signature
  }

  /**
   * Create a preview link for a post
   *
   * @param postId - The post ID to create a preview for
   * @param createdBy - User ID who created the link
   * @param expirationHours - Hours until expiration (defaults to config)
   * @returns Preview token data
   */
  async createPreviewLink(
    postId: string,
    createdBy?: number,
    expirationHours?: number
  ): Promise<{
    token: string
    expiresAt: Date
    url: string
  }> {
    const hours = expirationHours || cmsConfig.preview.linkExpirationHours
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)
    const token = this.generateToken()

    // Store in database
    await db.table('preview_tokens').insert({
      post_id: postId,
      token,
      expires_at: expiresAt,
      created_by: createdBy || null,
    })

    // Generate signature for URL
    const signature = this.signToken(token, postId, expiresAt)

    return {
      token,
      expiresAt,
      url: `/preview/${postId}?token=${token}&sig=${signature}&exp=${expiresAt.toISOString()}`,
    }
  }

  /**
   * Validate a preview token
   *
   * @param postId - Post ID from URL
   * @param token - Token from URL
   * @param signature - Signature from URL
   * @param expiresAtStr - Expiration timestamp from URL
   * @returns True if valid, false otherwise
   */
  async validatePreviewToken(
    postId: string,
    token: string,
    signature: string,
    expiresAtStr: string
  ): Promise<boolean> {
    // Parse and check expiration
    const expiresAt = new Date(expiresAtStr)
    if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
      return false
    }

    // Verify signature
    if (!this.verifySignature(token, postId, expiresAt, signature)) {
      return false
    }

    // Check token exists in database and hasn't been revoked
    const record = await db
      .from('preview_tokens')
      .where('post_id', postId)
      .where('token', token)
      .where('expires_at', '>=', new Date())
      .first()

    return !!record
  }

  /**
   * Revoke a preview token
   */
  async revokeToken(postId: string, token: string): Promise<boolean> {
    const deleted = await db
      .from('preview_tokens')
      .where('post_id', postId)
      .where('token', token)
      .delete()

    return deleted > 0
  }

  /**
   * Revoke all preview tokens for a post
   */
  async revokeAllForPost(postId: string): Promise<number> {
    return db.from('preview_tokens').where('post_id', postId).delete()
  }

  /**
   * List active preview tokens for a post
   */
  async listTokensForPost(postId: string): Promise<
    Array<{
      id: string
      token: string
      expiresAt: Date
      createdBy: number | null
      createdAt: Date
    }>
  > {
    const rows = await db
      .from('preview_tokens')
      .where('post_id', postId)
      .where('expires_at', '>=', new Date())
      .orderBy('created_at', 'desc')

    return rows.map((r) => ({
      id: r.id,
      token: r.token,
      expiresAt: new Date(r.expires_at),
      createdBy: r.created_by,
      createdAt: new Date(r.created_at),
    }))
  }

  /**
   * Cleanup expired tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    return db.from('preview_tokens').where('expires_at', '<', new Date()).delete()
  }
}

const previewService = new PreviewService()
export default previewService
