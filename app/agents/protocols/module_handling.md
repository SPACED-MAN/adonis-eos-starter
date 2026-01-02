AGENT PROTOCOL - MODULE HANDLING:
1. When asked to create or modify a page from a brief or copy:
   a) ALWAYS use "list_module_groups" to see available layout templates for the post type. If a template matches the user's intent (e.g., "Standard Blog"), use its "name" in "create_post_ai_review".
   b) Use "suggest_modules_for_layout" with the content brief to identify the most appropriate modules.
   c) DO NOT just dump all content into a single "prose" module. Split content into logical modules (e.g., use "features-list" for features, "faq" for questions, "hero" for the top banner).
   d) Use "get_module_schema" to see full schemas for ANY module you plan to use, especially for repeaters (arrays of objects). You MUST identify the correct field slugs for both the repeater itself and the fields within its items.
2. Build the page structure:
   a) If creating a new post, use "create_post_ai_review" (optionally with "moduleGroupName").
   b) CRITICAL: After creation, ALWAYS use "get_post_context" to see what was seeded. DO NOT add new modules if the seeded modules already fulfill the roles suggested by "suggest_modules_for_layout".
   c) If and ONLY IF suggested modules are missing from the seeded set, use "add_module_to_post_ai_review" to add them. Ensure "orderIndex" values do not conflict with existing modules.
   d) Use "update_post_module_ai_review" (or "moduleEdits" in "create_post_ai_review") to populate content.
3. GLOBAL MODULES:
   a) DO NOT create new global modules (scope: 'global') unless specifically asked to create a reusable component.
   b) If you see an existing global module in "get_post_context", DO NOT attempt to modify its "globalSlug" or replace it with a new global module. 
   c) Prefer "local" scope for most content additions.
4. REPEATER HANDLING (CRITICAL):
   a) Modules like "features-list", "faq", and "pricing" use repeaters (arrays of objects).
   b) When updating a repeater, you MUST provide the ENTIRE array of objects. Each object must contain ALL necessary fields (e.g., "title", "body", "icon").
   c) Partial updates to repeater items are not supported; providing an empty object {} for an item will wipe out its default content. ALWAYS populate all fields in every repeater item.
5. Use "update_post_module_ai_review" to refine content if needed after initial creation.
   - MERGE BEHAVIOR: This tool performs a deep merge. You only need to provide the specific fields you want to change (e.g., just the "image" ID or just the "contentMarkdown"). Other existing fields will be preserved.
   - For prose or rich text modules, ALWAYS use the "contentMarkdown" parameter to provide text content. The system will handle the Lexical JSON conversion.
   - Example: { "postModuleId": "...", "contentMarkdown": "## New Title\n\nNew paragraph content..." }
   - DO NOT add a new "prose" module if one already exists with default content; update the existing one instead.

