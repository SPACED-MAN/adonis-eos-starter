# Internationalization (i18n)

Adonis EOS provides comprehensive multi-language support for global content delivery.

## Locale Configuration

Configure available locales in `.env`:

```env
LOCALES=en,es,fr,de
DEFAULT_LOCALE=en
```

## Content Translation

### Post-Level Translation

Each post has a locale:

```typescript
{
  "title": "Welcome",
  "slug": "welcome",
  "locale": "en",
  "type": "page"
}
```

Create translations by creating new posts with:

- Same slug
- Different locale
- Linked via slug matching

### Module Translation

Mark props as translatable in module schema:

```typescript
propsSchema: {
  title: {
    type: 'string',
    translatable: true,  // This content varies by language
  },
  maxItems: {
    type: 'number',
    translatable: false,  // This stays the same
  }
}
```

### URL Structure

Localized URLs follow this pattern:

```
/welcome              → Default locale (en)
/es/bienvenido        → Spanish version
/fr/bienvenue         → French version
```

### API Usage

Fetch content by locale:

```http
GET /api/posts?locale=es&type=page
```

## Menu Translation

Create separate menus per locale:

```http
GET /api/menus/primary?locale=en  → English menu
GET /api/menus/primary?locale=es  → Spanish menu
```

Each menu can have locale-specific:

- Item labels
- URLs
- Structure

## Translation Workflow

### 1. Create Source Content

Create the original content in the default locale (usually `en`).

### 2. Duplicate for Translation

In the admin:

1. Open the source post
2. Click "Duplicate"
3. Change locale to target language
4. Update slug (e.g., `welcome` → `bienvenido`)
5. Save as draft

### 3. Translate Content

Editors with appropriate permissions can:

- Edit translatable module props
- Update title, slug, and metadata
- Keep non-translatable settings unchanged

### 4. Publish Translation

Once reviewed, publish the translated version.

## Language Switching

### Frontend Implementation

```tsx
// Get current locale from URL
const locale = window.location.pathname.split('/')[1] || 'en'

// Switch language
const switchLocale = (newLocale: string) => {
  const currentSlug = getCurrentSlug()
  window.location.href = `/${newLocale}/${currentSlug}`
}

// Language switcher component
;<select value={locale} onChange={(e) => switchLocale(e.target.value)}>
  <option value="en">English</option>
  <option value="es">Español</option>
  <option value="fr">Français</option>
</select>
```

### Finding Translations

To find all translations of a post:

```http
GET /api/posts?slug=welcome&allLocales=true
```

Returns all locale versions of posts with that slug.

## Best Practices

### Content Guidelines

1. **Keep slugs consistent** - Use translated versions
2. **Maintain structure** - Same modules in same order
3. **Cultural adaptation** - Don't just translate, localize
4. **Test thoroughly** - Check all locales before launch

### Technical Guidelines

1. **Use locale-aware routes** - Always include locale in URLs
2. **Default fallbacks** - Fall back to default locale if translation missing
3. **SEO optimization** - Use `hreflang` tags
4. **Date formatting** - Respect locale-specific formats
5. **RTL support** - Consider right-to-left languages

## Role-Based Translation

The **Translator** role has permissions to:

- View all content
- Edit translatable fields
- Save drafts for review
- Cannot publish or delete

Perfect for translation teams!

## Forms and i18n

Forms can have locale-specific versions:

```typescript
{
  "slug": "contact",
  "locale": "en",
  "fields": [
    { "label": "Name", "name": "name" }
  ]
}
```

Create separate form definitions per locale.

## Common Patterns

### Loading Translations

```typescript
// Get posts for current locale
const posts = await fetch(`/api/posts?locale=${currentLocale}`)

// Get post with fallback
const post = await fetch(`/api/posts/${slug}?locale=${locale}`).catch(() =>
  fetch(`/api/posts/${slug}?locale=en`)
)
```

### Locale Detection

```typescript
// From URL
const urlLocale = window.location.pathname.split('/')[1]

// From browser
const browserLocale = navigator.language.split('-')[0]

// From cookie
const savedLocale = cookies.get('locale')

// Priority: URL > Cookie > Browser > Default
const locale = urlLocale || savedLocale || browserLocale || 'en'
```

## Troubleshooting

**Issue**: Content not showing in new locale

- **Solution**: Ensure post exists with correct locale value

**Issue**: Menu showing wrong language

- **Solution**: Create locale-specific menu or verify API call includes `?locale=`

**Issue**: Editor can't edit translations

- **Solution**: Check role has appropriate permissions in role configuration
