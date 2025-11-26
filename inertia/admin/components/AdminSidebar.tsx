import { usePage, Link } from '@inertiajs/react'
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
	SidebarGroup,
	SidebarMenuItem,
} from '~/components/ui/sidebar'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faImage,
	faFileLines,
	faCubes,
	faLayerGroup,
	faGear,
	faRoute,
	faRightLeft,
	faLanguage,
	faTags,
	faUsers,
} from '@fortawesome/free-solid-svg-icons'

export function AdminSidebar() {
	const page = usePage()
	const pathname = (page?.url || '').split('?')[0]
	const isActive = (href: string) => pathname === href
	const userEmail =
		((page.props as any)?.auth?.user?.email as string | undefined) ||
		((page.props as any)?.currentUser?.email as string | undefined) ||
		'User'
	return (
		<Sidebar>
			<SidebarContent>
				<SidebarHeader>
					<div className="flex items-center gap-2">
						<div className="w-8 h-8 rounded-full bg-backdrop-medium border border-line" />
						<div className="text-sm">
							<div className="font-semibold text-neutral-high">{userEmail}</div>
							<div className="text-neutral-low text-xs">Profile (coming soon)</div>
						</div>
					</div>
				</SidebarHeader>
				<SidebarGroup title="Content">
					<SidebarMenuItem href="/admin/media" active={isActive('/admin/media')}>
						<span className="inline-flex items-center gap-2">
							<FontAwesomeIcon icon={faImage} className="w-4 h-4" /> <span>Media</span>
						</span>
					</SidebarMenuItem>
					<SidebarMenuItem href="/admin/posts" active={isActive('/admin/posts')}>
						<span className="inline-flex items-center gap-2">
							<FontAwesomeIcon icon={faFileLines} className="w-4 h-4" /> <span>Posts</span>
						</span>
					</SidebarMenuItem>
					<SidebarMenuItem href="/admin/modules" active={isActive('/admin/modules')}>
						<span className="inline-flex items-center gap-2">
							<FontAwesomeIcon icon={faCubes} className="w-4 h-4" /> <span>Modules</span>
						</span>
					</SidebarMenuItem>
					<SidebarMenuItem href="/admin/templates" active={isActive('/admin/templates')}>
						<span className="inline-flex items-center gap-2">
							<FontAwesomeIcon icon={faLayerGroup} className="w-4 h-4" /> <span>Templates</span>
						</span>
					</SidebarMenuItem>
				</SidebarGroup>
				<SidebarGroup title="Settings">
					<SidebarMenuItem href="/admin/settings/general" active={isActive('/admin/settings/general')}>
						<span className="inline-flex items-center gap-2">
							<FontAwesomeIcon icon={faGear} className="w-4 h-4" /> <span>Site Settings</span>
						</span>
					</SidebarMenuItem>
					<SidebarMenuItem href="/admin/settings/url-patterns" active={isActive('/admin/settings/url-patterns')}>
						<span className="inline-flex items-center gap-2">
							<FontAwesomeIcon icon={faRoute} className="w-4 h-4" /> <span>URL Patterns</span>
						</span>
					</SidebarMenuItem>
					<SidebarMenuItem href="/admin/settings/redirects" active={isActive('/admin/settings/redirects')}>
						<span className="inline-flex items-center gap-2">
							<FontAwesomeIcon icon={faRightLeft} className="w-4 h-4" /> <span>Redirects</span>
						</span>
					</SidebarMenuItem>
					<SidebarMenuItem href="/admin/settings/locales" active={isActive('/admin/settings/locales')}>
						<span className="inline-flex items-center gap-2">
							<FontAwesomeIcon icon={faLanguage} className="w-4 h-4" /> <span>Locales</span>
						</span>
					</SidebarMenuItem>
					<SidebarMenuItem href="/admin/settings/post-types" active={isActive('/admin/settings/post-types')}>
						<span className="inline-flex items-center gap-2">
							<FontAwesomeIcon icon={faTags} className="w-4 h-4" /> <span>Post Types</span>
						</span>
					</SidebarMenuItem>
				</SidebarGroup>
				<SidebarGroup title="Users">
					<SidebarMenuItem href="/admin/users" active={isActive('/admin/users')}>
						<span className="inline-flex items-center gap-2">
							<FontAwesomeIcon icon={faUsers} className="w-4 h-4" /> <span>User Management</span>
						</span>
					</SidebarMenuItem>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	)
}


