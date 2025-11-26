Principle: Prefer UI and logic reuse across admin editors

- Shared components: Use a single ModulePicker for both Post and Template editors. Avoid duplicating Library/Globals menus or fetch logic.
- APIs: ModulePicker must accept an onAdd callback so editors can delegate to their own endpoints while reusing UI.
- Configuration: When a component diverges by context (post vs template), prefer prop-based behavior over forks.
- Review: New editor features should check for reuse opportunities in inertia/admin/components before adding bespoke UI.


