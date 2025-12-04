# API Reference

The Adonis EOS API provides RESTful endpoints for managing content, media, and settings.

## Authentication

Most API endpoints require authentication via session cookies. Admin-level access requires the `admin` role.

## Posts API

### List Posts

```http
GET /api/posts?type=page&status=published&locale=en
```

**Query Parameters:**
- `type` - Post type (page, blog, profile, company, testimonial)
- `status` - Filter by status (published, draft, archived)
- `locale` - Language code (en, es, fr, etc.)
- `taxonomy` - Filter by taxonomy slug
- `search` - Search in title and content

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Page Title",
      "slug": "page-slug",
      "type": "page",
      "status": "published",
      "locale": "en",
      "modules": [...]
    }
  ],
  "meta": {
    "total": 10,
    "per_page": 20,
    "current_page": 1
  }
}
```

### Get Single Post

```http
GET /api/posts/:id
```

Returns full post data including modules, metadata, and relationships.

### Create Post

```http
POST /api/posts
Content-Type: application/json

{
  "title": "New Page",
  "slug": "new-page",
  "type": "page",
  "status": "draft",
  "locale": "en",
  "modules": []
}
```

### Update Post

```http
PUT /api/posts/:id
Content-Type: application/json

{
  "title": "Updated Title",
  "status": "published"
}
```

### Delete Post

```http
DELETE /api/posts/:id
```

Soft deletes the post (can be restored).

## Media API

### Upload Media

```http
POST /api/media/upload
Content-Type: multipart/form-data

file: <binary>
alt_text: "Description"
categories: ["hero", "featured"]
```

**Response:**
```json
{
  "id": "uuid",
  "filename": "image.jpg",
  "url": "/uploads/image.jpg",
  "size": 102400,
  "mime": "image/jpeg",
  "variants": {
    "large": "/uploads/image.large.jpg",
    "medium": "/uploads/image.medium.jpg",
    "small": "/uploads/image.small.jpg"
  }
}
```

### Generate Variants

```http
POST /api/media/:id/variants
Content-Type: application/json

{
  "theme": "dark"
}
```

Generates image variants (light or dark theme).

### Get Media

```http
GET /api/media?category=hero&search=logo
```

Lists media assets with optional filtering.

## Modules API

### Get Post Modules

```http
GET /api/posts/:postId/modules
```

Returns all modules for a post with their current props.

### Add Module

```http
POST /api/posts/:postId/modules
Content-Type: application/json

{
  "type": "hero",
  "props": {
    "title": "Welcome",
    "subtitle": "To our site"
  }
}
```

### Update Module

```http
PUT /api/post-modules/:moduleId
Content-Type: application/json

{
  "props": {
    "title": "Updated Title"
  }
}
```

### Reorder Modules

```http
POST /api/posts/:postId/modules/reorder
Content-Type: application/json

{
  "order": ["module-uuid-1", "module-uuid-2", "module-uuid-3"]
}
```

## Forms API

### Submit Form

```http
POST /api/forms/:slug/submit
Content-Type: application/json

{
  "email": "user@example.com",
  "message": "Hello!"
}
```

### Get Form Definition

```http
GET /api/forms-definitions/:slug
```

Returns form schema and configuration.

## Menus API

### Get Menu

```http
GET /api/menus/:slug?locale=en
```

Returns menu structure with items.

**Response:**
```json
{
  "id": "uuid",
  "name": "Primary",
  "slug": "primary",
  "items": [
    {
      "id": "uuid",
      "label": "Home",
      "type": "custom",
      "url": "/",
      "children": []
    }
  ]
}
```

## Webhooks

Adonis EOS can trigger webhooks on various events:

- `post.created`
- `post.updated`
- `post.published`
- `post.deleted`
- `form.submitted`

Configure webhooks in `/admin/settings`.

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- **Authenticated**: 1000 requests/hour
- **Anonymous**: 100 requests/hour
- **Form submissions**: 10 requests/hour per IP

## Error Responses

```json
{
  "error": "Validation failed",
  "details": {
    "title": ["Title is required"]
  }
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Too Many Requests
- `500` - Server Error



