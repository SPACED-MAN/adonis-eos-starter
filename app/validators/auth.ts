import vine from '@vinejs/vine'
import { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validates the login action
 */
const schema = vine.object({
	email: vine.string().trim().email(),
	password: vine.string().minLength(6),
})

/**
 * Custom error messages for validation
 */
const messages = {
	'email.required': 'Please enter your email address',
	'email.email': 'Please enter a valid email address',
	'password.required': 'Please enter your password',
	'password.minLength': 'Password must be at least 6 characters',
}

export const loginValidator = vine.compile(schema)
loginValidator.messagesProvider = new SimpleMessagesProvider(messages)
