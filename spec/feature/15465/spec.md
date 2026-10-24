# Specification: contact panel notes

## Ticket and status

- Ticket: https://redmine.fibrazo.com.co/issues/15465
- Parent: #15464.
- Tracker: Feature. Priority: Normal.
- Scope source: ticket description, October 14 comment, attached mockups, and user clarifications in this session.
- Status: draft for approval. Creating this specification does not authorize implementation.
- Companion: Sysbrazo repository, `spec/feature/15465/spec.md`.

## Goal

Let authorized advisors read, create, and edit Sysbrazo client notes from the existing Sysbrazo client card in ChatbotX. Both applications read the same notes stored in Sysbrazo, including notes created through its existing Simazo integration.

ChatbotX contact notes are a separate domain: they belong to a ChatbotX `Contact` and are used by inbox/flow behavior. They are not part of this client-note history and remain unchanged.

## Confirmed current behavior

- `apps/builder/src/features/contacts/sysbrazo-panel/sysbrazo-panel.tsx` renders the client card and its sections. Notes are not registered there yet.
- `getSysbrazoClientByDocument` in `queries/get-sysbrazo-client.query.ts` resolves the contact document server-side and calls the configured Sysbrazo integration.
- ONU, diagnostics, and tickets already load separately from the main client lookup.
- Sysbrazo stores notes in `sysbrazo.client_notes`. Its Simazo API creates records in that same table, using a technical `user_id` and optional `requested_by` display name.
- ChatbotX already has contact-level `ContactNote` records. Those records are intentionally excluded from this feature and are not migrated or deleted.

## Scope

Add a separate client-notes section to the existing Sysbrazo client card, authenticated builder operations for list/create/update, response validation, translations, and tests. Sysbrazo owns persistence and the shared client-note rules. Leave the existing ChatbotX contact-notes section and its flow integration untouched.

Notes load independently after client resolution. Filtering, pagination, and retry must not reload or block the identity/services sections. Reuse the existing integration configuration rather than introducing another credential source.

## Display and interaction requirements

### Header and access

- Render a collapsible section with `Notas (N)`, `Nueva nota`, and a chevron.
- Collapsing the section must not hide the create action for an authorized user.
- Without permission, show `No tienes permiso para ver las notas`; do not fetch or expose notes, counts, or write actions. The explicit ticket state takes precedence over its introductory statement that only authorized advisors see the block.
- If the client cannot be resolved in Sysbrazo, show `No encontramos este contacto en Sysbrazo`, with no create action. Account for the current panel's early return for unresolved clients.
- Empty state: `Sin notas todavía`; creation remains available.
- Fetch failure: `No pudimos cargar notas` and `Reintentar`. A failure must not become an empty or not-found result.

### List and filters

- Show newest notes first, with a stable tie-breaker when timestamps match.
- Show two lines of plain text, author, creation date formatted as `YYYY/MM/DD HH:mm`, and origin badge `Chat` or `Sysbrazo`.
- Show chips `Todo`, `Chat`, and `Sysbrazo`, each with its own total, independent of the currently loaded page.
- The total in the header represents all accessible client notes; the active filter controls the list and its remaining count.
- Start with five notes. Each `Ver más (N restantes)` adds at most five; hide it when exhausted.
- Switching filters resets the visible list to the first five matching notes.
- `Ampliar` expands a note in place; `Cerrar` restores two lines. Multiple notes may be expanded.
- Notes strictly older than 30 days are muted and carry `Antigua`, without making their text or actions inaccessible.
- Preserve multiline text and escape markup; no HTML rendering or image support.
- Simazo-created records remain part of the Sysbrazo-side history. Do not add a third Simazo chip: the user clarified that this API creates notes in Sysbrazo.

### Create

- `Nueva nota` opens an inline textarea below the header and expands a collapsed section.
- Require non-whitespace text, maximum 2,000 characters. Final character-count semantics must match Sysbrazo validation.
- Display `Se guardará como {name}` using the authenticated advisor's name.
- The backend derives author name, stable ID, and identity scope from the authenticated session/workspace. Never accept arbitrary author identity from browser input.
- Save through the builder backend to Sysbrazo. On success, show `Nota guardada`, update counts, and show the new note first. Proposed behavior when the Sysbrazo-only filter is active: switch to Todo so the saved Chat note is visible.
- `Cancelar` closes the form without creating a record.
- Prevent duplicate submissions while pending; retain text and allow retry on a failed save. Handling ambiguous network outcomes must be specified in the implementation plan.

### Edit

- Only the original author may edit, within ten minutes of creation; no advisor/admin bypass is introduced.
- Expanded own notes show `Editar` and `Puedes editar N min más` while editable.
- Own expired notes show `Edición cerrada (más de 10 min)`; other authors' notes show `Solo lectura`.
- Editing is inline with `Guardar cambios` and `Cancelar`; cancel preserves the saved text.
- Enforce required text and the same 2,000-character maximum.
- The server must enforce ownership and expiry again when saving. The UI countdown is informative, not authorization.
- Define the window as current server time strictly before creation time plus ten minutes; at the deadline editing is closed.
- If expired during editing, do not save and show `Pasaron más de 10 minutos: la nota ya no se puede editar`.
- Successful edits show `Editada`, preserve creation date and original author, and never restart the window or reorder by modification time.

## Integration contract requirements

The companion specification owns the proposed API. Exact routes and wire-field names are to be finalized together in the plan.

- Listing supports a resolved client, origin filter, five-item pagination, overall/per-origin totals, and deterministic ordering.
- Note data includes stable note identity, text, original author display, origin, creation timestamp, edit state, and sufficient trusted ownership/deadline information for the UI.
- Create/update calls carry actor identity only from the authenticated builder server, with a stable namespace sufficient to prevent cross-workspace/installation collisions.
- Use `requested_by` for external author display in Sysbrazo; it is not proof of ownership.
- Sysbrazo assigns Chat origin from the authenticated integration, not a browser-supplied origin.
- Distinguish permission denial, client missing, note missing, invalid input, closed edit window, and upstream failure.
- Scope every operation to the authorized workspace/contact; a browser-supplied Sysbrazo client or note ID must not bypass that association.
- Clear state and discard in-flight stale results when changing contact, workspace, or filter.
- No background dual-write or bidirectional replication is needed. A successful write is visible in both applications on their next query. Cross-application realtime push is out of scope.

## UI conventions

Use the mockups for layout and behavior, adapting to the existing panel and shared UI components. Do not copy screenshot dimensions, hardcode a new visual theme, or treat the shaded row in a mockup as a confirmed selection requirement.

All labels, validation, toasts, dates, and pluralized remaining counts must follow the builder's translation conventions. Check existing translation keys before adding new ones. Preserve keyboard navigation, focus behavior, accessible action labels, and loading feedback.

## Acceptance and verification

- [ ] Authorized users see both origins and correct per-origin/all counts.
- [ ] With 12 matching notes, pagination shows 5, then 10, then 12; remaining counts are 7 and 2 before the final load.
- [ ] Filtering, expansion, ancient-note styling, empty/error/retry, and unresolved-client states match the requirements.
- [ ] Creation uses session-derived identity and is visible in Sysbrazo without a second copy.
- [ ] Editing rejects a different actor, scope, client, or expired window, including direct builder API calls.
- [ ] Exact ten-minute and 30-day boundaries are tested with a controlled clock.
- [ ] Creation/editing preserve text on errors, handle pending submissions, and refresh counts/list consistently.
- [ ] Switching contacts or filters cannot leak a stale response into the new view.
- [ ] Untrusted text renders as text; credentials and internal errors are not exposed to the browser.
- [ ] Existing client card sections and the Simazo integration continue working.
- [ ] Targeted tests, lint, touched-package type checks, and the testing-workflow verification gate are recorded before completion; running commands requires the applicable approval.

## Dependencies and decisions required before implementation

1. Map the notes permission to the real ChatbotX and Sysbrazo authorization systems. Do not assume workspace membership alone grants access.
2. Finalize actor namespace, trusted server-to-server transport, and whether an advisor can edit across platforms. No name/email-based identity equivalence is assumed.
3. Confirm the proposed filter switch after creation and the ten-minute boundary semantics.
4. Choose the existing product timezone convention for presentation; transport timestamps with an explicit timezone.
5. Finalize API error codes, pagination behavior under concurrent inserts, and duplicate-write protection.
6. Coordinate the Sysbrazo schema/API rollout before enabling the builder feature.

## Skills, rules, and constraints

- Load `builder-ui-i18n`, `orpc-api`, `business-data-access`, `security-review`, and `testing-workflow` for implementation; `human-writing` for artifacts.
- Follow `AGENTS.md` and `.agents/rules/data-access.md`, `git.md`, `no-dynamic-import.md`, and `human-writing.md`.
- Keep new business rules in the appropriate service layer; no direct database imports in app code.
- Preserve tenant/workspace isolation and the exact existing middleware names.
- Do not create a local notes table, alter Simazo's API, add deletion, or introduce dependencies without a justified approved scope.

## Settings, documentation, and approvals

- Reuse existing Sysbrazo integration configuration. No new builder credential or feature flag is currently approved.
- Proposed closing documentation: `docs/context/feature/sysbrazo-contact-notes.md`.
- Next artifacts: an approved `plan.md`, owned tasks, then implementation and validation; close with `context.md`.
- This approval covers specification files only. Code changes, migrations, configuration changes, test execution, commits, and deployment require their respective approvals.
