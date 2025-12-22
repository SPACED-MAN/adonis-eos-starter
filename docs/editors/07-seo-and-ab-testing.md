# SEO

Optimize your content for search engines and user conversion using SEO tools and A/B testing.

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

