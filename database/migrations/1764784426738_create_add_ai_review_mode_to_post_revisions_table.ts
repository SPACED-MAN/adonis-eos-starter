import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'post_revisions'

  async up() {
    // Add 'ai-review' to the mode enum
    this.schema.raw(`
      ALTER TABLE post_revisions 
      DROP CONSTRAINT post_revisions_mode_check;
      
      ALTER TABLE post_revisions 
      ADD CONSTRAINT post_revisions_mode_check 
      CHECK (mode IN ('approved', 'review', 'ai-review'));
    `)
  }

  async down() {
    // Revert to original enum
    this.schema.raw(`
      ALTER TABLE post_revisions 
      DROP CONSTRAINT post_revisions_mode_check;
      
      ALTER TABLE post_revisions 
      ADD CONSTRAINT post_revisions_mode_check 
      CHECK (mode IN ('approved', 'review'));
    `)
  }
}