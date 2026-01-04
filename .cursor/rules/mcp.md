# MCP (Model Context Protocol)

Guidelines for using and extending the MCP server in Adonis EOS.

## Overview

The MCP server provides a bridge between external LLM runtimes (like Cursor or n8n) and the Adonis EOS application state. It allows agents to retrieve structured context and perform staged mutations.

## Core Principles

1.  **Read-Heavily, Write-Safely**: MCP tools prioritize providing deep context (`get_post_manifest`, `inspect_module_definition`). Writes are always staged into AI Review or similar staging modes.
2.  **Code-Derived Context**: Context is sourced from backend registries (`PostTypeRegistry`, `ModuleRegistry`), ensuring the AI always has the current application schema.
3.  **Auditability**: All significant MCP actions are logged via `ActivityLogService`.

## Key Developer & Debugging Tools

The following tools are specifically useful for AI models during development and debugging:

### Context & Introspection
- `list_registry_items`: Returns a structured list of all registered Post Types, Modules, and Forms. Use this first to understand the project structure.
- `inspect_module_definition`: Returns the `defaultProps`, `config`, and component name for a specific module.
- `get_post_manifest`: Aggregates a post, its modules, overrides, and custom fields into a single flattened tree. Use this to debug page state.

### Debugging & Testing
- `tail_activity_logs`: Returns the latest entries from the activity logs. Useful for verifying that actions are being recorded correctly.
- `simulate_webhook_event`: Manually triggers a webhook event with a mock payload.
- `check_media_integrity`: Verifies that a database record for a media asset has corresponding files on disk/storage, including all variants.
- `test_local_route`: Make requests to local API endpoints or pages. Use this to verify your changes without asking the user to manually test.
- `read_server_logs`: Read the latest terminal output. Essential for finding the root cause of 500 errors or seeing `console.log` output.
- `create_post_preview_link`: Generate a signed link to view a post. Visit this link using the **Browser Tool** to see high-fidelity rendering (React SSR).
- `trace_url_resolution`: Map a URL path back to a Post ID or URL Pattern.
- `validate_mcp_payload`: Perform a "dry run" validation of module props before saving.

### System Interaction
- `run_ace_command`: A controlled wrapper for executing `node ace` commands (e.g., `list:routes`).

## AI Collaboration & Verification Workflow

To keep the backend codebase clean and follow DRY principles, do not implement manual HTML rendering in the backend. Instead, follow this verification workflow:

1.  **Generate a Preview Link**: Call `create_post_preview_link` to get a signed, short-lived URL for any post.
2.  **Use the Browser Tool**: Visit the generated URL using your internal browser.
3.  **Inspect High-Fidelity Output**: The page will be rendered using the actual React/Inertia SSR logic. Use the `browser_snapshot` or `browser_take_screenshot` tools to verify layout, CSS, and content.

### Proactive Communication Guidelines

- **Propose Rendering Checks**: If a UI issue is reported or you've made a layout change, proactively ask: *"Should I preview the page to verify the rendering?"*
- **Persistence on Failure**: If a previous attempt to fix a UI issue did not work, **ALWAYS** propose a rendering check before attempting another blind fix.
- **Collaborative Debugging**: Use the internal browser to "see" the issue yourself, then explain what you've found to the user before proposing the next code change.

## Module Content Guidelines

1.  **Avoid Default Props**: When using modules, NEVER populate copy fields with their default values (e.g., "Lorem Ipsum").
2.  **Substantial Content**: For prose-heavy modules, provide multiple paragraphs and proper formatting.
3.  **Unique Titles**: Ensure every module has a unique, relevant title.

## Extending MCP

To add a new tool:
1.  Define the tool in `commands/mcp_serve.ts` using `server.tool(...)`.
2.  Add the same tool logic to `app/services/mcp_client_service.ts` so internal agents can use it.
3.  Update the documentation in `docs/developers/04-automation-and-ai/06c-mcp.md`.

## Example: Introspecting a Module

When tasked with adding a module to a post, always check its definition first:

```typescript
// Call this via MCP
const definition = await mcp.inspect_module_definition({ moduleSlug: 'hero' });
// Result includes defaultProps, which helps you construct the correct payload.
```

