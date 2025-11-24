# Icon usage guideline

- When icons are requested in the UI, use Font Awesome consistently across the project.
- Prefer the solid set for general UI indicators (import from `@fortawesome/free-solid-svg-icons`) and render with `@fortawesome/react-fontawesome`.
- Keep icon sizes subtle by default (e.g., `size="sm"`), and color via existing design tokens (Tailwind utility classes).
- Do not embed raw SVGs for new icons unless explicitly required for a special case. Use the Font Awesome component instead.


