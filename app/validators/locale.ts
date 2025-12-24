import vine from '@vinejs/vine'
import { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Locale validators
 *
 * Validation rules for locale operations.
 */

/**
 * Update locale validator
 */
export const updateLocaleValidator = vine.compile(
	vine.object({
		isEnabled: vine.boolean().optional(),
		isDefault: vine.boolean().optional(),
	})
)

updateLocaleValidator.messagesProvider = new SimpleMessagesProvider({
	'isEnabled.boolean': 'isEnabled must be a boolean',
	'isDefault.boolean': 'isDefault must be a boolean',
})








