# Media Pipeline

Adonis EOS includes a built-in media pipeline:

- uploads to storage (local or S3-compatible)
- derivative generation (thumb/small/medium/large) via `sharp`
- optional optimization to webp
- category tagging + metadata for discovery

## Key files

- Controller: `app/controllers/media_controller.ts`
- Service: `app/services/media_service.ts`
- Storage: `app/services/storage_service.ts`
- Variant generation action: `app/actions/generate_media_variants_action.ts`
- Media field type (module props/custom fields): `app/fields/media.ts`

## Derivatives configuration

Derivatives are configured with env:

- `MEDIA_DERIVATIVES`

Default (if unset) in `media_service.ts`:

```
thumb:200x200_crop,small:400x,medium:800x,large:1600x
```

Notes:

- `_crop` uses `fit: cover` (square crops, etc.)
- non-crop uses `fit: inside`

## Dark mode variants

When generating dark variants, `media_service.ts` can apply a tunable transform:

- `MEDIA_DARK_BRIGHTNESS` (default ~0.55)
- `MEDIA_DARK_SATURATION` (default ~0.75)

## Optimized webp

`media_service.optimizeToWebp()` can generate a webp derivative:

- `MEDIA_WEBP_QUALITY` (default ~82)

## How media is referenced by modules

Modules commonly use a prop schema like:

```ts
image: { type: 'media', storeAs: 'id' }
```

This means editors store a **media asset id** in props; renderers resolve it through the media API/service.

## Storage Configuration

The media pipeline supports local and S3-compatible (specifically Cloudflare R2) storage. This is controlled by the `STORAGE_DRIVER` environment variable.

For detailed configuration instructions, see the [Deployment Guide: Persistent Storage](../01-getting-started/03-deployment.md#4-persistent-storage).

## AI-Generated Media

The media pipeline is integrated with AI agents for automated image generation:

- **Tools**: Agents use the `generate_image` MCP tool to create new assets.
- **Providers**: Supports OpenAI (DALL-E) and Google (Imagen).
- **Staging**: Generated images are automatically downloaded, optimized, and saved to the CMS media library before being staged in the post's review draft.
- **Config**: Providers and models are configured at the agent level (see `providerMedia` and `modelMedia` in the [AI Agents documentation](../04-automation-and-ai/06b-ai-agents.md)).

## Operational notes

- If you add new derivative specs, consider a backfill job to regenerate variants for existing assets.
- If you change storage backends, ensure existing URLs remain valid or provide redirect/migration logic.
