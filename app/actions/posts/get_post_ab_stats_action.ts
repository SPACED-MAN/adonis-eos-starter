import db from '@adonisjs/lucid/services/db'
import Post from '#models/post'
import postTypeConfigService from '#services/post_type_config_service'

export interface GetPostAbStatsOptions {
  postId: string
}

export class GetPostAbStatsAction {
  async handle(options: GetPostAbStatsOptions) {
    const { postId } = options
    const post = await Post.find(postId)
    if (!post) throw new Error('Post not found')

    const abGroupId = post.abGroupId || post.id

    const views = await db
      .from('post_variation_views')
      .where('ab_group_id', abGroupId)
      .select('ab_variation')
      .count('* as count')
      .groupBy('ab_variation')

    const submissions = await db
      .from('form_submissions')
      .where('ab_group_id', abGroupId)
      .select('ab_variation')
      .count('* as count')
      .groupBy('ab_variation')

    const stats: Record<string, { views: number; submissions: number; conversionRate: number }> = {}

    const uiConfig = postTypeConfigService.getUiConfig(post.type)
    const variations = uiConfig.abTesting.variations || []

    const dbVariations = await Post.query().where('abGroupId', abGroupId).select('ab_variation')
    const labels = new Set([
      ...variations.map((v) => v.value),
      ...(dbVariations.map((v) => v.abVariation).filter(Boolean) as string[]),
      'A',
    ])

    for (const label of labels) {
      stats[label] = { views: 0, submissions: 0, conversionRate: 0 }
    }

    views.forEach((v: any) => {
      const label = v.ab_variation || 'A'
      if (!stats[label]) {
        stats[label] = { views: 0, submissions: 0, conversionRate: 0 }
      }
      stats[label].views = parseInt(v.count)
    })

    submissions.forEach((s: any) => {
      const label = s.ab_variation || 'A'
      if (!stats[label]) {
        stats[label] = { views: 0, submissions: 0, conversionRate: 0 }
      }
      stats[label].submissions = parseInt(s.count)
    })

    Object.keys(stats).forEach((label) => {
      const s = stats[label]
      if (s.views > 0) {
        s.conversionRate = (s.submissions / s.views) * 100
      }
    })

    return stats
  }
}

export default new GetPostAbStatsAction()

