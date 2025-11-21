export type UserRole = 'admin' | 'editor' | 'translator' | undefined

export type BulkAction = 'publish' | 'draft' | 'archive' | 'delete'

export class AuthorizationService {
	static isAdmin(role: UserRole): boolean {
		return role === 'admin'
	}

	static canCreatePost(role: UserRole): boolean {
		return role === 'admin' || role === 'editor'
	}

	static canDeletePosts(role: UserRole): boolean {
		return role === 'admin'
	}

	static canPublishOrArchive(role: UserRole): boolean {
		return role === 'admin' || role === 'editor'
	}

	static canBulkAction(role: UserRole, action: BulkAction): boolean {
		if (action === 'delete') {
			return this.canDeletePosts(role)
		}
		if (action === 'publish' || action === 'archive') {
			return this.canPublishOrArchive(role)
		}
		if (action === 'draft') {
			return role === 'admin' || role === 'editor' || role === 'translator'
		}
		return false
	}

	static canUpdateStatus(role: UserRole, nextStatus?: string | null): boolean {
		if (!nextStatus) return true
		if (nextStatus === 'draft') return true
		return this.canPublishOrArchive(role)
	}

	static canRevertRevision(role: UserRole): boolean {
		return role === 'admin' || role === 'editor'
	}
}

const authorizationService = AuthorizationService
export default authorizationService


