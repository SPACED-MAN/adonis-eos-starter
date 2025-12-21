import vine from '@vinejs/vine'
import { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Menu validators
 *
 * Validation rules for menu operations.
 */

/**
 * Create menu validator
 */
export const createMenuValidator = vine.compile(
	vine.object({
		name: vine.string().trim().minLength(1).maxLength(255),
		slug: vine
			.string()
			.trim()
			.minLength(1)
			.maxLength(255)
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
		locale: vine.string().trim().minLength(2).maxLength(10).nullable().optional(),
		template: vine.string().trim().maxLength(100).nullable().optional(),
		meta: vine.any().optional(),
	})
)

createMenuValidator.messagesProvider = new SimpleMessagesProvider({
	'name.required': 'Menu name is required',
	'name.minLength': 'Menu name must be at least 1 character',
	'name.maxLength': 'Menu name must not exceed 255 characters',
	'slug.required': 'Menu slug is required',
	'slug.minLength': 'Menu slug must be at least 1 character',
	'slug.maxLength': 'Menu slug must not exceed 255 characters',
	'slug.regex': 'Menu slug can only contain lowercase letters, numbers, and hyphens',
	'locale.minLength': 'Locale must be at least 2 characters',
	'locale.maxLength': 'Locale must not exceed 10 characters',
})

/**
 * Update menu validator
 */
export const updateMenuValidator = vine.compile(
	vine.object({
		name: vine.string().trim().minLength(1).maxLength(255).optional(),
		slug: vine
			.string()
			.trim()
			.minLength(1)
			.maxLength(255)
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
			.optional(),
		locale: vine.string().trim().minLength(2).maxLength(10).nullable().optional(),
		template: vine.string().trim().maxLength(100).nullable().optional(),
		meta: vine.any().optional(),
	})
)

updateMenuValidator.messagesProvider = new SimpleMessagesProvider({
	'name.minLength': 'Menu name must be at least 1 character',
	'name.maxLength': 'Menu name must not exceed 255 characters',
	'slug.minLength': 'Menu slug must be at least 1 character',
	'slug.maxLength': 'Menu slug must not exceed 255 characters',
	'slug.regex': 'Menu slug can only contain lowercase letters, numbers, and hyphens',
	'locale.minLength': 'Locale must be at least 2 characters',
	'locale.maxLength': 'Locale must not exceed 10 characters',
})

/**
 * Create menu item validator
 */
export const createMenuItemValidator = vine.compile(
	vine.object({
		label: vine.string().trim().minLength(1).maxLength(255),
		type: vine.enum(['custom', 'post', 'dynamic']),
		locale: vine.string().trim().minLength(2).maxLength(10).optional(),
		postId: vine.string().uuid().nullable().optional(),
		customUrl: vine.string().trim().maxLength(2048).nullable().optional(),
		anchor: vine.string().trim().maxLength(255).optional(),
		target: vine.enum(['_self', '_blank']).optional(),
		rel: vine.string().trim().maxLength(255).optional(),
		kind: vine.enum(['item', 'section']).optional(),
		parentId: vine.string().uuid().nullable().optional(),
		orderIndex: vine.number().min(0).optional(),
		dynamicPostType: vine.string().trim().maxLength(50).nullable().optional(),
		dynamicParentId: vine.string().uuid().nullable().optional(),
		dynamicDepthLimit: vine.number().min(1).max(10).optional(),
	})
)

createMenuItemValidator.messagesProvider = new SimpleMessagesProvider({
	'label.required': 'Menu item label is required',
	'label.minLength': 'Menu item label must be at least 1 character',
	'label.maxLength': 'Menu item label must not exceed 255 characters',
	'type.required': 'Menu item type is required',
	'type.enum': 'Menu item type must be one of: custom, post, dynamic',
	'customUrl.maxLength': 'Custom URL must not exceed 2048 characters',
	'anchor.maxLength': 'Anchor must not exceed 255 characters',
	'target.enum': 'Target must be either "_self" or "_blank"',
})

/**
 * Update menu item validator
 */
export const updateMenuItemValidator = vine.compile(
	vine.object({
		label: vine.string().trim().minLength(1).maxLength(255).optional(),
		type: vine.enum(['custom', 'post', 'dynamic']).optional(),
		locale: vine.string().trim().minLength(2).maxLength(10).optional(),
		postId: vine.string().uuid().nullable().optional(),
		customUrl: vine.string().trim().maxLength(2048).nullable().optional(),
		anchor: vine.string().trim().maxLength(255).optional(),
		target: vine.enum(['_self', '_blank']).optional(),
		rel: vine.string().trim().maxLength(255).optional(),
		kind: vine.string().trim().maxLength(50).optional(),
		parentId: vine.string().uuid().nullable().optional(),
		orderIndex: vine.number().min(0).optional(),
		dynamicPostType: vine.string().trim().maxLength(50).nullable().optional(),
		dynamicParentId: vine.string().uuid().nullable().optional(),
		dynamicDepthLimit: vine.number().min(1).max(10).optional(),
	})
)

updateMenuItemValidator.messagesProvider = createMenuItemValidator.messagesProvider

/**
 * Reorder menu items validator
 */
export const reorderMenuItemsValidator = vine.compile(
	vine.object({
		items: vine
			.array(
				vine.object({
					id: vine.string().uuid(),
					orderIndex: vine.number().min(0),
					parentId: vine.string().uuid().nullable().optional(),
				})
			)
			.minLength(1)
			.maxLength(500),
	})
)

reorderMenuItemsValidator.messagesProvider = new SimpleMessagesProvider({
	'items.required': 'Items array is required',
	'items.minLength': 'At least one item is required',
	'items.maxLength': 'Cannot reorder more than 500 items at once',
})

