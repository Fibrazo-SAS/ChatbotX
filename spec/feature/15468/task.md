# Tasks: Sysbrazo client multimedia in the contact panel

## Execution status

Specification and plan only. All implementation tasks await approval and the
dependency decisions listed below.

## Prerequisites

- [ ] **M1 — Owner: parent.** Confirm the server-side flow/custom-field path
  that receives `document_id` together with a reliable conversation ID. Record
  the exact hook and behavior for successful, missing-client, and failed
  lookups, including reconfirming an unchanged document after a 24-hour expiry.
  References: spec “Client context”; plan §2.
- [ ] **M2 — Owner: parent.** Confirm #15466's permission model, catalog keys,
  role grants, and resolver availability for view, manage, trash, and permanent
  delete multimedia access. References: spec “Deletion and retention”; plan §4.
- [ ] **M3 — Owner: parent.** Obtain explicit implementation approval for the
  schema, migration generation, business service, worker, API, panel, and test
  scope. Applying the migration and running commands remain separate approvals.

## Data and lifecycle

- [ ] **M4 — Owner: database-schema.** Define and register context,
  multimedia-association, and per-user-read schemas, relations, indexes, types,
  and a reviewed generated migration. References: plan §1.
- [ ] **M5 — Owner: feature-integration.** Implement the transaction-aware
  context lifecycle: successful document lookup activates/replaces a 24-hour
  context; missing-client lookup invalidates it. Do not activate from a panel
  read. Allow a reconfirmed unchanged document to reactivate an expired context.
  References: spec “Client context”; plan §2.
- [ ] **M6 — Owner: feature-integration.** Add idempotent attachment association
  for allowed incoming, outgoing, and bot media while a valid context exists.
  Keep attachments without context chat-only. References: spec “Multimedia
  ownership and ingestion”; plan §3.

## Access and user interface

- [ ] **M7 — Owner: feature-integration.** Add workspace-scoped services,
  repository queries, contracts, and authenticated procedures for context,
  listing, reads, authorized URLs, source navigation, soft delete, restore,
  trash, and permanent delete. References: plan §4.
- [ ] **M8 — Owner: feature-integration.** Update `SysbrazoPanel` to gate all
  Sysbrazo content on a valid conversation context. Implement the multimedia
  block, filters, pagination, viewer, resend draft, accessibility, realtime,
  stale-response protection, expired-context `Chat inactivo` state, and
  translations. References: plan §5.
- [ ] **M9 — Owner: feature-integration.** Integrate the approved canonical
  multimedia permissions into UI capability checks and every server mutation or
  read. References: spec “Security and tenancy”; plan §4.

## Retention and verification

- [ ] **M10 — Owner: worker-development.** Add the 30-day retention purge job,
  scheduler registration, locking, blocked-owner guard, idempotent object
  deletion, and audit records. References: spec “Deletion and retention”; plan
  §6.
- [ ] **M11 — Owner: debug-specialist.** Add tests for context expiry/replacement,
  missing-client invalidation, same client from multiple contacts, attachment
  idempotency, MIME allowlist, tenant isolation, direct forged calls, per-user
  reads, soft delete/restore, and permanent purge retry behavior. References:
  spec acceptance criteria.
- [ ] **M12 — Owner: debug-specialist.** Add UI tests for active/expired panel
  states, filters, five-item loading, viewer keyboard behavior, realtime update,
  and permission-gated trash actions. References: plan §5.
- [ ] **M13 — Owner: parent.** Request approval for targeted tests, lint,
  touched-package type checks, the relevant test suites, and coverage. Record
  results without claiming unrun checks passed.
- [ ] **M14 — Owner: parent.** With documentation approval, write
  `docs/context/feature/sysbrazo-client-multimedia.md`, update the panel context
  document, and create `context.md` with actual changed files, deviations,
  migration status, test results, and rollout instructions.
