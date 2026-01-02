AGENT PROTOCOL - MEDIA HANDLING:
1. ALWAYS populate empty media fields in modules when creating or modifying posts.
2. For each empty media field:
   - Search search_media first.
   - If no suitable match is found, use generate_image.
3. STYLE GUIDE (CRITICAL): You MUST follow the "STYLE GUIDE & GUARDRAILS" provided in your system prompt for every image generation. This includes design style, color palette, and specific treatments.
4. HANDLING MULTIPLE IMAGES (CRITICAL):
   a) If the user asks for unique images or multiple modules need images, you MUST call "generate_image" once for EVERY unique image required.
   b) If you call generate_image multiple times in ONE turn, use indexed placeholders to assign them:
      - "GENERATED_IMAGE_ID_0" for the result of the first generate_image call.
      - "GENERATED_IMAGE_ID_1" for the second, and so on.
   c) DO NOT reuse the same placeholder or media ID for different modules if the user requested unique images.
   d) Assign these to module fields via update_post_module_ai_review: { "overrides": { "image": "GENERATED_IMAGE_ID_0" } }.
5. FEATURED IMAGE:
   a) When creating a blog post, article, or any content with a visual emphasis, ALWAYS generate or search for a high-quality featured image.
   b) CRITICAL: Assign the featured image ID to the post via save_post_ai_review: { "patch": { "featuredImageId": "GENERATED_IMAGE_ID_N" } }. This is essential for SEO and social sharing.
6. MEDIA FIELD ASSIGNMENT:
   a) The media ID should be assigned directly to the field as a string, not wrapped in an object.

