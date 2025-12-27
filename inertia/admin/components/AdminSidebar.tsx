import { usePage, Link } from '@inertiajs/react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarMenuItem,
} from '~/components/ui/sidebar'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useState } from 'react'
import { useHasPermission } from '~/utils/permissions'
import { useAdminPath } from '~/utils/adminPath'
import {
  faImage,
  faFileLines,
  faCubes,
  faBars,
  faGear,
  faRoute,
  faRightLeft,
  faLanguage,
  faTags,
  faUsers,
  faEnvelope,
  faDatabase,
  faMagnifyingGlass,
  faShield,
  faRobot,
  faTimeline,
} from '@fortawesome/free-solid-svg-icons'
import { faGauge } from '@fortawesome/free-solid-svg-icons'

export function AdminSidebar() {
  const page = usePage()
  const pathname = (page?.url || '').split('?')[0]
  const adminPath = useAdminPath()
  const isActive = (href: string) => pathname === href
  const role: string | undefined =
    ((page.props as any)?.auth?.user?.role as string | undefined) ??
    ((page.props as any)?.currentUser?.role as string | undefined)
  const isAdmin = role === 'admin'
  const canAccessMedia = useHasPermission('media.view')
  const canAccessPosts = useHasPermission('posts.edit')
  const canAccessTaxonomies = useHasPermission('taxonomies.view')
  const canAccessMenus = useHasPermission('menus.view')
  const canAccessForms = useHasPermission('forms.view')
  const canAccessAgents = useHasPermission('agents.view')
  const canAccessWorkflows = useHasPermission('workflows.view')
  const canAccessGlobals = useHasPermission('globals.view')
  const canAccessUsers = useHasPermission('admin.users.manage')
  const canAccessSettings = useHasPermission('admin.settings.view')

  const features = (page.props as any)?.features || {
    forms: true,
    taxonomies: true,
    menus: true,
    locales: true,
    agents: true,
    workflows: true,
    modules: true,
  }
  const userEmail =
    ((page.props as any)?.auth?.user?.email as string | undefined) ||
    ((page.props as any)?.currentUser?.email as string | undefined) ||
    'User'
  const userId: number | null =
    ((page.props as any)?.auth?.user?.id as number | undefined) ??
    ((page.props as any)?.currentUser?.id as number | undefined) ??
    null
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/profile/status', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        const u = j?.data?.profileThumbUrl
        if (alive && typeof u === 'string' && u) setAvatarUrl(u)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      alive = false
    }
  }, [])
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-8 h-8 rounded-full border border-line-low object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-backdrop-medium border border-line-medium" />
            )}
            <div className="text-sm">
              <div className="font-semibold text-neutral-high">{userEmail}</div>
              <div className="text-neutral-low text-xs">
                <Link
                  href={userId ? adminPath(`users/${userId}/edit`) : adminPath('profile')}
                  className="hover:underline"
                >
                  Manage Account
                </Link>
              </div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarGroup title="Content">
          <SidebarMenuItem href={adminPath()} active={isActive(adminPath())}>
            <span className="inline-flex items-center gap-2">
              <FontAwesomeIcon icon={faGauge} className="w-4 h-4" /> <span>Dashboard</span>
            </span>
          </SidebarMenuItem>
          {canAccessMedia && (
            <SidebarMenuItem href={adminPath('media')} active={isActive(adminPath('media'))}>
              <span className="inline-flex items-center gap-2">
                <FontAwesomeIcon icon={faImage} className="w-4 h-4" /> <span>Media</span>
              </span>
            </SidebarMenuItem>
          )}
          {canAccessPosts && (
            <SidebarMenuItem href={adminPath('posts')} active={isActive(adminPath('posts'))}>
              <span className="inline-flex items-center gap-2">
                <FontAwesomeIcon icon={faFileLines} className="w-4 h-4" /> <span>Posts</span>
              </span>
            </SidebarMenuItem>
          )}
          {canAccessGlobals && features.modules && (
            <SidebarMenuItem href={adminPath('modules')} active={isActive(adminPath('modules'))}>
              <span className="inline-flex items-center gap-2">
                <FontAwesomeIcon icon={faCubes} className="w-4 h-4" /> <span>Modules</span>
              </span>
            </SidebarMenuItem>
          )}
          {canAccessForms && features.forms && (
            <SidebarMenuItem href={adminPath('forms')} active={isActive(adminPath('forms'))}>
              <span className="inline-flex items-center gap-2">
                <FontAwesomeIcon icon={faEnvelope} className="w-4 h-4" /> <span>Forms</span>
              </span>
            </SidebarMenuItem>
          )}
          {canAccessMenus && features.menus && (
            <SidebarMenuItem href={adminPath('menus')} active={isActive(adminPath('menus'))}>
              <span className="inline-flex items-center gap-2">
                <FontAwesomeIcon icon={faBars} className="w-4 h-4" /> <span>Menus</span>
              </span>
            </SidebarMenuItem>
          )}
          {canAccessTaxonomies && features.taxonomies && (
            <SidebarMenuItem
              href={adminPath('categories')}
              active={isActive(adminPath('categories'))}
            >
              <span className="inline-flex items-center gap-2">
                <FontAwesomeIcon icon={faTags} className="w-4 h-4" /> <span>Categories</span>
              </span>
            </SidebarMenuItem>
          )}
        </SidebarGroup>
        {(isAdmin || canAccessSettings || canAccessUsers) && (
          <SidebarGroup title="Settings">
            {(isAdmin || canAccessSettings) && (
              <>
                <SidebarMenuItem
                  href={adminPath('settings/general')}
                  active={isActive(adminPath('settings/general'))}
                >
                  <span className="inline-flex items-center gap-2">
                    <FontAwesomeIcon icon={faGear} className="w-4 h-4" /> <span>Site Settings</span>
                  </span>
                </SidebarMenuItem>
                <SidebarMenuItem
                  href={adminPath('settings/url-patterns')}
                  active={isActive(adminPath('settings/url-patterns'))}
                >
                  <span className="inline-flex items-center gap-2">
                    <FontAwesomeIcon icon={faRoute} className="w-4 h-4" /> <span>URL Patterns</span>
                  </span>
                </SidebarMenuItem>
                <SidebarMenuItem
                  href={adminPath('settings/redirects')}
                  active={isActive(adminPath('settings/redirects'))}
                >
                  <span className="inline-flex items-center gap-2">
                    <FontAwesomeIcon icon={faRightLeft} className="w-4 h-4" />{' '}
                    <span>Redirects</span>
                  </span>
                </SidebarMenuItem>
                <SidebarMenuItem
                  href={adminPath('settings/seo')}
                  active={isActive(adminPath('settings/seo'))}
                >
                  <span className="inline-flex items-center gap-2">
                    <FontAwesomeIcon icon={faMagnifyingGlass} className="w-4 h-4" />{' '}
                    <span>SEO/Analytics</span>
                  </span>
                </SidebarMenuItem>
                {features.locales && (
                  <SidebarMenuItem
                    href={adminPath('settings/locales')}
                    active={isActive(adminPath('settings/locales'))}
                  >
                    <span className="inline-flex items-center gap-2">
                      <FontAwesomeIcon icon={faLanguage} className="w-4 h-4" /> <span>Locales</span>
                    </span>
                  </SidebarMenuItem>
                )}
              </>
            )}
            {canAccessUsers && (
              <SidebarMenuItem href={adminPath('users')} active={isActive(adminPath('users'))}>
                <span className="inline-flex items-center gap-2">
                  <FontAwesomeIcon icon={faUsers} className="w-4 h-4" /> <span>Users</span>
                </span>
              </SidebarMenuItem>
            )}
          </SidebarGroup>
        )}
        {isAdmin && (
          <SidebarGroup title="System">
            {canAccessAgents && features.agents && (
              <SidebarMenuItem href={adminPath('agents')} active={isActive(adminPath('agents'))}>
                <span className="inline-flex items-center gap-2">
                  <FontAwesomeIcon icon={faRobot} className="w-4 h-4" /> <span>Agents</span>
                </span>
              </SidebarMenuItem>
            )}
            {canAccessWorkflows && features.workflows && (
              <SidebarMenuItem
                href={adminPath('workflows')}
                active={isActive(adminPath('workflows'))}
              >
                <span className="inline-flex items-center gap-2">
                  <FontAwesomeIcon icon={faTimeline} className="w-4 h-4" /> <span>Workflows</span>
                </span>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem href={adminPath('security')} active={isActive(adminPath('security'))}>
              <span className="inline-flex items-center gap-2">
                <FontAwesomeIcon icon={faShield} className="w-4 h-4" /> <span>Security</span>
              </span>
            </SidebarMenuItem>
            <SidebarMenuItem href={adminPath('database')} active={isActive(adminPath('database'))}>
              <span className="inline-flex items-center gap-2">
                <FontAwesomeIcon icon={faDatabase} className="w-4 h-4" /> <span>Database</span>
              </span>
            </SidebarMenuItem>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
