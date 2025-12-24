import vine from '@vinejs/vine'
import { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * User validators
 *
 * Centralized validation rules for user management operations.
 */

/**
 * Create user validator
 */
export const createUserValidator = vine.compile(
	vine.object({
		email: vine.string().trim().email().normalizeEmail(),
		password: vine.string().minLength(8),
		role: vine.enum(['admin', 'editor_admin', 'editor', 'translator']),
		username: vine.string().trim().minLength(3).maxLength(50).regex(/^[a-z0-9_-]+$/i).optional().nullable(),
		fullName: vine.string().trim().maxLength(255).optional(),
	})
)

createUserValidator.messagesProvider = new SimpleMessagesProvider({
	'email.required': 'Email is required',
	'email.email': 'Please enter a valid email address',
	'password.required': 'Password is required',
	'password.minLength': 'Password must be at least 8 characters',
	'role.required': 'Role is required',
	'role.enum': 'Role must be one of: admin, editor_admin, editor, translator',
	'username.minLength': 'Username must be at least 3 characters',
	'username.maxLength': 'Username must not exceed 50 characters',
	'username.regex': 'Username can only contain letters, numbers, underscores, and hyphens',
	'fullName.maxLength': 'Full name must not exceed 255 characters',
})

/**
 * Update user validator
 */
export const updateUserValidator = vine.compile(
	vine.object({
		email: vine.string().trim().email().normalizeEmail().optional(),
		role: vine.enum(['admin', 'editor_admin', 'editor', 'translator']).optional(),
		username: vine.string().trim().minLength(3).maxLength(50).regex(/^[a-z0-9_-]+$/i).optional().nullable(),
		fullName: vine.string().trim().maxLength(255).optional(),
	})
)

updateUserValidator.messagesProvider = new SimpleMessagesProvider({
	'email.email': 'Please enter a valid email address',
	'role.enum': 'Role must be one of: admin, editor_admin, editor, translator',
	'username.minLength': 'Username must be at least 3 characters',
	'username.maxLength': 'Username must not exceed 50 characters',
	'username.regex': 'Username can only contain letters, numbers, underscores, and hyphens',
	'fullName.maxLength': 'Full name must not exceed 255 characters',
})

/**
 * Reset password validator
 */
export const resetPasswordValidator = vine.compile(
	vine.object({
		password: vine.string().minLength(8),
	})
)

resetPasswordValidator.messagesProvider = new SimpleMessagesProvider({
	'password.required': 'Password is required',
	'password.minLength': 'Password must be at least 8 characters',
})







