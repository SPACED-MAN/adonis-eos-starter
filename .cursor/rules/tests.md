# Tests Policy

- For major features/milestones, add automated tests using the Adonis test framework (Japa).
- Place tests under `tests/` (e.g., `tests/unit/*.spec.ts`, `tests/functional/*.spec.ts`).
- Cover:
  - Core services (e.g., ActivityLogService)
  - Critical flows (e.g., scheduling auto-publish, code-first config behaviors)
  - RBAC-sensitive operations (e.g., destructive routes)
- Ensure tests are idempotent and clean up any data they create.
- CI should run `node ace test` on each PR to main.



