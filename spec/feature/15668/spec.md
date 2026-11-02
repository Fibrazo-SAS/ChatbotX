# Specification: Quick Replies

## Ticket
- **URL**: https://redmine.fibrazo.com.co/issues/15668
- **Tracker**: Feature
- **Priority**: Normal
- **Goal**: Let advisors and supervisors create, find, preview, edit, delete, and send reusable rich messages from the chat.

## Problem
Advisors and supervisors need to reuse frequently sent messages without composing them again. The ticket requests a “Quick replies” tab beside Chat, management of saved replies, a rich-message editor supporting text and an optional image, and a way to send the reply from a conversation. The current builder code already has a `features/saved-replies` feature with basic shortcut/text forms and a saved-reply store; this request should extend that capability rather than introduce a separate saved-reply concept.

## Acceptance Criteria

### List and search
- [ ] Advisors and supervisors can access a “Quick replies” tab beside “Chat”.
- [ ] The view has the “Quick replies” heading, a “New reply” action, an immediate search field, and a table with Shortcut, Message, and per-row View, Edit, and Delete actions.
- [ ] A reply without a shortcut displays “No shortcut”. The list displays all saved replies when there is no search query.
- [ ] Search filters as the user types, matching shortcut or message content case-insensitively. If there are no matches, show an empty table without an empty-state message.

### Create and edit
- [ ] “New reply” opens an inline editor row. The shortcut is optional; a message is required.
- [ ] A reply can contain a first text, an optional image, and optional second text. The second text is available only when an image is attached and is displayed below it.
- [ ] Saving a valid new reply adds it to the list and closes the editor. Saving an edit updates the list and closes the editor; Cancel discards changes.
- [ ] The system records who created a reply and when, and who last edited it and when.
- [ ] Each text area has a 4096-character limit and counter. Text over the limit prevents saving and displays an error without closing the editor.
- [ ] Only JPEG and PNG images up to 5 MB can be attached. Invalid images are rejected with an inline error; validation errors do not close the editor.
- [ ] On save, an over-limit message or invalid image displays the specified form-level message: “Review the message: it exceeds the character limit or the image is invalid.”

### Rich-text editor
- [ ] The toolbar provides, in this order: Undo, Redo, Bold, Italic, Strikethrough, Monospace, Bulleted list, Numbered list, Quote, Code block, Link, Image, and Emoji.
- [ ] Each toolbar action performs the corresponding formatting/insertion operation on the selected text or editor content.
- [ ] The message preview/editor lays out content in this order: first text, image, second text. The image has Change and Remove controls.

### Preview and delete
- [ ] View opens a dialog titled with the reply shortcut and previews the message in customer-visible order: first text, image, then second text when present.
- [ ] The preview’s Edit action closes the dialog and opens that reply for editing. “Use in chat” closes the dialog and follows the send behavior below.
- [ ] Delete requires confirmation with the message “Delete this quick reply? This cannot be undone.” Cancel leaves the reply unchanged. Confirming removes the reply and its image.

### Use in chat
- [ ] “Use in chat” sends the reply’s available content in its defined order.
- [ ] If sending a part fails, later parts are not sent, and the user is told which parts were sent.
- [ ] If the conversation is outside the 24-hour messaging window, nothing is sent and the user is notified.

## Skills & Rules
Load these skills:
- `feature-scaffold`
- `builder-ui-i18n`
- `business-data-access`
- `integration-channel` (if implementation needs to change channel-send behavior)
- `testing-workflow`

## Do's and Don'ts
- Extend the existing `apps/builder/src/features/saved-replies` feature and its current persistence/API patterns; do not create a parallel saved-reply model.
- Use `useTranslations()` and translation resources for every user-facing string; check existing `fields.*` keys before adding new keys.
- Do not import `db` directly in `apps/` or `integrations/`; route database access through business services or repositories.
- Preserve workspace authorization and ensure a reply is only available to its owning workspace.
- Use the existing message-sending path and channel policies; honor the conversation’s 24-hour messaging window and stop subsequent sends after a failure.
- Keep attachment validation (MIME type and size) enforced by trusted server-side code as well as reflected in the UI.
- Add regression coverage for list/search, create/edit/delete, editor validation, preview, and send sequencing/window behavior at the appropriate boundaries.

## Docs to Update
- `docs/context/feature/quick-replies.md`
