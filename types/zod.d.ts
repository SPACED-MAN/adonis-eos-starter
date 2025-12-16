// Temporary shim for zod types; remove if full zod types are installed.
declare module 'zod' {
  export type ZodTypeAny = any
  export const z: any
  export function any(): any
  const _default: any
  export default _default
}
