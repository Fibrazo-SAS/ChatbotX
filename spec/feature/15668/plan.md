# Plan: Quick Replies (#15668)

## Approach

Extend the existing saved-replies feature instead of building a parallel one. Today the feature is a composer popover with plain `shortcut`/`text` rows (table `SavedReply`: `sharedColumns + shortcut NOT NULL + text NOT NULL + workspaceId`). The ticket turns it into a full "Quick replies" tab with rich content, image support, preview, audit trail, and "use in chat" sending.

Order of work:

1. **Database**: widen `SavedReply` and write a migration.
2. **Business service + actions/API**: move create/update/delete into the existing business service, add image lifecycle and audit fields.
3. **Builder UI**: new "Respuestas rápidas" tab beside "Chat", table + search + inline editor + preview dialog + delete confirmation.
4. **Rich editor**: toolbar (13 icons), image attach (JPEG/PNG ≤ 5 MB), second text under image, 4096 counters, inline errors.
5. **Use in chat**: send text/image/second-text in order through the existing message send path, stop on failure, respect the 24-hour messaging window.
6. **Tests + i18n** for everything user-facing.

## Files affected

### Database
- `packages/database/src/schema/saved-reply.ts`:
  - `shortcut` → nullable (`text()`), per "Sin atajo".
  - add `imagePath text` nullable (object key; public URL resolved at read time with the same filesystem pattern other attachments use).
  - add `secondText text` nullable.
  - add `createdById` / `updatedById` nullable `bigintAsString` referencing `userModel` (audit: who/when; timestamps already exist via `sharedColumns`).
- `packages/database/drizzle/…` — new migration via `pnpm --filter @chatbotx.io/database make:migration saved-reply-quick-replies`. **Applying `db:migrate` needs explicit approval.**
- `packages/database/src/relations/index.ts` and new relations file for `savedReplyModel` (invariant: import **and** spread).

### Business / API
- `packages/business/src/saved-reply/service.ts`: create/update/delete with image upload/removal (filesystem service), audit fields, workspace scoping. List returns image URL + audit info.
- `apps/builder/src/features/saved-replies/schema/mutation.ts`: shortcut optional; text max 4096; add optional `secondText` (max 4096) and image input; edit = create schema.
- `apps/builder/src/features/saved-replies/schema/resource.ts`: expose `imageUrl`, `secondText`, `createdBy/updatedBy` (name) + dates.
- `apps/builder/src/features/saved-replies/actions/create|edit|delete-saved-reply.action.ts`: stop importing `db` directly (invariant #9); delegate to the business service; delete removes the stored image object.
- `apps/builder/src/features/saved-replies/api/*` and workspace-token API if their shape changes.
- Store (`provider/saved-reply-store.ts`): expose created/updated audit fields; no structural change otherwise.

### Builder UI (new tab)
- `apps/builder/src/features/chat/chat-layout.tsx`: central area gains tabs "Chat" / "Respuestas rápidas" (i18n).
- New `apps/builder/src/features/saved-replies/quick-replies-panel.tsx`: header, search (client-side, case-insensitive, filters shortcut/message as you type), table (Atajo / Mensaje / actions), empty table when no matches (no empty-state message), "Nueva respuesta" inline row.
- New row editor: shortcut (optional, `/atajo` hint), message parts (first text, optional image with Cambiar/× , second text only when image), counters `n/4096`, inline errors:
  - image invalid: under the image, e.g. "Solo se admiten imágenes JPEG o PNG de hasta 5 MB."
  - text over limit or invalid image on save: above buttons, "Revisa el mensaje: supera el límite de caracteres o la imagen no es válida."
  - errors never close the editor.
- Preview dialog ("Ver"): title = shortcut (or fallback), renders first text → image → second text; buttons "Editar" (opens row editor) and "Usar en el chat".
- Delete: confirmation "¿Borrar esta respuesta rápida? No se puede deshacer." → removes reply + image object; cancel is a no-op.
- Reuse/extend `apps/builder/src/components/tiptap/tiptap-editor-field.tsx` for the rich toolbar (undo, redo, bold, italic, strike, monospace/inline code, bullets, numbered list, quote, code block, link, image, emoji). Keep the existing composer popovers (`saved-reply-manage.tsx`, `quick-replies-popover.tsx`) working or adapted to the new shape.

### Use in chat
- New action/handler "use saved reply in conversation": sends the parts in creation order via the existing message-send path (`sendMessage`/chat store); if a part fails, later parts are not sent and the UI reports which parts went out; if the conversation is outside the 24-hour window, nothing is sent and the user is notified. Reuses the existing messaging-policy helpers instead of new window logic.

### i18n
- All strings in `apps/builder/messages/*.json` via `useTranslations()`; check existing `fields.*`/`actions.*` keys before adding new ones.

### Tests
- Service/API: create/edit/delete with image lifecycle, shortcut optional, 4096 limit, audit fields, image type/size rejection.
- UI: search filter behavior, second-text-only-with-image, delete confirm.
- Send: ordering, stop-on-failure, 24-hour-window guard (worker/business boundary).

## Risk

- **Medium-High**: "use in chat" must respect channel send semantics and the 24-hour window; the editor is the largest UI piece. Mitigated by reusing existing send path and Tiptap components; no new send logic of our own.
- **Medium**: schema widening (nullable shortcut) touches the store, API, and existing popovers — all in the same feature, no external consumers found.
- **Low**: migration is additive except the `shortcut` nullability change; existing rows keep their values.

## Approval gates

- This plan → explicit approval before coding.
- Generate migration → inspect SQL → explicit approval before running `db:migrate` (never automatic).
- Commit / PR: separate approvals; branch `feat/quick-replies` already created.

## Open questions

1. **Seed replies**: the ticket text contains no example replies, and the Redmine images are not downloadable without login. If you want the mock rows from the screenshots loaded as seeds, paste them here (atajo + mensaje) and I'll add them.
2. "Use in chat" is assumed to target the active conversation of the current inbox tab.
