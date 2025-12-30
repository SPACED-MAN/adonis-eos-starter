# Roles & Permissions

Adonis EOS uses a file-based Role-Based Access Control (RBAC) system for granular permissions management.

## Default Roles

### Administrator

**Role:** `admin`
**Access:** Full system access

Administrators can:

- ✅ Access all admin sections
- ✅ Manage users and roles
- ✅ Configure system settings
- ✅ Export/import database
- ✅ Publish and delete any content
- ✅ Override all restrictions

### Editor Admin

**Role:** `editor_admin`
**Access:** Content management + publishing

Editor Admins can:

- ✅ Create, edit, publish content
- ✅ Approve reviews and AI reviews
- ✅ Manage media, menus, forms
- ✅ Configure AI agents
- ✅ Access activity logs
- ❌ Manage users or system settings
- ❌ Export/import database

Perfect for content managers who need publishing power.

### Editor

**Role:** `editor`
**Access:** Content creation and editing

Editors can:

- ✅ Create and edit content
- ✅ Save drafts for review
- ✅ Save for AI review
- ✅ Manage media uploads
- ✅ Edit menus and forms
- ❌ Publish content
- ❌ Approve reviews
- ❌ Manage users

Ideal for content creators who need review before publishing.

### Translator

**Role:** `translator`
**Access:** Translation-focused, read-mostly

Translators can:

- ✅ View all content
- ✅ Edit translatable fields
- ✅ Save drafts for review
- ✅ View media library
- ❌ Upload or delete media
- ❌ Publish content
- ❌ Edit non-translatable settings

Designed for translation teams.

## Permission System

### Permission Keys

Permissions follow a hierarchical naming pattern:

```
{section}.{action}

Examples:
- posts.create
- posts.edit
- posts.publish
- posts.delete
- media.upload
- media.delete
- admin.settings.view
- admin.settings.update
```

### Granular Permissions

#### Content Permissions

- `posts.create` - Create new posts
- `posts.edit` - Edit existing posts
- `posts.view` - View posts (own or all)
- `posts.publish` - Publish posts
- `posts.delete` - Delete posts
- `posts.review.save` - Save to review mode
- `posts.review.approve` - Approve review changes
- `posts.ai-review.save` - Save for AI review
- `posts.ai-review.approve` - Approve AI review changes

#### Media Permissions

- `media.upload` - Upload new media
- `media.view` - View media library
- `media.edit` - Edit media metadata
- `media.replace` - Replace media files
- `media.delete` - Delete media

#### Admin Permissions

- `admin.access` - Access admin panel
- `admin.users.manage` - User management
- `admin.settings.view` - View settings
- `admin.settings.update` - Update settings
- `admin.database.export` - Export database
- `admin.database.import` - Import database

## Creating Custom Roles

### 1. Generate Role File

```bash
node ace make:role content_manager
```

Creates `app/roles/content_manager.ts`

### 2. Define Permissions

```typescript
import type { RoleDefinition } from '#types/role_types'

const contentManagerRole: RoleDefinition = {
  name: 'content_manager',
  label: 'Content Manager',
  description: 'Manages content with publishing rights',

  permissions: [
    // Content
    'posts.create',
    'posts.edit',
    'posts.view',
    'posts.publish',
    'posts.delete',
    'posts.review.approve',

    // Media
    'media.upload',
    'media.view',
    'media.edit',
    'media.delete',

    // Menus & Forms
    'menus.view',
    'menus.edit',
    'forms.view',
    'forms.edit',

    // Admin access
    'admin.access',
  ],
}

export default contentManagerRole
```

### 3. Role Automatically Registered

The role is automatically registered on server startup from `start/roles.ts`.

### 4. Assign to Users

In the admin panel:

1. Go to `/admin/users`
2. Edit a user
3. Select the new role from dropdown
4. Save

## Checking Permissions

### Backend (Controllers)

```typescript
import roleRegistry from '#services/role_registry'
import authorizationService from '#services/authorization_service'

// Direct permission check
if (!roleRegistry.hasPermission(user.role, 'posts.publish')) {
  return response.forbidden({ error: 'Cannot publish posts' })
}

// Via authorization service
if (!authorizationService.canPublish(user)) {
  return response.forbidden({ error: 'Cannot publish' })
}
```

### Frontend (React)

```typescript
import { useHasPermission } from '~/utils/permissions'

function PostEditor() {
  const canPublish = useHasPermission('posts.publish')
  const canDelete = useHasPermission('posts.delete')

  return (
    <>
      {canPublish && <button>Publish</button>}
      {canDelete && <button>Delete</button>}
    </>
  )
}
```

## Workflow Examples

### Review Workflow

1. **Editor** creates content
2. **Editor** clicks "Save for Review"
3. **Editor Admin** reviews changes
4. **Editor Admin** clicks "Approve Review"
5. Content is published

### AI Review Workflow

1. **Editor** creates content
2. **AI Agent** suggests improvements
3. Changes saved to "AI Review" mode
4. **Editor Admin** reviews AI suggestions
5. **Editor Admin** approves or rejects

### Translation Workflow

1. **Editor** creates content in English
2. **Translator** views English version
3. **Translator** edits translatable fields
4. **Translator** saves draft for review
5. **Editor Admin** approves and publishes

## Best Practices

### Security

1. **Principle of least privilege** - Only grant needed permissions
2. **Regular audits** - Review user roles periodically
3. **Use service methods** - Don't bypass permission checks
4. **Test thoroughly** - Verify restrictions work as expected

### Organization

1. **Clear role names** - Use descriptive labels
2. **Document roles** - Explain intended use case
3. **Consistent naming** - Follow permission key patterns
4. **Group permissions** - Organize by feature area

## Troubleshooting

**Issue**: User can't access admin

- **Solution**: Ensure role has `admin.access` permission

**Issue**: Editor can publish (shouldn't)

- **Solution**: Remove `posts.publish` from editor role definition

**Issue**: Custom role not appearing

- **Solution**: Restart server to register new role files

**Issue**: Permission check failing unexpectedly

- **Solution**: Check exact permission key spelling and role name

## Activity Logging

All actions are logged with user and role information:

View logs at `/admin/activity` (admin only)

Logged events:

- Content created, updated, published, deleted
- Media uploaded, replaced, deleted
- Settings changed
- Users added, removed, role changed
