# Plan: Sysbrazo client multimedia in the contact panel

## Status

- Ticket: #15468.
- Specification: `spec.md`.
- Status: awaiting approval for implementation.
- This plan does not authorize code changes, schema migrations, job execution,
  tests, commits, or deployment.

## Approach

The feature has two separate identities:

- A ChatbotX conversation/contact/message identifies who sent an attachment and
  where it was sent.
- A Sysbrazo `client.id` identifies the client whose history can be shared by
  multiple ChatbotX contacts and conversations in one workspace.

ChatbotX retains file storage and message attachments. New tables only record
the 24-hour conversation context, the trusted attachment-to-client association,
and per-user read state.

The context must be created by server-side document handling, not by the panel
opening. The final implementation point must receive the conversation ID that
was active when `document_id` changed. The existing custom-field event carries
an optional `contactInboxId`, but the exact resolver from that value to a
conversation must be verified before code is written.

## 1. Data model and migration

Add the following ChatbotX tables under `packages/database/src/schema/`:

1. `ConversationSysbrazoClientContext`
   - `workspaceId`, `conversationId`, `sysbrazoClientId`, `documentId`,
     `activatedAt`, `expiresAt`.
   - One current row per workspace/conversation. A successful lookup upserts it;
     a missing-client lookup removes or invalidates it.
   - Indexed for lookup by workspace, conversation, and expiry.

2. `SysbrazoClientMultimedia`
   - `workspaceId`, `sysbrazoClientId`, attachment/message identifiers and their
     partition timestamps, source conversation/contact, document snapshot,
     `deletedAt`, `deletedBy`, and `purgeAt`.
   - A unique constraint makes attachment association idempotent across retried
     message handling.
   - Indexed for active client history, filter/count queries, and due purges.

3. `SysbrazoClientMultimediaRead`
   - `workspaceId`, multimedia ID, reader user ID, and `readAt`.
   - Unique per multimedia/user pair.

Register every new table in `schema/index.ts`, `types.ts`, and relations. The
relations index requires both its import and its object spread. Generate one
reviewed Drizzle migration after the schema is complete; do not edit or rerun
an applied migration.

## 2. Server-side context lifecycle

Create a business service, likely under
`packages/business/src/sysbrazo-client-multimedia/`, with transaction-aware
methods for:

- resolving the valid context for a workspace/conversation at a timestamp;
- creating/replacing it after the configured Sysbrazo document lookup succeeds;
- invalidating it when the lookup yields no client;
- associating permitted attachments with the valid context;
- listing, marking read, soft-deleting, restoring, and permanently deleting
  multimedia.

Update the document-resolution path so a successful lookup writes the context
with `expiresAt = activatedAt + 24 hours`. The context write must occur when the
contact supplies a document through the flow/custom-field path, not in
`SysbrazoPanel` or an API request made only to render it.

After a context expires, the flow must request document confirmation even when
the contact still has `document_id`. A confirmation with the same value must
invoke the lookup/context lifecycle; existing update code that treats an equal
custom-field value as a no-op cannot suppress this operation. The stored
`document_id` remains intact and must not reactivate the panel by itself.

Trace and update the actual custom-field writer/event consumer so it has a
conversation ID. If the current custom-field event cannot reliably identify one
conversation, extend the event payload or use the flow execution context; do
not guess from a contact's latest conversation.

Update `getSysbrazoClientByDocument` and the contacts API only after this
lifecycle boundary is defined. The panel API should read a valid context first,
then fetch current Sysbrazo data for that stored client/document. An expired or
missing context returns no Sysbrazo data.

## 3. Attachment association

At the existing server-side message persistence boundary, process new incoming,
outgoing, and bot-created attachments after the message is successfully stored.
The current received-message path calls
`createOrUpdateWithAttachments`; outgoing and bot paths must be enumerated and
covered before implementation.

For every persisted attachment:

1. Resolve the valid context for that attachment's workspace and conversation.
2. Accept only the MIME/type allowlist from `spec.md`.
3. Insert the multimedia association using its idempotency constraint.
4. Emit or reuse a workspace realtime event so an open matching panel updates.

Do not associate historical attachments. Do not derive client ownership from a
contact, a later document value, browser input, or filename extension.

## 4. API and authorization

Add authenticated contacts procedures through the existing contacts API
composition for:

- reading the current valid Sysbrazo context and paginated multimedia;
- marking a file read;
- getting an authorized preview/download URL;
- soft delete, restore, trash listing, and permanent delete;
- resolving a source message for `Ver en el chat`.

All procedures use `workspaceAuthorizedMidddleware`, server-side effective
permission checks, contact access scope, and `workspaceId` predicates. The
client must not provide a trusted Sysbrazo client identity for an operation.

Use existing presigned-download behavior for storage URLs. Do not return raw
object keys or reusable signed URLs. Reuse the existing message composer path
for `Reenviar`; it opens a draft and never sends automatically.

Add multimedia permissions to the canonical permission catalog and resolver
being implemented for #15466. Until that catalog is available, do not create a
parallel authorization mechanism. The final role grants and administration UI
are a dependency of this ticket.

## 5. Panel and realtime UI

Change `SysbrazoPanel` so it receives conversation identity and reads the
server-authoritative current context. It must render no Sysbrazo client data
when the context is absent or expired, even if the contact still has a
`document_id` custom field. A context that expired after a successful lookup
renders the distinct `Chat inactivo` state and its document-request guidance;
it must not be conflated with a missing document, unresolved client, or lookup
failure.

Add a `MultimediaBlock` under `NotesBlock` with:

- collapse state, active/filtered counts, five-item cursor pagination, and
  combined sender/type filters;
- source sender labels, file metadata, thumbnails/icons, read badges, empty and
  retry states;
- a focus-safe dialog for image/PDF preview, document download guidance,
  previous/next navigation, copy link, resend draft, and source-message
  navigation;
- a permission-gated trash view, restore, soft-delete confirmation, and
  permanent-delete confirmation;
- the distinct expired-context `Chat inactivo` state;
- stale request guards and state reset when the active conversation/context
  changes.

Subscribe to the existing workspace realtime channel. A new attachment refreshes
only an open panel whose valid context has the same workspace/client ID. It
must preserve filters, loaded items, and an open viewer.

Add every user-facing string to the builder translations used by the panel.

## 6. Retention purge

Add a scheduled worker handler that selects soft-deleted multimedia whose
`purgeAt` is due. It must use a distributed lock and process each record
idempotently.

For one due record, atomically mark/process the purge before deleting the
attachment data and its original/thumbnail storage objects. A retry must handle
partially absent files without deleting a different attachment or leaving the
record falsely marked as complete. Use the existing workspace blocked-owner
guard when the job is scoped to a workspace.

The scheduler registration, worker-config job type, schedule worker case, and
handler are all required. The cadence and batch size will be selected from
existing schedule patterns during implementation.

## Affected surfaces

| Surface | Planned work |
| --- | --- |
| `packages/database/src/schema/` | Three multimedia/context/read tables, indexes, schema exports, types, relations, generated migration |
| `packages/database/src/repositories/` | Workspace-scoped multimedia queries and message attachment deletion support if the existing repository lacks it |
| `packages/business/src/` | Context lifecycle, association, access, soft delete, restore, purge, audit, cache/event orchestration |
| Existing custom-field/flow path | Persist/invalidate context when `document_id` is resolved with a conversation ID |
| `apps/worker/src/integration/handlers/` | Associate new persisted attachments from received/outgoing/bot paths |
| `packages/worker-config/`, `apps/worker/src/schedule/` | Retention-purge job type, scheduler, worker registration, handler |
| `apps/builder/src/features/contacts/` | Context-aware Sysbrazo panel, multimedia block, contacts API schemas/procedures |
| `apps/builder/src/features/messages/` | Reuse source navigation and resend-draft paths as needed |
| `apps/builder/messages/` | UI strings in supported locales |
| `apps/builder/__tests__/`, `apps/worker/__tests__/`, package tests | API, service, worker, and UI coverage |
| `docs/context/feature/` | Closing documentation |

Exact filenames within new multimedia modules are pending the implementation
pass; no new file is claimed to exist by this plan.

## Risks and controls

- Wrong client association: write context only from the server-side document
  flow with a proven conversation ID; expire it after 24 hours.
- Cross-workspace disclosure: every context, multimedia, read, and attachment
  operation includes `workspaceId` and server authorization.
- Duplicate association from retries: unique association key plus an idempotent
  write path.
- Purge race or partial failure: distributed lock, status guard, transaction for
  database state, and retry-safe object deletion.
- Applied migration rewrite: generate a new migration only; existing migrations
  remain unchanged.
- Permission drift: consume #15466's canonical resolver and do not add an
  independent membership check.

## Approval gates

1. This document is planning only.
2. Implementation requires approval after the #15466 permission dependency and
   the exact document-to-conversation lifecycle hook are confirmed.
3. Database schema edits and migration generation are part of the implementation
   scope; applying `db:migrate` is a separate approval.
4. Running tests, lint, type checks, schedules, commits, pushes, and deployment
   each require their own approval.
