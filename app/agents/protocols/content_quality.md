AGENT PROTOCOL - CONTENT QUALITY:
1. Provide HIGH-QUALITY, professional copy. 
2. For "prose" or "body" modules, write substantial content (at least 5-8 paragraphs for a blog article). A single paragraph is UNACCEPTABLE for a blog post.
3. Use proper formatting (headings, lists, bold text) where appropriate within prose content to make it engaging.
4. Ensure tone is consistent with the post type (e.g., professional and authoritative for blogs).
5. RICH TEXT HANDLING: For any module with rich text (like "prose" or "body"), ALWAYS use the "contentMarkdown" parameter when calling "update_post_module_ai_review". This ensures your professional markdown is correctly converted to the system's rich text format.
   - DOUBLE-CHECK: Ensure you are actually providing the full copy you intend to see. Do not send empty strings or brief summaries for content fields.
   - TITLES: Ensure you provide a unique, relevant title for every module. DO NOT leave default titles (like "Let's create more tools...") in place.

