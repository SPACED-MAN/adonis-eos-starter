import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import env from '#start/env'
import app from '@adonisjs/core/services/app'

export default class extends BaseSeeder {
  async run() {
    const isDevelopment = app.nodeEnvironment === 'development'
    const defaultPassword = isDevelopment ? 'supersecret' : env.get('SEEDER_PASSWORD')

    if (!defaultPassword && !isDevelopment) {
      console.warn(
        '⚠️  No SEEDER_PASSWORD found in environment. Skipping user seeding in non-development environment.'
      )
      return
    }

    const password = defaultPassword!

    // Check if user already exists
    const existingUser = await User.findBy('email', 'admin@example.com')

    if (existingUser) {
      // Update existing user
      existingUser.password = password
      existingUser.fullName = 'Admin User'
        ; (existingUser as any).role = 'admin'
      await existingUser.save()
      console.log('Updated existing admin user')
    } else {
      // Create new user
      const user = new User()
      user.email = 'admin@example.com'
      user.password = password
      user.fullName = 'Admin User'
        ; (user as any).role = 'admin'
      await user.save()
      console.log('Created new admin user')
    }

    // Ensure editor admin account
    const existingEditorAdmin = await User.findBy('email', 'editoradmin@example.com')
    if (existingEditorAdmin) {
      existingEditorAdmin.password = password
      existingEditorAdmin.fullName = 'Editor Admin User'
        ; (existingEditorAdmin as any).role = 'editor_admin'
      await existingEditorAdmin.save()
      console.log('Updated existing editor admin user')
    } else {
      const editorAdmin = new User()
      editorAdmin.email = 'editoradmin@example.com'
      editorAdmin.password = password
      editorAdmin.fullName = 'Editor Admin User'
        ; (editorAdmin as any).role = 'editor_admin'
      await editorAdmin.save()
      console.log('Created editor admin user')
    }

    // Ensure editor account
    const existingEditor = await User.findBy('email', 'editor@example.com')
    if (existingEditor) {
      existingEditor.password = password
      existingEditor.fullName = 'Editor User'
        ; (existingEditor as any).role = 'editor'
      await existingEditor.save()
      console.log('Updated existing editor user')
    } else {
      const editor = new User()
      editor.email = 'editor@example.com'
      editor.password = password
      editor.fullName = 'Editor User'
        ; (editor as any).role = 'editor'
      await editor.save()
      console.log('Created editor user')
    }

    // Ensure translator account
    const existingTranslator = await User.findBy('email', 'translator@example.com')
    if (existingTranslator) {
      existingTranslator.password = password
      existingTranslator.fullName = 'Translator User'
        ; (existingTranslator as any).role = 'translator'
      await existingTranslator.save()
      console.log('Updated existing translator user')
    } else {
      const translator = new User()
      translator.email = 'translator@example.com'
      translator.password = password
      translator.fullName = 'Translator User'
        ; (translator as any).role = 'translator'
      await translator.save()
      console.log('Created translator user')
    }

    // Ensure AI agent account (for MCP operations)
    // This user is used by the MCP server via MCP_SYSTEM_USER_ID
    const aiEmail = 'ai@agents.local'

    let aiUser = await User.findBy('email', aiEmail)

    if (aiUser) {
      // For existing AI user, we don't necessarily need to change the password
      // but we ensure the role is correct.
      aiUser.fullName = 'AI Agent'
        ; (aiUser as any).role = 'ai_agent'
      await aiUser.save()
      console.log(`Verified existing AI agent user (ID: ${aiUser.id})`)
      console.log(`→ Set MCP_SYSTEM_USER_ID=${aiUser.id} in your .env file (recommended)`)
    } else {
      // Try to create with explicit ID 5 for MCP_SYSTEM_USER_ID (fresh DB convenience)
      // If ID 5 is taken, let it auto-increment (do not delete/overwrite existing users).
      const newAi = new User()
      const id5Exists = await User.find(5)
      if (!id5Exists) {
        ; (newAi as any).id = 5
      }
      newAi.email = aiEmail
      // Use a random password for system accounts to prevent backdoor login
      newAi.password = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16)
      newAi.fullName = 'AI Agent'
        ; (newAi as any).role = 'ai_agent'
      await newAi.save()
      console.log(`Created AI agent user (ID: ${newAi.id})`)
      console.log(`→ Set MCP_SYSTEM_USER_ID=${newAi.id} in your .env file (recommended)`)
    }
  }
}
