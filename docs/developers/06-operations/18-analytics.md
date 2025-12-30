# Native Analytics

Adonis EOS includes a built-in analytics system for tracking user behavior, page views, and interactions without relying on third-party scripts.

---

## 1. Overview

The analytics system consists of:

- **Tracking Endpoint**: A public API for logging events from the frontend.
- **Event Storage**: The `analytics_events` table (PostgreSQL).
- **Admin Dashboard**: Visualizations for views, clicks, and heatmaps.
- **Analytics Controller**: Handles data ingestion and summary generation.

## 2. Event Types

By default, the system tracks two primary event types:

- `view`: Triggered when a post is loaded.
- `click`: Triggered when a user clicks on an element (captures X/Y coordinates).

Custom event types can be sent via the tracking API.

---

## 3. Tracking Implementation

### Client-Side Tracking

To track events from your frontend (React/Inertia), send a `POST` request to `/api/public/analytics/track`.

```typescript
// Example: Tracking a custom event
const trackEvent = async (postId: string, eventType: string, metadata: any = {}) => {
  await fetch('/api/public/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postId,
      eventType,
      metadata,
      viewportWidth: window.innerWidth,
      // Optional: coordinates for heatmaps
      x: null,
      y: null
    })
  })
}
```

### Batch Tracking

The tracking endpoint accepts both single objects and arrays of objects for performance-efficient batching.

---

## 4. Heatmaps

The system captures relative X/Y coordinates and the viewport width for `click` events. This data is used in the Admin UI to generate heatmaps, allowing you to see exactly where users are clicking on a specific page.

To retrieve heatmap data for a post:
`GET /api/analytics/heatmap?postId=<uuid>&eventType=click`

---

## 5. Security & Privacy

- **Anonymization**: By default, the system does not store IP addresses or personally identifiable information (PII) in the `analytics_events` table.
- **Rate Limiting**: The tracking endpoint is rate-limited to prevent abuse.
- **Data Retention**: It is recommended to implement a periodic cleanup of old analytics data (e.g., via a scheduled task) to prevent the database from growing indefinitely.

