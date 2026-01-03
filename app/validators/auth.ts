import vine from '@vinejs/vine'
import { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Validates the login action
 */
const schema = vine.object({
  uid: vine.string().trim(),
  password: vine.string().minLength(6),
})

/**
 * Custom error messages for validation
 */
const messages = {
  'uid.required': 'Please enter your email address or username',
  'password.required': 'Please enter your password',
  'password.minLength': 'Password must be at least 6 characters',
}

export const loginValidator = vine.compile(schema)
loginValidator.messagesProvider = new SimpleMessagesProvider(messages)
