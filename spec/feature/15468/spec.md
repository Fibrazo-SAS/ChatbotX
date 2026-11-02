# Specification: Sysbrazo client multimedia in the contact panel

## Ticket

- URL: https://redmine.fibrazo.com.co/issues/15468
- Tracker: Feature
- Priority: Normal
- Parent: #15464
- Goal: show the images and documents sent in ChatbotX for the Sysbrazo client
  currently identified in a conversation.
- Status: draft for review. This specification does not authorize implementation,
  migrations, jobs, tests, commits, or deployment.

## Problem

ChatbotX stores chat messages and attachments, while Sysbrazo identifies the
client from a document supplied by the chat contact. A ChatbotX contact is the
person or number that asks about a client; it is not the Sysbrazo client.

One contact can ask about different Sysbrazo clients over time. Different
contacts can ask about the same Sysbrazo client. Multimedia must therefore be
owned by the resolved Sysbrazo client ID inside a workspace, while retaining
the ChatbotX message, conversation, contact, sender, and timestamp as its
origin.

The current panel resolves Sysbrazo data from the contact's persisted
`document_id` whenever the panel loads. That behavior can expose the previous
client after a conversation has become inactive. The client context must expire
after 24 hours.

## Client context

A successful server-side lookup by document creates or replaces a context for
the current conversation:

```text
workspaceId
conversationId
sysbrazoClientId
documentId
activatedAt
expiresAt
```

- `sysbrazoClientId` is the `client.id` returned by Sysbrazo
  `GET /api/botmaker/client/by-document`.
- The context starts when the contact's document is captured and resolves to a
  Sysbrazo client. Opening the panel must not create or renew it.
- The context expires exactly 24 hours after the successful lookup.
- A new successful document lookup replaces the previous context immediately
  and creates a new 24-hour period.
- After expiry, the contact must confirm the document again before another
  lookup. The confirmed value may equal the `document_id` already stored on the
  contact; equality with the persisted value must not suppress the new lookup.
- A lookup that does not resolve a Sysbrazo client invalidates the existing
  context for that conversation.
- Opening the conversation, opening the panel, and ordinary messages do not
  renew the period.
- After expiry, the full Sysbrazo panel must not display the previous client's
  identity, services, ONU, notes, tickets, diagnostics, or multimedia. It
  shows `Chat inactivo` and `Para volver a consultar datos del cliente,
  solicita nuevamente su documento.` The next valid document lookup is
  required to show client data again.

The context is scoped to a conversation. Attachments retain their own client
association after the context changes or expires.

The contact's `document_id` remains stored after expiry. It is not itself an
active-client flag and it must not cause the panel to reactivate automatically.

## Multimedia ownership and ingestion

Files remain in ChatbotX storage and in its existing message/attachment model.
Sysbrazo receives no files and stores no multimedia records for this feature.

For each permitted attachment received or sent while a valid context exists,
ChatbotX creates a client-multimedia association with at least:

```text
workspaceId
sysbrazoClientId
attachmentId
attachmentCreatedAt
messageId
messageCreatedAt
conversationId
sourceContactId
documentIdSnapshot
createdAt
```

The association is created from server-side message handling. It must not rely
on the browser, a panel request, or a later read of the contact's current
`document_id`.

If a permitted attachment arrives without a valid context, it stays in the chat
and is not added to client multimedia. Existing attachments are not backfilled
or linked by inference.

The association is unique enough to prevent duplicate rows when message events
are retried or delivered more than once.

## Permitted files

Only these attachments enter client multimedia:

- Images: JPG, PNG, WEBP, and HEIC.
- Documents: PDF, DOC, DOCX, XLS, XLSX, CSV, PPT, PPTX, TXT, and RTF.

GIFs, stickers, audio, video, compressed files, executables, and unknown MIME
types remain in the chat only. Validation uses trusted attachment MIME/type
metadata on the server; a filename extension alone is insufficient.

## Multimedia block

Render a collapsible `Multimedia y documentos` block under Sysbrazo Notes when
the conversation has a valid context. The block lists multimedia for
`workspaceId + sysbrazoClientId`, including files associated from another
ChatbotX contact or conversation in the same workspace.

- The header shows the total number of active files and the number of unread
  files when it is greater than zero.
- Show the newest files first with deterministic timestamp/ID ordering.
- Load five files initially. `Cargar más (N restantes)` adds at most five.
- Show `Mostrando X de N`; when filters are active show `Mostrando X de N · M
  en total`.
- With more than five files, provide combined sender filters: Todos, Del
  cliente, Del equipo; and type filters: Todos, Imágenes, Documentos. Each
  option has its count.
- A row contains a thumbnail or file icon, name, sender category and name,
  sent date, type, size, accompanying message text when present, and status
  labels.
- Empty state: `Sin multimedia ni documentos`.
- Empty filtered state: `No hay archivos de este tipo`.
- A failed request shows `No pudimos cargar multimedia` and `Reintentar`.
- The active context is absent or expired: do not expose counts, files, or the
  previous Sysbrazo client data.

`Chat inactivo` applies only after a previously resolved context expires. It is
separate from the states for a missing document, a document that has no
Sysbrazo client, and a lookup error.

`Cliente` is derived from a contact sender. `Asesor` is derived from a user
sender. `Bot` is listed as a sender in rows and belongs to `Del equipo` for the
sender filter.

## Realtime and unread state

When a permitted attachment is associated with the active Sysbrazo client, the
open panel updates without a refresh. It preserves the current filters, loaded
items, and an open viewer. New matching files appear first and announce `Nuevo
en Multimedia: {file name}` through an accessible live region.

`Nuevo` is per advisor, not global. Opening a file marks it read only for the
current authorized user. This read state persists across page reloads and is
not shared with other advisors.

## Viewer and reuse

Selecting a row opens a dialog with its position in the active result set,
previous/next navigation, and focus restoration to the originating row on
close. Escape closes the dialog.

- Images render in the viewer.
- PDFs render in the viewer when the browser can display the file.
- Word, Excel, PowerPoint, text, protected documents, and unsupported previews
  show file metadata and a guided download.
- `Descargar` and `Copiar enlace` use an authorized short-lived URL. The raw
  storage path and permanent signed URL are never exposed.
- `Reenviar` opens the existing ChatbotX message composer with the selected
  attachment. It does not send immediately.
- `Ver en el chat` navigates to the source message and preserves the user's
  access scope.
- A missing file shows `El archivo ya no está disponible` and an available
  retry action. A zero-byte file shows `El archivo llegó vacío (0 KB)`.

## Deletion and retention

Removing an item from multimedia is a soft delete. It leaves the chat message,
attachment, and storage object intact during a 30-day retention period.

The soft-deleted item is visible in a permission-protected trash view and can
be restored before its retention ends. On day 31, a background job permanently
removes the multimedia association, attachment data from the source message,
original storage object, and thumbnail. The source message text remains when it
has no attachment left.

Users with the permanent-delete permission may trigger this removal before the
30 days end after an explicit confirmation. Remove, restore, and permanent
delete actions record the actor, client ID, attachment, timestamp, and reason
where supplied.

The permission catalog must distinguish:

- viewing active client multimedia;
- removing and restoring multimedia;
- viewing deleted multimedia;
- permanently deleting multimedia.

Exact key names, role grants, administration surface, and legacy-member
behavior must use the canonical permission work from #15466. This ticket must
not introduce a second permission resolver.

## Security and tenancy

- Every read, preview, download, resend, restore, and delete operation checks
  workspace membership and the effective multimedia permission on the server.
- The browser cannot select a `sysbrazoClientId`, attachment, message, contact,
  or workspace outside the authorized scope.
- `sysbrazoClientId` is always queried together with `workspaceId`. Identical
  upstream IDs in separate workspaces never share multimedia.
- Sysbrazo credentials remain server-side. The client ID comes from the trusted
  result of the configured Sysbrazo lookup.
- ChatbotX retains the only storage access path for these files.

## Acceptance criteria

- [ ] A successful document lookup activates a Sysbrazo client context for its
  conversation for 24 hours.
- [ ] A new successful lookup replaces the context; a missing-client lookup
  invalidates it.
- [ ] After the 24-hour expiry, the document-confirmation flow accepts the same
  stored document value and creates a new lookup/context instead of skipping it.
- [ ] No Sysbrazo panel data appears after the context expires until another
  successful document lookup occurs; the panel shows the `Chat inactivo`
  state instead.
- [ ] A permitted attachment during a valid context appears under that
  `sysbrazoClientId`; an attachment without context remains chat-only.
- [ ] A second contact or conversation that resolves the same client sees the
  existing active multimedia in the same workspace.
- [ ] A contact that later resolves another client does not mix earlier and
  later files.
- [ ] File type filtering, sender filtering, counts, five-item loading, empty
  states, retry state, and deterministic ordering follow the ticket.
- [ ] New matching attachments update an open panel without closing the viewer
  or resetting filters.
- [ ] Read state is per advisor and persists after reload.
- [ ] Preview, download, copy-link, resend, and source-message navigation do
  not expose unauthorized content or raw storage paths.
- [ ] Soft-deleted files leave the original chat content intact for 30 days,
  can be restored by authorized users, and purge permanently on day 31.
- [ ] Server-side tests cover tenant isolation, expired contexts, context
  replacement, duplicate event delivery, authorization, retention, and direct
  forged API calls.

## Constraints

- Reuse ChatbotX attachments and storage. Do not upload or persist multimedia
  in Sysbrazo.
- Do not infer a client association from the current contact, its current
  `document_id`, a panel load, or a filename.
- Do not backfill historical attachments without an explicit trusted client
  association.
- Do not add direct database access in `apps/builder`, `apps/worker`, or
  integrations. Use repositories and business services.
- Do not run migrations, retention jobs, tests, deployments, or Git operations
  without their separate approvals.

## Skills and rules

- `builder-ui-i18n`
- `business-data-access`
- `drizzle-database`
- `orpc-api`
- `reliability-concurrency`
- `security-review`
- `testing-workflow`
- `worker-development`
- `human-writing`

Apply `AGENTS.md`, `.agents/rules/data-access.md`, `.agents/rules/git.md`,
`.agents/rules/no-dynamic-import.md`, and `.agents/rules/human-writing.md`.

## Documentation at closure

- `docs/context/feature/sysbrazo-client-multimedia.md`
- Update `docs/context/feature/contact-sysbrazo-panel.md` with the 24-hour
  conversation-context rule.
