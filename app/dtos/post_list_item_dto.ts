import Post from '#models/post'
import { BaseModelDto } from './base_model_dto.js'

/**
 * PostListItemDto
 *
 * DTO used for `/api/posts` list responses. This class defines the
 * contract n8n agents and other API consumers can rely on.
 */
export default class PostListItemDto extends BaseModelDto {
  declare id: string
  declare type: string
  declare title: string
  declare slug: string
  declare status: string
  declare locale: string
  declare excerpt: string | null
  declare orderIndex: number
  declare parentId: string | null
  declare updatedAt: string | null
  declare translationOfId: string | null
  declare familyLocales?: string[]
  declare hasReviewDraft: boolean
  declare isDeleted: boolean

  constructor(
    post?: Post,
    extras?: {
      familyLocales?: string[]
      hasReviewDraft?: boolean
      isDeleted?: boolean
    }
  ) {
    super()
    if (!post) return

    this.id = post.id
    this.type = post.type
    this.title = post.title
    this.slug = post.slug
    this.status = post.status
    this.locale = post.locale
    this.excerpt = post.excerpt ?? null
    this.orderIndex = (post as any).orderIndex ?? 0
    this.parentId = (post as any).parentId || null
    this.updatedAt = post.updatedAt?.toISO
      ? post.updatedAt.toISO()
      : ((post as any).updatedAt ?? null)
    this.translationOfId = post.translationOfId || null
    this.familyLocales = extras?.familyLocales
    this.hasReviewDraft = extras?.hasReviewDraft ?? Boolean((post as any).reviewDraft)
    this.isDeleted = extras?.isDeleted ?? Boolean((post as any).deletedAt)
  }
}
