/*
|--------------------------------------------------------------------------
| JavaScript entrypoint for running ace commands
|--------------------------------------------------------------------------
|
| DO NOT MODIFY THIS FILE AS IT WILL BE OVERRIDDEN DURING THE BUILD
| PROCESS.
|
| See docs.adonisjs.com/guides/typescript-build-process#creating-production-build
|
| Since, we cannot run TypeScript source code using "node" binary, we need
| a JavaScript entrypoint to run ace commands.
|
| This file registers the "ts-node/esm" hook with the Node.js module system
| and then imports the "bin/console.ts" file.
|
*/

/**
 * Ensure the process working directory is the project root.
 *
 * Cursor starts MCP stdio servers without setting `cwd`, which can cause Adonis/Ace
 * to crash when code assumes `process.cwd()` points at the app root.
 */
import { fileURLToPath } from 'node:url'
import path from 'node:path'
try {
  const appRoot = path.dirname(fileURLToPath(import.meta.url))
  process.chdir(appRoot)
} catch {
  // ignore
}

/**
 * Register hook to process TypeScript files using ts-node-maintained.
 *
 * NOTE: This must be a dynamic import so we can `chdir()` before ts-node
 * evaluates tsconfig resolution (Cursor launches MCP processes without cwd).
 */
await import('ts-node-maintained/register/esm')

/**
 * Cursor/stdio MCP mode must not write non-protocol output to stdout.
 * When we detect stdio MCP, enable "quiet" boot to prevent start/* logging.
 */
try {
  const argv = process.argv || []
  const isMcpServe = argv.includes('mcp:serve')
  const isStdio =
    argv.includes('--transport=stdio') ||
    argv.includes('--transport', 'stdio') ||
    process.env.MCP_TRANSPORT === 'stdio'
  if (isMcpServe && isStdio) {
    process.env.MCP_QUIET = process.env.MCP_QUIET || '1'
    process.env.MCP_TRANSPORT = 'stdio'
  }
} catch {
  // ignore
}

/**
 * Import ace console entrypoint
 */
await import('./bin/console.js')
