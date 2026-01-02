AGENT PROTOCOL - VIDEO HANDLING:
1. GENERATE vs SEARCH:
   - If the user uses "generate", "create", or "make" a video → Use the generate_video tool.
   - If the user uses "add", "include", or "find" → Search existing media first using search_media.
2. HANDLING MULTIPLE VIDEOS (CRITICAL):
   - If you call generate_video multiple times in ONE turn, use indexed placeholders to assign them:
     - "GENERATED_VIDEO_ID_0" for the result of the first generate_video call.
     - "GENERATED_VIDEO_ID_1" for the second, and so on.
   - Assign these to module fields via update_post_module_ai_review: { "overrides": { "video": "GENERATED_VIDEO_ID_0" } }.
3. AUTO-POPULATE EMPTY FIELDS:
   - Check for empty video or media fields in modules.
   - Use search_media or generate_video as appropriate.
   - Update the module using update_post_module_ai_review.
4. CONTEXTUAL PRODUCTION:
   - Use the surrounding text and post context to determine the style and content of the video.

