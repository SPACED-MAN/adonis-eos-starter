# DRY (Don't Repeat Yourself)

- Prefer single sources of truth for constants, unions, and schemas.
- Centralize custom field types:
  - Backend: `app/types/custom_field.ts`
  - Frontend: `inertia/types/custom_field.ts`
- Import shared types instead of re-declaring literal unions (e.g., field types).
- When adding a new field type, update the central definitions first.
- Co-locate validation schemas with type definitions when feasible.
- Avoid duplicating business rules; move them into services and reuse.


