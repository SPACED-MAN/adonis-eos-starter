import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'

export default class extends BaseSeeder {
  async run() {
    // Check if user already exists
    const existingUser = await User.findBy('email', 'i@modernaut.com')

    if (existingUser) {
      // Update existing user
      existingUser.password = 'supersecret'
      existingUser.fullName = 'Admin User'
      await existingUser.save()
      console.log('Updated existing admin user')
    } else {
      // Create new user
      const user = new User()
      user.email = 'i@modernaut.com'
      user.password = 'supersecret'
      user.fullName = 'Admin User'
      await user.save()
      console.log('Created new admin user')
    }
  }
}