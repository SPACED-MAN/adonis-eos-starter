# DRY (Don't Repeat Yourself) & Reuse

## Core Principle

**Maximize efficiency and consistency through single sources of truth and strategic reuse of logic and UI.**

## DRY: Single Source of Truth

- Prefer single sources of truth for constants, unions, and schemas.
- Centralize custom field types:
  - **Server:** `app/types/custom_field.ts`
  - **Admin:** `inertia/types/custom_field.ts`
- Import shared types instead of re-declaring literal unions (e.g., field types).
- When adding a new field type, update the central definitions first.
- Co-locate validation schemas with type definitions when feasible.
- Avoid duplicating business rules; move them into services or **Actions** and reuse.

## Logic & UI Reuse

- **Shared Components:** Use existing components whenever possible. For example, use a single `ModulePicker` for both Post and Template editors.
- **Avoid Duplication:** Do not duplicate Library/Globals menus or fetch logic.
- **Callback Patterns:** Shared components (like `ModulePicker`) should accept callbacks (e.g., `onAdd`) so editors can delegate to their own endpoints while reusing UI.
- **Prop-based Behavior:** When a component diverges by context (post vs template), prefer prop-based behavior over forking the component.
- **Search Before Build:** Before adding new UI, check `inertia/admin/components` for reuse opportunities.

## Pattern: The Action Pattern

For complex, reusable business logic, always prefer **Action Classes**:
- Co-locate logic that involves multiple steps or models.
- Actions can be called from Controllers, Seeders, CLI commands, and other Actions.
- See [Actions Guide](./actions.md) for more.

## When to Reuse vs. When to Fork

- ✅ **Reuse when:** The behavior is 80%+ identical and differences can be handled with 1-2 clean props.
- ❌ **Fork when:** The components have fundamentally different responsibilities or the conditional logic becomes a "mess of ifs".
- ❌ **Abstract when:** You have 3+ instances of similar but not identical logic. Don't over-abstract too early (obey **YAGNI**).

