import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'

export default class extends BaseSeeder {
  async run() {
    // Check if user already exists
    const existingUser = await User.findBy('email', 'admin@example.com')

    if (existingUser) {
      // Update existing user
      existingUser.password = 'supersecret'
      existingUser.fullName = 'Admin User'
      ;(existingUser as any).role = 'admin'
      await existingUser.save()
      console.log('Updated existing admin user')
    } else {
      // Create new user
      const user = new User()
      user.email = 'admin@example.com'
      user.password = 'supersecret'
      user.fullName = 'Admin User'
      ;(user as any).role = 'admin'
      await user.save()
      console.log('Created new admin user')
    }

    // Ensure editor admin account
    const existingEditorAdmin = await User.findBy('email', 'editoradmin@example.com')
    if (existingEditorAdmin) {
      existingEditorAdmin.password = 'supersecret'
      existingEditorAdmin.fullName = 'Editor Admin User'
      ;(existingEditorAdmin as any).role = 'editor_admin'
      await existingEditorAdmin.save()
      console.log('Updated existing editor admin user')
    } else {
      const editorAdmin = new User()
      editorAdmin.email = 'editoradmin@example.com'
      editorAdmin.password = 'supersecret'
      editorAdmin.fullName = 'Editor Admin User'
      ;(editorAdmin as any).role = 'editor_admin'
      await editorAdmin.save()
      console.log('Created editor admin user')
    }

    // Ensure editor account
    const existingEditor = await User.findBy('email', 'editor@example.com')
    if (existingEditor) {
      existingEditor.password = 'supersecret'
      existingEditor.fullName = 'Editor User'
      ;(existingEditor as any).role = 'editor'
      await existingEditor.save()
      console.log('Updated existing editor user')
    } else {
      const editor = new User()
      editor.email = 'editor@example.com'
      editor.password = 'supersecret'
      editor.fullName = 'Editor User'
      ;(editor as any).role = 'editor'
      await editor.save()
      console.log('Created editor user')
    }

    // Ensure translator account
    const existingTranslator = await User.findBy('email', 'translator@example.com')
    if (existingTranslator) {
      existingTranslator.password = 'supersecret'
      existingTranslator.fullName = 'Translator User'
      ;(existingTranslator as any).role = 'translator'
      await existingTranslator.save()
      console.log('Updated existing translator user')
    } else {
      const translator = new User()
      translator.email = 'translator@example.com'
      translator.password = 'supersecret'
      translator.fullName = 'Translator User'
      ;(translator as any).role = 'translator'
      await translator.save()
      console.log('Created translator user')
    }
  }
}
