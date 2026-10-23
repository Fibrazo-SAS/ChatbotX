# Specification: Contact panel diagnostics and tickets

## Ticket and review status

- Ticket: https://redmine.fibrazo.com.co/issues/15466
- Parent: #15464; prerequisite: #15467.
- Tracker: Feature. Priority: Normal.
- Status: Draft for user review. Implementation is not approved.
- Scope of this writing session: create `spec.md`, `plan.md`, and `task.md` in ChatbotX. No application changes in either repository.
- Goal: let advisors inspect client diagnostics and support tickets and start a diagnostic from the existing conversation contact panel, with manageable ChatbotX roles and individual permissions.

## Requirements and user decisions

The existing #15467 panel remains the entry point. Add Autodiagnostic and Tickets below its services/ONU content, not a separate application or tabbed demo.

The user supplied a React/Tailwind visual prototype in this conversation. Use its layout, badges, active-ticket highlight, diagnostic step presentation, and dialogs as visual references. Do not copy its mock data, preview toolbars, simulated timers, hardcoded totals, or nonfunctional links. Its Refresh button incorrectly starts a simulation: production Refresh only reloads data.

Keep `GET /api/botmaker/client/by-document` unchanged. It supplies the main client data and Sysbrazo `client.id`. Load diagnostics and tickets independently and asynchronously after resolving that ID, as already happens for ONU. A slow or failed support provider must not block identity, services, ONU, or diagnostics.

The user's latest clarification allows additional list retrieval through optional query parameters. Pagination is a transport concern, not a new requirement for visible page controls. Exact proposed query parameters are in `plan.md`; they are not existing API capabilities.

The user expanded #15466 to include a clearer, centralized ChatbotX roles-and-permissions administration surface, with both per-role and per-person control. Individual overrides are the proposed design below. A single diagnostic checkbox in the old dialog is no longer the complete requirement. Authorization lives in ChatbotX, not in Sysbrazo's human-user roles.

User decision: new runs initiated from ChatbotX must use a distinct `source=chatbotx` in Sysbrazo. The previous proposal to reuse `source=sysbrazo` is superseded. Historical sources remain unchanged. Complete removal of Community/edition logic is deferred to later work; only permission paths necessary for the new access-control feature are in this scope.

Confirmed scope clarification: defer renaming/normalizing existing sources (including `portal` to MiFibrazo and `whatsapp` to Botmaker). This ticket only adds `chatbotx` for new executions initiated here; it does not rename existing identifiers or relabel existing Sysbrazo source displays as part of that normalization. Reused active runs retain their original source.

## Confirmed repository evidence

| Location | Current behavior and consequence |
| --- | --- |
| ChatbotX `apps/builder/src/features/contacts/sysbrazo-panel/sysbrazo-panel.tsx` | Renders identity, contact, services, and ONU; separately fetches ONU using the resolved client ID. |
| ChatbotX `apps/builder/src/features/contacts/queries/get-sysbrazo-client.query.ts` | Resolves the upstream URL from the workspace configuration and Authorization headers from a published flow. Reuse that credential source, server-side only. |
| Sysbrazo `app/Http/Controllers/Api/ClientController.php::getClientByDocumentId` | Already returns `id` and performs multiple data lookups. No support payload expansion is needed. |
| Sysbrazo `app/Http/Controllers/Api/AutoDiagnosticController.php::runs` | Returns only three runs, with formatted dates and steps; not a complete history contract. |
| Same controller, `start` / `status` | Starts queued diagnostics or returns an existing active run; returns step status. The active-run check and creation are not atomic in this controller. |
| Sysbrazo `app/Models/AutoDiagnosticRun.php` | Stores client, Sysbrazo user, source, status, start/end dates, and JSON data; relates to steps and user. |
| Sysbrazo `app/Services/AutoDiagnostic/AutoDiagnosticService.php` | Steps are configurable, with an internal `finalizing` step. Source affects feature flags and execution behavior. |
| Sysbrazo `app/Jobs/AutoDiagnostic/AutoDiagnosticRunExecutorJob.php` | Persists step and total durations in step details. Do not simulate durations. |
| Sysbrazo `app/Services/Helpdesk/RecentTicketsService.php` | Combines Odoo/Redmine, sorts known open stages first, truncates the card to three, and converts provider exceptions to empty arrays. Its normalized rows lack some requested fields. |
| Sysbrazo `app/Clients/Redmine/Service/RedmineService.php::getContactIssues` | Can query contact issues by document. Full field coverage for the new UI remains to be verified. |
| Sysbrazo `app/Http/Middleware/ApiBasicAuthMiddleware.php` | Authenticates the integration; Basic Auth does not identify the human advisor. |
| ChatbotX `apps/builder/src/features/users/components/edit-user-workspaces-dialog.tsx` | Existing `/admin/users` membership editor; permission controls are currently hidden in Community. |
| ChatbotX `packages/database/src/partials/workspace.ts` | Existing per-membership permission schema; no diagnostic execution permission yet. |
| ChatbotX `packages/database/src/schema/workspace-member.ts` | Membership has an `owner`/`agent` role enum and individual JSON permissions. These ownership/membership roles are not reusable configurable permission profiles. |
| ChatbotX `apps/builder/src/features/workspace-members/schema/mutation.ts` | Duplicates permission keys rather than deriving the mutation contract from one permission catalog. |
| ChatbotX `apps/builder/src/lib/auth/permission-routes.ts::hasWorkspacePermission` | Workspace `superAdmin` bypasses individual flags. This is different from platform administration. |
| ChatbotX membership/invitation actions and `getSuperAdminPermissions()` | Community writes force full permissions; adding a checkbox alone would not enforce a selective operational capability. Actual deployed edition was not checked. |
| ChatbotX `packages/business/src/workspace-member/service.ts` | Existing platform-admin membership writes invalidate member caches; membership lookup can read without the list cache. |
| Sysbrazo `resources/views/client/includes/autodiagnostic.blade.php` and `routes/web.php:1942` | Button visibility checks `manage run autodiagnostic` plus client conditions; backoffice routes enforce session authentication and that permission. |
| Sysbrazo `app/Jobs/AutoDiagnostic/AutoDiagnosticRunDispatcherJob.php` | Applies blocking conditions before execution; the `sysbrazo` source bypasses the successful-runs daily limit applied to other sources. Source is a behavioral choice, not only a label. |

No runtime load measurements or upstream payload samples were collected. Separation avoids blocking unrelated blocks; it does not by itself reduce total upstream work.

## Acceptance criteria

Preserve the ticket's acceptance criterion IDs:

- [ ] CA-01: Show the latest three diagnostic executions, newest first.
- [ ] CA-02: Each row shows number, status, reason, timestamp, and source displayed as Sysbrazo, Portal, or Bot, plus **ChatbotX** for the new source required by the user.
- [ ] CA-03: Failed/canceled runs always show a reason; missing historical data uses an explicit fallback, not an invented cause.
- [ ] CA-04: Failed-run detail marks the failed step red and leaves later unexecuted steps incomplete.
- [ ] CA-05: Display diagnostic dates as `YYYY/MM/DD HH:mm:ss` and ticket dates as `YYYY/MM/DD HH:mm`, in an explicitly selected timezone.
- [ ] CA-06: Full history makes every execution accessible, newest first, with total count, ID, Odoo/Redmine references, user, status, reason, start/end dates, and executed-step count. ID and step count open detail. Missing references use `—`; missing user/start uses `N/A` as specified.
- [ ] CA-07: Open tickets appear first with a pale red background and red leading border. Finished tickets are not highlighted. Provider status mapping must cover the ticket's Open/In progress semantics, rather than depend on one display label.
- [ ] CA-08: Rows show optional title, support team, opening date, city, and individual/massive scope; massive tickets include affected-client count.
- [ ] CA-09: Active tickets show relative last-update time from a real timestamp.
- [ ] CA-10: Initially show three tickets. “Ver más (N restantes)” reveals the remaining tickets, retrieving additional data via query parameters if needed.
- [ ] CA-11: Distinguish no executions, no tickets, provider failure (“No verificado”), and no matching Sysbrazo client. Missing client disables/removes diagnostic execution.
- [ ] CA-12: Do not show whether the client has a replenishment/refund entitlement on ticket rows.
- [ ] CA-13: The green execution button matches the shared size used for “Nueva nota”; do not implement #15465 to achieve this.
- [ ] CA-14: Esc closes dialogs and focus returns to the opener, including history-to-detail navigation.

Additional execution and integration requirements:

- [ ] EX-01: Starting opens real progress. Disable repeat execution while active. Closing the dialog does not cancel the backend job; reopening shows its current state.
- [ ] EX-02: Finished detail shows executed steps, summary, and actual duration. Failed detail shows reason/duration. The ticket's pre-execution canceled case shows no steps and “No se ejecutó ningún paso”. If real data contains a cancellation after work started, do not falsely claim zero steps; resolve that display case during contract review.
- [ ] EX-03: On termination, refresh the three-row list. Refresh never starts a diagnostic.
- [ ] EX-04: Handle `created`, `running`, `paused`, `delayed`, and step warnings without falsely presenting success or waiting indefinitely without explanation. Do not add repair/resume/cancel controls under this ticket without approval.
- [ ] EX-05: Use panel-container width: full execution label at normal width, “Realizar” below 380 px, icon-only below 300 px with an accessible name.
- [ ] EX-06: Both blocks and dialogs use shared UI primitives and translations. Tickets are whole-row links opening in a new tab; diagnostic rows are keyboard-accessible detail triggers.
- [ ] EX-07: Switching contacts invalidates pending responses, polling, history, and selected details. Never display the previous client's support data.
- [ ] EX-08: Enforce contact access and execution permission server-side. Basic integration credentials alone are not advisor authorization.
- [ ] EX-09: Concurrent starts must not create duplicate active runs. Reusing a run must not overwrite its original source/actor or resume it implicitly.
- [ ] EX-10: New ChatbotX executions persist `source=chatbotx`, display as ChatbotX in both systems, and are included in source filters, reports, exports, and operational counters. Source-dependent rules are explicit; no accidental Portal/WhatsApp fallback.

## Roles and individual permissions (expanded ticket scope)

The design below is proposed for review, not approved application behavior:

- One administration area in ChatbotX, linked from the existing admin panel, with Users, Roles, and a permission matrix. Group permissions by actual product area and explain what each grants. This replaces scattered, duplicated controls rather than adding another independent permission editor.
- Reusable named access roles scoped to a workspace, with one assigned access role per membership in the first version. Keep `owner`/`agent` ownership and platform administration separate from those access roles. Role names/default grants are still for review; do not invent a production role catalog.
- Individual permission exceptions use three states: inherit from role, allow, deny. An explicit individual deny wins over a role grant; an explicit individual allow can grant beyond the role. Only authorized access administrators may change roles, assignments, or overrides.
- Show the effective permission and its origin (role, individual exception, or preserved legacy baseline). Changing a role must affect its assigned members without manually editing each user; preview affected members before saving.
- Add `runAutodiagnostic` / “Realizar autodiagnósticos” to the shared permission catalog. Its effective value comes from role plus user exception, defaults to false, and is never implicitly enabled by owner/workspace `superAdmin` or Community normalization. A user-level deny must remain effective even if their role permits execution.
- Start with platform-admin-only access administration, using the existing protected boundary. Delegation to workspace managers is a review decision, not an automatic consequence of `permissions.superAdmin`. Never let an ordinary membership edit or invitation become an alternate privilege-grant path.
- Reading diagnostics/history/tickets still requires contact access, not execution permission. Execution additionally requires the effective grant and current access to the specific contact. Granting execution never widens assigned-contact or tenant scope.
- Use a shared server-side permission resolver for both UI capability data and enforcement. Re-read current permission state for execution; role changes, user overrides, and assignment changes must invalidate dependent caches. No second authorization truth in Sysbrazo.
- Revocation blocks subsequent starts but does not cancel a dispatched run. Hide the button when denied; reject forged POST before contacting Sysbrazo.
- Preserve existing effective rights during migration, except the new diagnostic permission which begins denied until a role or user grant is explicitly configured. Do not convert current owners into ordinary agents or grant platform administration through an access role.
- Adapt edition coercion only where it would overwrite the new managed roles/permissions. Do not remove billing, licensing, cloud, or all Community branches under this ticket. Unmigrated permission behavior must remain compatible until an explicit cutover.
- Audit role definitions, assignments, user exceptions, and diagnostic initiation with actor, target/workspace, and meaningful before/after values. No advisor identity from untrusted browser input.

Acceptance criteria for this scope:

- [ ] PERM-01: A protected admin area manages role definitions, user/workspace assignments and individual exceptions with a clear effective-permission view.
- [ ] PERM-02: Missing/false effective execution permission hides the button and denies direct POST without an upstream call; true still requires valid contact access.
- [ ] PERM-03: Role and user revocations take effect on the next start request, even from an open panel; grants do not leak between workspaces.
- [ ] PERM-04: The new execution permission defaults denied for legacy/new memberships unless an approved role or user grant is assigned. Ownership, workspace super-admin status, and edition do not auto-grant it.
- [ ] PERM-05: Test inherit/allow/deny precedence, reassignment, role changes, protected role deletion, concurrent edits, and crafted membership/invitation payloads. A deny override wins over a role allow.
- [ ] PERM-06: Access-control changes and diagnostic attempts have useful audit context. No Sysbrazo user foreign key is fabricated from a ChatbotX user ID.
- [ ] PERM-07: Migration preserves existing effective rights, contact restrictions, ownership and tenant boundaries; unknown permission keys fail closed.
- [ ] PERM-08: Old permission editors delegate to the same service/model or become read-only links to the canonical editor. No conflicting effective-permission calculations or silent legacy writes.
- [ ] PERM-09: The managed access-control feature works in the current edition without removing the product's full edition system. Regression tests cover legacy and migrated permission paths.

This expands the ticket beyond a button and a JSON flag. Review the access-role scope, override precedence, schema/backfill strategy, and existing-rights compatibility before implementation. The exact roles must not be inferred from the current two-value ownership enum.

## Constraints

Do:
- Use Sysbrazo as the source of diagnostic and ticket data; keep only the required mapping/cache in ChatbotX.
- Preserve existing Bot/Portal/backoffice API contracts and the #15467 lookup/ONU behavior.
- Verify workspace/contact access before calling upstream; validate that requested runs belong to the resolved client.
- Use ISO timestamps with timezone in the new wire contract; format them in the UI.
- Keep explicit unknown/partial/error states when providers cannot supply complete data or counts.

Do not:
- Add diagnostics or tickets to `by-document`, expose integration secrets, or trust arbitrary browser-supplied client/user IDs.
- Treat a ChatbotX user ID as a foreign key to Sysbrazo users.
- Hardcode seven steps, example durations, affected-client counts, or support teams.
- Reuse the old tickets service unchanged when its swallowed errors would violate CA-11.
- Add notes, multimedia, manual document entry, new infrastructure, dependencies, or a parallel diagnostic engine.
- Run migrations, diagnostics against real clients, deployments, or Git mutations as part of SDD approval.

## Decisions requiring review

1. Access-control design: confirm workspace-scoped reusable roles versus platform-global templates, one role per membership, individual inherit/allow/deny precedence, administrator authority and initial role catalog. Define the compatibility migration and exact affected files before implementation.
2. Actor and source: **source is decided: `chatbotx`**. Recommend a server-derived ChatbotX initiator snapshot in run JSON, with `user_id` null unless a verified mapping exists. Define the new source's enable flag, daily limit, interaction/repair behavior, notification routing, and message fallback explicitly. Do not inherit the Sysbrazo daily-limit bypass simply from the fact that an advisor clicked the button.
3. Provider coverage: confirm the configured Odoo/Redmine sources, massive containment, actual support-team field, city, affected count, update timestamp, and exact total support. A project name is not automatically the support team.
4. Timezone and unusual outcomes: confirm the display timezone and canceled-after-start / paused / warning representations against real payloads.

These decisions block the affected implementation tasks, not preparation of this draft. Material scope changes require a revised plan and approval.

## Skills and rules

ChatbotX: `chatbotx-basecode`, `builder-ui-i18n`, `feature-scaffold`, `orpc-api`, `business-data-access`, `drizzle-database`, `security-review`, `testing-workflow`, `reliability-concurrency`, and `human-writing`. Load `turborepo-workflow` before verification commands; worker guidance applies if scope reaches job processing.

Rules: `AGENTS.md`, `.agents/rules/data-access.md`, `.agents/rules/git.md`, `.agents/rules/no-dynamic-import.md`, and `.agents/rules/human-writing.md`. Preserve triple-d middleware names, workspace scoping, shared package boundaries, and i18n requirements.

Sysbrazo: follow its `AGENTS.md`, relevant `.cursor/rules/` domain guidance, existing service/client boundaries, and Docker-based PHP test workflow. No new repository/DDD layer.

## Settings and documentation

Reuse `SYSBRAZO_CLIENT_API_URL` and the published flow's server-side headers. Do not add a second credential source. Existing diagnostic source flags remain authoritative; do not enable them automatically. Any new permission, setting, or migration must be listed before implementation.

The proposed `runAutodiagnostic` key belongs to the role/user permission catalog. Reusable roles and assignments are expected to require a ChatbotX schema migration; exact tables/columns and the legacy-rights backfill must be designed and approved, not applied automatically. Update permission guidance with the canonical resolver and operational-grant semantics.

Add explicit handling for the new diagnostic source's enable control in Sysbrazo (proposed setting name: `chatbotx_autodiagnostic_enabled`, default disabled). This operational switch is not an advisor permission; per-person and per-role authorization remains exclusively in ChatbotX. Enabling it in an environment requires separate approval.

At iteration close:
- Update ChatbotX `docs/context/feature/contact-sysbrazo-panel.md`.
- Add ChatbotX `docs/context/auth/roles-and-permissions.md` (proposed) for role scope, overrides, migration, and permission administration.
- Add Sysbrazo `docs/context/integrations/chatbotx-contact-support.md` (proposed new document).
- Write `context.md` here with actual changes, tests, deviations, subagents, and manual QA. Do not report the implementation as complete in this draft.
