import activityLogService from '#services/activity_log_service'

export interface LogActivityOptions {
  action: string
  userId?: number | null
  entityType?: string | null
  entityId?: string | number | null
  ip?: string | null
  userAgent?: string | null
  metadata?: Record<string, any> | null
}

export class LogActivityAction {
  async handle(options: LogActivityOptions) {
    try {
      await activityLogService.log(options)
    } catch (error) {
      // Fail silently for activity logging to not block main operation
      console.error('[LogActivityAction] Failed to log activity:', error)
    }
  }
}

export default new LogActivityAction()

