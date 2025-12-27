# Icon usage guideline

- When icons are requested in the UI, use Font Awesome consistently across the project.
- Prefer the solid set for general UI indicators (import from `@fortawesome/free-solid-svg-icons`) and render with `@fortawesome/react-fontawesome`.
- Keep icon sizes subtle by default (e.g., `size="sm"`), and color via existing design tokens (Tailwind utility classes).
- Do not embed raw SVGs for new icons unless explicitly required for a special case. Use the Font Awesome component instead.

## AI Agent Visual Indicators

- **Brain Icon (`faBrain`)**: Use this icon to indicate that an action or location has one or more AI Agents configured to run **automatically** (e.g., when a post is published or a translation is created).
  - This icon should ONLY be displayed when matching agents are found for that scope.
  - It serves as a "heads up" to the user that background automation is active.
- **Wand Icon (`faWandMagicSparkles`)**: Use this icon for **manual** AI triggers (e.g., a button that the user clicks specifically to generate content).
  - Usually displayed in field labels or specialized AI toolbars.
  - Indicates that clicking will invoke an agent for assistance.
