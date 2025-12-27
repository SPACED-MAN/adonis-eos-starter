# SEO & Analytics

Optimize your content for search engines and understand user behavior using native analytics, heatmaps, and A/B testing.

## Overview

Adonis EOS includes a lightweight, privacy-focused native analytics system that tracks how users interact with your content without needing heavy third-party scripts. Access these insights from **Admin → Settings → SEO/Analytics**.

---

## Native Analytics

Track overall site performance and individual post engagement directly in the admin panel.

### Traffic Over Time
The main dashboard provides a visual chart of **Views** and **Interactions** (clicks) over the last 30 days. This helps you identify trends and the impact of new content or marketing campaigns.

### Top Posts
See which content is performing best. The Top Posts table shows:
- **Total Views**: How many times the page has been loaded.
- **Interactions**: How many times users have clicked on the page.
- **Path**: The public URL of the content.

### Interaction Heatmaps
For any post in the "Top Posts" list, you can click **"View Heatmap"** to see a visual representation of where users are clicking.
- **Hotspots**: Bright orange circles indicate high-click areas.
- **Context**: The heatmap is overlaid on a live preview of your page, allowing you to see exactly which buttons, links, or images are drawing attention.
- **Privacy**: Native analytics are batched and sent non-blockingly to ensure zero impact on page load speed for your visitors.

---

## SEO Best Practices for Editors

Search Engine Optimization (SEO) helps your content rank higher in search results. Adonis EOS provides tools to manage SEO at both the global and per-page level.

### 1. Meta Title & Description

Every page should have a unique and compelling meta title and description.

- **Meta Title**: Appears in browser tabs and search results. Keep it under 60 characters.
- **Meta Description**: A brief summary of the page (150-160 characters). It should encourage users to click.

### 2. Canonical URLs

If you have multiple pages with similar content, use a **Canonical URL** to tell search engines which one is the "master" version. This prevents duplicate content penalties.

### 3. Robots Configuration

You can control how search engines interact with individual pages:

- **Index**: Allow search engines to show this page in results.
- **Follow**: Allow search engines to follow links on this page.
- **Noindex/No-follow**: Use these for private pages, thank-you pages, or temporary drafts.

### 4. Featured Images

Always set a **Featured Image** for your posts. This image is used when the page is shared on social media (Open Graph/Twitter).

---

## A/B Testing

A/B testing allows you to create multiple versions of a page to see which one performs better.

### How it Works

1.  **Primary Page (Var A)**: Your original page.
2.  **Variations (Var B, C, etc.)**: Clones of the primary page with different content, modules, or calls-to-action.
3.  **Traffic Split**: The system automatically splits incoming visitors between the variations.
4.  **Sticky Sessions**: A visitor will always see the same variation during their session (via cookies).

### Creating a Variation

1.  Open the page you want to test in the Editor.
2.  In the sidebar, locate the **A/B Variation** section.
3.  Click **"+ Create B"** (or the next available letter).
4.  The system will clone the entire page structure into a new variation.
5.  Edit the new variation (e.g., change the Hero headline or the button color).
6.  **Save** and **Publish** the variation to start the test.

### Visualizing Success

You can track the performance of your variations directly in the editor:

- **Views**: How many times each variation has been seen.
- **Conversion Rate**: The percentage of visitors who submitted a form on that variation.
- **Forms Admin**: In the **Forms** list, you can see which variation (A or B) generated each specific submission.

### SEO and A/B Testing

Adonis EOS handles the technical SEO for A/B tests automatically:

- **Shared URL**: All variations share the same public URL.
- **Canonicalization**: All variations automatically point to the primary page as their canonical source.
- **Noindex**: Variations are automatically set to `noindex` to prevent search engines from indexing the "internal" version of the variation.

### Ending a Test (Promoting a Winner)

Once you've identified which version performs better:

1.  Navigate to the winning variation in the editor.
2.  Click **"Promote as Winner"**.
3.  **Warning**: This will replace the primary page's content with the winner and delete all other variations. The A/B test will end, and all traffic will now see the winning content.

---

## Google Analytics Integration

If your site has Google Analytics (GA4) or Tag Manager installed, Adonis EOS automatically sends an event whenever a variation is viewed:

- **Event Name**: `ab_variation_view`
- **Parameters**: `ab_variation` (e.g., "B"), `ab_group_id` (the page ID).

You can use this data in Google Analytics to create segments and compare user behavior (like bounce rate or time on page) across your test variations.
