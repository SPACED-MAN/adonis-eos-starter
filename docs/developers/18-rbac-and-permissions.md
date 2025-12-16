# RBAC and Permissions

Adonis EOS uses code-first roles with a permission registry.

## Key files

- Roles: `app/roles/*`
- Role registry: `app/services/role_registry.ts`
- Authorization helpers: `app/services/authorization_service.ts`

## Concepts

- Roles are defined in code and registered on boot (`start/roles.ts`).
- Permissions are checked across controllers using `roleRegistry.hasPermission(...)`.

## Typical permissions

Examples you’ll see in code:

- `posts.create`, `posts.edit`, `posts.publish`, `posts.delete`
- `posts.revisions.manage`
- `admin.database.export`, `admin.database.import`
- `agents.view`, `agents.edit`
- `menus.view`

## Adding a new permission

1. Add it to the role definitions that should allow it (`app/roles/*`).
2. Use `roleRegistry.hasPermission(role, '<permission>', optionalPostType)` in controllers/services.
