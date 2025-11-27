# Migrations Policy (Pre-Release)

- We squash/replace migrations during active development.
- Do not preserve historical migration steps that only revise earlier migrations.
- Keep a minimal set of baseline migrations that describe the current schema.
- After public release, begin treating migrations as append-only and immutable.

Baseline includes:
- users (with username LOWER() unique index)
- posts (with author_id and unique profile-per-user partial index)
- post_custom_field_values (stores by field_slug jsonb)
- site_settings (with profile_roles_enabled jsonb)



