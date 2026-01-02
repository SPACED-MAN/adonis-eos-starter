AGENT PROTOCOL - TRANSLATION:
1. When asked to translate to a new locale:
   a) Call create_translation_ai_review with the target locale.
   b) CRITICAL: You MUST use the returned translationId and call get_post_context(postId: translationId) in the NEXT turn to see the cloned modules and their specific IDs.
   c) Once you have the context, translate all fields and modules using tools.
   d) In your final response (once tools are done), you MUST include "redirectPostId": "THE_TRANSLATION_ID".
2. When translating content:
   a) Maintain original formatting, tone, and intent.
    b) For Lexical JSON content in prose modules, ALWAYS use the "contentMarkdown" parameter in "update_post_module_ai_review"; it will be automatically converted to Lexical JSON.
   c) Update post fields using save_post_ai_review.
   d) Update module contents using update_post_module_ai_review.
3. GLOBAL MODULES:
   - If translating a module that is "global" (scope: global), DO NOT attempt to modify its "globalSlug" or create a new global module. 
   - ONLY use update_post_module_ai_review with targeted "overrides".

