# Preview System

Adonis EOS supports secure, time-limited preview links so draft/review content can be shared safely.

## Key files

- Service: `app/services/preview_service.ts`
- Controller/routes: preview endpoint(s) (see `start/routes.ts`) and token table `preview_tokens`
- MCP tools:
  - `create_post_preview_link`
  - `list_post_preview_links`
  - `revoke_post_preview_link`

## How preview links work

Preview links include:

- `postId`
- `token`
- `sig` (HMAC signature)
- `exp` (expiration)

The signature is computed as:

```
sha256_hmac(secret, `${token}:${postId}:${expiresAtIso}`)
```

Tokens are stored in DB (`preview_tokens`) and can be revoked.

## Security model

- Tokens expire automatically after the configured duration.
- Tokens must exist in DB (revocation is immediate).
- Signature prevents tampering with token/post/expiration.

## Configuration

Preview config comes from `config/cms.ts`:

- `cmsConfig.preview.secret` (required in production)
- `cmsConfig.preview.linkExpirationHours`

## Operational notes

- Rotate the secret carefully: it will invalidate old signatures (which is often acceptable).
- Periodically run token cleanup if you expect high volume (`previewService.cleanupExpiredTokens()`).
