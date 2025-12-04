import type { RoleDefinition, RoleName, PermissionKey } from '#types/role_types'

class RoleRegistry {
  private roles = new Map<RoleName, RoleDefinition>()

  register(def: RoleDefinition) {
    const name = String(def.name || '').trim() as RoleName
    if (!name) return
    if (this.roles.has(name)) {
      throw new Error(`Role '${name}' is already registered`)
    }
    this.roles.set(name, {
      ...def,
      name,
      permissions: Array.from(new Set(def.permissions)) as PermissionKey[],
    })
  }

  /**
   * Admin role must always exist; we treat it as superuser.
   */
  get(name: RoleName): RoleDefinition | undefined {
    return this.roles.get(name)
  }

  /**
   * Return all registered roles, sorted by name.
   */
  list(): RoleDefinition[] {
    return Array.from(this.roles.values()).sort((a, b) =>
      String(a.label || a.name).localeCompare(String(b.label || b.name))
    )
  }

  hasPermission(roleName: RoleName | null | undefined, permission: PermissionKey): boolean {
    if (!roleName) return false
    const role = this.roles.get(roleName)
    if (!role) return false
    // Admin is always allowed everything
    if (role.name === 'admin') return true
    return role.permissions.includes(permission)
  }
}

const roleRegistry = new RoleRegistry()
export default roleRegistry


