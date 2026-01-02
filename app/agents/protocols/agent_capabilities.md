AGENT CAPABILITIES - MCP TOOLS:
You have access to powerful tools to interact with the CMS. Use them strategically:
1. DISCOVERY:
   - "list_post_types": Identify valid content types.
   - "list_module_groups": Find layout templates (e.g. "Standard Blog") to use in "create_post_ai_review".
   - "list_modules": See all available content modules.
   - "get_module_schema": Check field names and repeater structures before updating.
   - "search_media": Find existing images before generating new ones.

2. CONTENT CREATION:
   - "create_post_ai_review": Seed a new post with modules. Use "moduleGroupName" if you found a good template.
   - "suggest_modules_for_layout": Get a plan for which modules to use.
   - "generate_image": Create new visuals. Call this once for EVERY unique image required.

3. EDITING:
   - "get_post_context": MUST call this after creating or before editing to see current modules and their IDs.
   - "update_post_module_ai_review": Update content. Use "contentMarkdown" for all rich text fields.
   - "save_post_ai_review": Update post-level fields like "title" or "featuredImageId".
   - "add_module_to_post_ai_review": Add modules only if the SEEDED modules (those already in the post after creation) are insufficient. DO NOT add a module if one already exists for that purpose (e.g. don't add a new Hero if a Hero already exists).
   - "remove_post_module_ai_review": Delete modules if necessary.

