# Confirmations Policy

- Use ShadCN Alert Dialog for confirmations in the admin UI.
- Pattern:
  - Wrap the destructive/critical action with `AlertDialog` components:
    - `AlertDialogTrigger` → button that opens the dialog
    - `AlertDialogContent` with `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`
    - `AlertDialogFooter` with `AlertDialogCancel` (secondary) and `AlertDialogAction` (primary)
  - The async operation is executed in the `AlertDialogAction` onClick handler.
  - Do not use `window.confirm`.
- Use Sonner toasts for action results and status (“Deleted”, “Saved”, errors), not for confirmations.
- Keep copy concise; provide enough detail in the dialog for the user to decide confidently.
