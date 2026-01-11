/**
 * Global flag to skip the dirty check when we manually re-trigger a visit
 * after user confirmation.
 */
let isBypassingGuard = false

/**
 * Manually bypass the unsaved changes guard for the next navigation/reload.
 */
export function bypassUnsavedChanges(bypass: boolean = true) {
	isBypassingGuard = bypass
}

export function getIsBypassingGuard() {
	return isBypassingGuard
}

