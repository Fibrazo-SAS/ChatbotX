# Plan: contact panel notes

## Status and references

- Ticket: #15465.
- Specification: `spec.md`, approved for planning in the current conversation.
- Tasks: `task.md`.
- Companion: Sysbrazo `spec/feature/15465/{spec,plan,task}.md`.
- Plan status: awaiting implementation approval. The current authorization covers plan/task documents only.

## Approach

Render Sysbrazo client notes inside the existing Sysbrazo card, loading them independently after client resolution. Read and write through authenticated builder procedures and the existing server-side integration configuration. Sysbrazo remains the only store for this client-note history.

Keep ChatbotX's existing contact-note feature separate. It stores notes against ChatbotX contacts, is used by inbox and flow functionality, and is outside this ticket. No migration, deletion, or reuse of those records is planned.

Implement after the shared contract is settled and Sysbrazo can support it. Builder development may use contract fixtures before deployment, but no incompatible UI should be enabled against an older API.

## 1. Resolve the shared contract and authorization

Inspect existing workspace permissions, Sysbrazo request configuration, and the authenticated contacts API registration. Agree with the Sysbrazo plan on:

- Dedicated integration authentication; no browser-held credentials.
- A trusted external actor tuple containing installation/integration namespace, workspace scope, and user ID. Names are display data only.
- Permission mapping for read/create/edit. Do not equate membership with notes permission.
- Proposed API operations: GET/POST `/api/botmaker/client/{clientId}/notes` and PATCH `/api/botmaker/client/{clientId}/notes/{noteId}`.
- Response fields for items, counts, origin, original author, timestamps, edited state, edit deadline, and caller editability.
- Cursor or other stable pagination with a five-item page and deterministic creation/ID ordering; counts represent the full accessible history.
- Errors for permission, missing client/note, validation, expiry, and unavailable upstream.
- A duplicate-create strategy for ambiguous failures; retries must not silently create another note.
- Product timezone and the proposed switch to Todo after creation while the Sysbrazo filter is selected.

Record final decisions in both plans before coding the affected behavior. Do not implement provisional permission names or trust a client-supplied actor.

## 2. Implement the server boundary

Add validated Sysbrazo client-note contracts next to the current Sysbrazo schemas. Register list/create/update procedures through the existing contacts API composition and exact workspace authorization middleware. Do not modify the existing `features/contact-notes` actions, service, model, or UI for this ticket.

For every operation:

1. Authenticate and authorize the workspace actor.
2. Resolve the contact within that workspace and its Sysbrazo client association server-side.
3. Derive actor ID, display name, and scope from the session.
4. Call the dedicated Sysbrazo endpoint through the current external-request mechanism.
5. Validate the response and map errors without exposing integration secrets or upstream internals.

Keep reusable business rules in the service layer, not UI/procedure bodies. Resolve the precise service location after reading adjacent patterns. Do not import database clients in app code or create local note persistence.

## 3. Build the notes section

Add a `NotesBlock` beside the existing support sections and mount it in `SysbrazoPanel` after the existing sections. Pass authorized workspace/contact context; use the resolved-client state to avoid redundant or invalid requests.

- Separate loading/error state from the main card.
- Controlled collapse, with create action outside the collapsing content.
- Todo/Chat/Sysbrazo chips, full-history counts, five-item pages, and per-note expansion.
- Inline create/edit with shared text validation and session-derived display name.
- Pending-submit protection and agreed retry/idempotency behavior.
- Server-authoritative editability/deadline, with a display timer that updates while open and cleans up when unmounted.
- Ancient/edited badges, plain-text rendering, accessible labels and focus management.
- Reset state and invalidate stale requests on contact/workspace/filter changes.
- Handle the panel's unresolved-client early return so the specified notes message is represented without a write action.

Use the existing UI conventions and translation keys. Add only missing strings, including plural remaining counts and all errors/toasts, to the supported catalogs required by repository conventions.

## 4. Verify and document

Use app-level tests for authorization/API behavior and focused component/unit tests for the note UI. Cover the cases in `spec.md`, including direct calls, cross-scope actor collisions, malicious text, concurrent pagination, and expiry during editing.

After approval for commands, run the smallest relevant tests first, then `pnpm lint`, touched-workspace type checks, tests, and required coverage checks per `testing-workflow`. Inspect actual package scripts before selecting exact commands. A dependency or environment failure must be reported, not bypassed.

Perform coordinated manual QA with Sysbrazo: create in each application, inspect both filters/counts, edit within the allowed window, and verify Simazo notes still render correctly.

Write `docs/context/feature/sysbrazo-contact-notes.md` and `context.md` at closure with results, deviations, and deployment prerequisites.

## Affected files and surfaces

| Path or surface | Planned change |
| --- | --- |
| `apps/builder/src/features/contacts/sysbrazo-panel/sysbrazo-panel.tsx` | Mount notes and account for unresolved-client state |
| `apps/builder/src/features/contacts/sysbrazo-panel/notes-block.tsx` (new) | Notes list, filters, forms, and state handling; split local components only if needed |
| `apps/builder/src/features/contacts/schema/sysbrazo-notes.ts` (new) | Input and response validation/types |
| `apps/builder/src/features/contacts/api/` and contacts router registration | Authenticated list/create/update procedures using the existing composition |
| `apps/builder/src/features/contacts/queries/` and existing integration helpers | Server-only lookup/request reuse; inspect before selecting exact new files |
| Appropriate `packages/business/` service, if shared orchestration is required | Reusable server logic without direct app-layer database access |
| `apps/builder/messages/` | Required translations in supported catalogs |
| `apps/builder/__tests__/` and focused panel tests | Authorization, contract, UI, and regression coverage |
| `docs/context/feature/sysbrazo-contact-notes.md` (new), feature artifacts | Contract/usage and validation record |

These new paths are proposals, not claims that implementations already exist. Final filenames and any significant additional package changes must be recorded before approval of their execution scope.

## Risks and mitigations

- High: actor spoofing or cross-workspace access. Derive identity server-side, namespace it, and test direct procedure calls.
- Medium: backend rollout mismatch. Release compatible Sysbrazo support first and retain explicit error handling.
- Medium: duplicate creation/stale responses. Agree on retry semantics and invalidate superseded requests.
- Medium: permission mapping changes behavior. Resolve it before implementing authorization.
- Low: visual regressions in the existing card. Keep notes independent and use shared components.

## Approval gates

1. Documents are authorized; implementation is not.
2. Resolve and approve contract/permission/identity decisions before coding those surfaces.
3. Obtain explicit approval for the described implementation files and behavior.
4. Obtain approval for state-changing verification commands as required.
5. Any migration, configuration mutation, commit, push, or deployment is a separate action, not covered by implementation approval.
6. If scope expands materially, stop and update the plan for approval.
