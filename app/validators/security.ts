import vine from '@vinejs/vine'

/**
 * Security validators
 *
 * Validation rules for security-related endpoints.
 */

/**
 * Security sessions query validator
 */
export const securitySessionsQueryValidator = vine.compile(
	vine.object({
		userId: vine.number().positive().optional(),
	})
)

/**
 * Security login history query validator
 */
export const loginHistoryQueryValidator = vine.compile(
	vine.object({
		userId: vine.number().positive().optional(),
		limit: vine.number().min(1).max(200).optional(),
		offset: vine.number().min(0).optional(),
	})
)








