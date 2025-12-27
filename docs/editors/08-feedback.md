# Feedback System

Adonis EOS includes a powerful feedback system that allows editors, admins, and translators to collaborate directly on the page. You can point to specific elements, track bugs, and manage change requests without leaving the preview interface.

## Adding Feedback

There are two primary ways to add feedback:

### 1. Contextual Feedback (Right-Click)

This is the most precise way to add feedback.

1.  Navigate to any page while logged in.
2.  **Right-click** directly on the element you want to comment on (e.g., a heading, an image, or a specific paragraph).
3.  Select **"ADD FEEDBACK HERE"** from the custom context menu.
4.  The Feedback panel will open on the right, automatically linked to that spot.
5.  Choose a category (Comment, Copy Edit, Bug, or Feature), type your message, and hit **"Add Feedback"**.

### 2. General Feedback

If your feedback applies to the whole page or a section generally:

1.  Click the **Message Icon** in the bottom-right Admin Bar.
2.  Type your feedback in the form at the bottom of the panel.
3.  If you want to link it to a spot later, you can use the right-click method above.

## Visual Indicators (Pulsating Dots)

When feedback is added to a specific spot, a **pulsating violet dot** will appear over that element.

- **Pending Feedback**: These dots are always visible to authenticated users.
- **Active Selection**: When you select a feedback item in the sidebar, the corresponding dot on the page will grow and glow more intensely to show you exactly what is being discussed.

## Managing Feedback

### The Feedback Drawer

Click the **Message Icon** in the bottom-right bar to open the Feedback drawer. This panel is "non-modal," meaning you can keep it open while you continue to scroll and interact with the page.

- **Jump to Spot**: Click on any feedback card in the list. The page will automatically scroll to the exact element and highlight it.
- **Highlight from Page**: Click any pulsating dot on the page. The sidebar will automatically scroll to and highlight that specific comment.
- **Resolve**: Click the **Checkmark Icon** to mark feedback as resolved. Resolved items are hidden by default or shown with reduced opacity.
- **Delete**: Click the **Trash Icon** to permanently remove a feedback item (requires a confirmation).

### Feedback in Post Admin

You can also view all feedback for a specific post version in the **Post Admin** area:

1.  Go to the Post Editor for any post.
2.  Scroll down to the **Feedback** section in the right-hand column.
3.  Click **"Jump to spot"** on any item to be redirected to the live preview page with that element automatically focused and highlighted.

## Collaboration & Workflows

When feedback is created, it can trigger automated workflows (if configured by your administrator), such as:

- Creating a task in Notion or Jira.
- Sending a notification to a Slack or Microsoft Teams channel.
- Logging the entry in the system Audit Logs for tracking.
