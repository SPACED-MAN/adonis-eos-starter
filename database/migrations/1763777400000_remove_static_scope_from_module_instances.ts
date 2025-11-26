import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
	async up() {
		// 1) Make scope a text type permanently (we will enforce via CHECK)
		await this.schema.raw(`ALTER TABLE "module_instances" ALTER COLUMN "scope" TYPE text USING "scope"::text`)
		// 2) Drop any potential previous enum types if they exist
		await this.schema.raw(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'module_instances_scope_enum') THEN
        DROP TYPE "module_instances_scope_enum";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'module_instances_scope_enum_old') THEN
        DROP TYPE "module_instances_scope_enum_old";
      END IF;
    END $$;`)
		// 3) Normalize any legacy values to supported set
		await this.schema.raw(`UPDATE "module_instances" SET "scope" = 'post' WHERE "scope" = 'static'`)
		// 4) Drop constraints/indexes that may refer to enum comparisons
		await this.schema.raw(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'module_instances_scope_chk') THEN
        ALTER TABLE "module_instances" DROP CONSTRAINT "module_instances_scope_chk";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'module_instances_scope_global_slug_unique') THEN
        ALTER TABLE "module_instances" DROP CONSTRAINT "module_instances_scope_global_slug_unique";
      END IF;
    END $$;`)
		// 5) Best-effort drop of a common index name if present
		await this.schema.raw(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'module_instances_scope_idx') THEN
        DROP INDEX "module_instances_scope_idx";
      END IF;
    END $$;`)
		// 6) Add CHECK constraint enforcing allowed values on text column
		await this.schema.raw(`ALTER TABLE "module_instances" ADD CONSTRAINT "module_instances_scope_chk" CHECK (scope IN ('post','global'))`)
		// 7) Recreate unique constraint and index
		await this.schema.raw(`ALTER TABLE "module_instances" ADD CONSTRAINT "module_instances_scope_global_slug_unique" UNIQUE ("scope","global_slug")`)
		await this.schema.raw(`CREATE INDEX "module_instances_scope_idx" ON "module_instances" ("scope","type")`)
	}

	async down() {
		// Best effort: relax check to permit 'static' again on text column
		await this.schema.raw(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'module_instances_scope_chk') THEN
        ALTER TABLE "module_instances" DROP CONSTRAINT "module_instances_scope_chk";
      END IF;
    END $$;`)
		await this.schema.raw(`ALTER TABLE "module_instances" ADD CONSTRAINT "module_instances_scope_chk" CHECK (scope IN ('post','global','static'))`)
	}
}


