# Webhooks

Adonis EOS includes a first-class webhook system for event-driven integrations (n8n, Zapier-like services, custom backends, etc.).

## Overview

- Webhooks are configured in the database (admin UI) and dispatched by the backend.
- Each webhook subscribes to one or more **events** (e.g. `post.published`).
- Deliveries are recorded in `webhook_deliveries` for debugging and retries.

## Enabling / Configuration

Webhooks are gated by config:

- `cmsConfig.webhooks.enabled` (see `config/cms.ts`)

Each webhook record supports:

- **name**: display name
- **url**: destination URL
- **events**: array of subscribed events
- **secret**: per-webhook signing secret (optional)
- **headers**: additional headers (optional)
- **timeoutMs**: request timeout
- **maxRetries**: retry count with exponential backoff

## Events

Supported events are defined in `app/services/webhook_service.ts`:

- `post.created`, `post.updated`, `post.published`, `post.unpublished`, `post.deleted`, `post.restored`
- `media.uploaded`, `media.deleted`
- `user.created`, `user.updated`
- `settings.updated`
- `form.submitted`

## Payload + signature verification

Webhook requests are `POST` with JSON body:

```json
{
  "event": "post.updated",
  "timestamp": "2025-12-12T00:00:00.000Z",
  "data": { "...": "..." }
}
```

Headers include:

- `X-Webhook-Event`
- `X-Webhook-Timestamp`
- `X-Webhook-Delivery-Attempt`
- `X-Webhook-Signature` (optional): `sha256=<hex>`

Signature behavior:

- If the webhook row has a `secret`, the signature uses that secret.
- Otherwise, if `cmsConfig.webhooks.secret` is set, it is used as a global fallback.

### Verifying signatures (Node example)

```js
import crypto from 'node:crypto'

export function verifyWebhook(reqBodyString, signatureHeader, secret) {
  const expected = crypto.createHmac('sha256', secret).update(reqBodyString).digest('hex')
  return signatureHeader === `sha256=${expected}`
}
```

## Admin API

Admin endpoints (see `app/controllers/webhooks_controller.ts`):

- `GET /api/webhooks` (list)
- `POST /api/webhooks` (create)
- `PUT /api/webhooks/:id` (update)
- `DELETE /api/webhooks/:id` (delete)
- `GET /api/webhooks/:id/deliveries?limit=50` (delivery history)
- `POST /api/webhooks/:id/test` (test delivery)

## Operational guidance

- **Always verify signature** (or restrict by network/IP) before trusting payloads.
- **Return 2xx quickly**; do heavy work async in your receiver.
- **Idempotency**: treat retries as normal; dedupe by `(event, timestamp)` or by a delivery id if you add one on your side.
- **Timeouts**: keep receiver fast; Adonis will abort after `timeoutMs`.
