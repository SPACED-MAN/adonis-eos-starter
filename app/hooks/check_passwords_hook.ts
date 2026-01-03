import { execSync } from 'node:child_process'
import { join } from 'node:path'

/**
 * AdonisJS Build Hook to ensure no 'supersecret' passwords remain in the codebase
 * during production builds.
 */
export default async function checkPasswordsHook() {
	const isProduction = process.env.NODE_ENV === 'production'

	// We only strictly enforce this for production builds
	if (!isProduction) {
		return
	}

	console.log('🛡️  Running production security check: scanning for "supersecret" passwords...')

	const forbiddenString = 'supersecret'
	const sensitiveDirs = ['database', 'app', 'config']
	const excludedFiles = ['development-export.json']

	let found = false
	const findings: string[] = []

	for (const dir of sensitiveDirs) {
		try {
			const excludeArgs = excludedFiles.map(file => `--exclude="${file}"`).join(' ')
			const cmd = `grep -rn "${forbiddenString}" ${excludeArgs} "${join(process.cwd(), dir)}" 2>/dev/null`
			const output = execSync(cmd).toString().trim()

			if (output) {
				const lines = output.split('\n')
				for (const line of lines) {
					if (line.includes('isDevelopment') || line.includes('env.get')) {
						continue
					}
					findings.push(line)
					found = true
				}
			}
		} catch (error) {
			// grep returns exit code 1 if no matches found
		}
	}

	if (found) {
		console.error('\n❌ SECURITY VIOLATION: Forbidden password string "supersecret" found in production build!')
		findings.forEach(line => console.error(`  - ${line}`))
		console.error('\nPlease replace these hardcoded passwords with environment variables (e.g., env.get("SEEDER_PASSWORD")) before building for production.\n')

		// In a build hook, throwing an error will stop the build
		throw new Error('Production security check failed')
	}

	console.log('✅ Security check passed: No "supersecret" passwords found in sensitive directories.')
}




