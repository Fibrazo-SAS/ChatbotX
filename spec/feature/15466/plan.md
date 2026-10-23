# Plan: Contact panel diagnostics and tickets

## Approval status and boundaries

Draft for review; application implementation is not approved. The user authorized these SDD documents only. `task.md` is a proposed checklist, not authorization to execute it.

Scope revision: the user requires a distinct Sysbrazo diagnostic source `chatbotx` and centralized ChatbotX roles/permissions with individual exceptions. Earlier suggestions to reuse source `sysbrazo` or implement only an isolated user checkbox are superseded. Complete edition/Community removal is explicitly deferred. This revision requires renewed implementation review, especially for authorization and schema changes.

At inspection, ChatbotX is on `feat/15467` with a pre-existing modification to `docker-compose.yml`; its local `main` predates that feature's commits. Sysbrazo is on clean local `main`. The user reports the previous work is merged remotely, but remote synchronization was not performed. Before implementation, propose the exact Git preparation and get approval. Preserve the Docker change; no automatic stash, restore, pull, checkout, or branch creation.

## 1. Data flow

```text
Contact panel -> authenticated ChatbotX backend -> existing by-document lookup
  -> render main data and resolve Sysbrazo client ID
  -> independent ONU request (unchanged)
  -> independent diagnostics list request
  -> independent tickets list request

Open history -> fetch remaining diagnostic summaries on demand
Open detail -> fetch only the selected run's steps
Start -> authorize advisor -> Sysbrazo start -> existing queue -> poll run detail
```

The browser never calls Sysbrazo with integration credentials. ChatbotX verifies workspace membership and the advisor's actual access to this contact, including assigned-contact restrictions. It validates the Sysbrazo ID against a server-resolved contact mapping; accepting an arbitrary client ID with only workspace membership is insufficient. Reuse the validated lookup result through a bounded server-side mapping/cache rather than repeating the heavy lookup on every poll. Invalidate the mapping when the document or integration configuration changes. Missing/stale mapping must be re-resolved, not trusted.

## 2. Proposed HTTP contract

These are new routes, not claims about current endpoints. Add them to the existing authenticated `/api/botmaker` integration group, without exposing them to the public Portal lookup.

| Method | Path relative to `/api/botmaker` | Behavior |
| --- | --- | --- |
| GET | `/client/{clientId}/autodiagnostics` | Summary list, latest first, with exact total. No full step payload in the list. |
| GET | `/client/{clientId}/autodiagnostics/{runId}` | Detail/progress; enforce run-to-client ownership. |
| POST | `/client/{clientId}/autodiagnostics` | Start through existing orchestration or return the existing active execution. |
| GET | `/client/{clientId}/tickets` | Normalized tickets, open first then newest, with provider verification metadata. |

### Query parameters and retrieval

Proposed defaults for review: optional `page` (default 1) and `per_page` (default 3, capped at 100). These are query parameters, not URL path segments or separate endpoints for each count. Reject invalid values. Exact names can follow an existing adjacent API convention during contract review, before coding.

- Initial panel requests use the default three items.
- History opens with larger bounded requests (proposed 50 per request), then retrieves all remaining summaries while the dialog remains open. Show loaded count versus total truthfully until complete, then “1 to N of N”. No invented twelve-row total or three-item history cap.
- “Ver más” retrieves/reveals the remaining tickets in bounded requests. Do not replace the ticket requirement with an unrelated pagination toolbar.
- Do not paginate a provider's already-truncated list and label it complete. Merge/sort the intended result set before slicing, or use a provider-aware strategy that preserves global ordering and accurate totals. Verify upstream capabilities first.
- Query parameters never bypass authentication, client scoping, or maximum response sizes.

### New normalized response fields

Define and test these at the API boundary; upstream fields must be mapped, not assumed:

- Diagnostic summary: ID, normalized status, source, reason code/text, created/start/end ISO timestamps, nullable actor name, Odoo/Redmine references, executed visible-step count, and duration when available.
- Diagnostic detail: summary plus ordered visible steps, stable step names, statuses, reason/message, start timestamp and duration where recorded. Exclude internal `finalizing` from the displayed count/list, but use its actual summary when appropriate.
- Tickets: provider-qualified identity, display ID, URL, normalized status/open flag, optional title, support team, city, opening/update ISO timestamps, individual/massive scope, and affected-client count when known.
- Lists: items, total, and pagination metadata. Tickets also include per-provider verification status so partial failure is not confused with an empty successful result. Unknown totals must not produce a fake “N restantes”.
- Errors: distinguish invalid input, missing client/run, forbidden action, upstream failure, and temporary start contention. Do not return successful empty arrays for provider failures.

## 3. Sysbrazo changes

### Read APIs

Add thin panel-specific controllers and services. Query local diagnostic tables with bounded pagination, eager-load actors only where needed, and load steps only for detail or required summary calculations. Reuse stored reasons/durations; explicitly map legacy missing fields.

Do not modify the response of existing `AutoDiagnosticController::runs()` or `status()` for other consumers. Reuse their underlying models and business behavior through the new contract.

For tickets, reuse Odoo/Redmine clients and URL helpers. Check `HelpdeskProviders` to honor enabled providers. Use contact-containment data for Redmine massive tickets; the old `cf_sysbrazo_id`-style lookup alone is insufficient to establish all contained tickets. Verify whether combining sources produces duplicate representations and define identity/deduplication without guessing.

The existing `RecentTicketsService` is a reference, not a drop-in implementation: it swallows errors, limits fetched results, and maps Redmine project name as team. Prefer a panel-specific read service over changing old consumers' behavior.

### Execution

Resolve the proposed role/user permission policy and actor metadata before implementing POST. The new source value is fixed by the user's decision: `chatbotx`. Set it server-side on the dedicated integration handler; the browser cannot choose it. Reuse `AutoDiagnosticService` and the dispatcher; do not invoke controllers from other controllers.

### Existing Sysbrazo flow to reuse

1. `autodiagnostic.blade.php` supplies `canRunAutodiagnostic` from `manage run autodiagnostic` and client conditions (CPE present, no open Krill alarm or active massive Odoo/Redmine ticket).
2. `Autodiagnostic.tsx` shows the button conditionally and calls the backoffice start route. That route also checks session authentication and permission. Its UI sends `source=sysbrazo` and the current Sysbrazo user ID; ChatbotX must not copy the cross-system user ID assumption.
3. `AutoDiagnosticController::start()` returns an active run or creates one through `AutoDiagnosticService`, then dispatches `AutoDiagnosticRunDispatcherJob`.
4. The dispatcher applies blocking rules, marks the run running, and dispatches the executor. The `sysbrazo` source skips the successful-run daily cap. Preserve these business checks even when the advisor has permission.
5. Default visible steps are initialization, account/credit, CPE state, optical signal, internet ping, device count, and Wi-Fi quality. The actual list is configurable; `finalizing` is internal. The executor records real outcomes and timings.

ChatbotX follows this separation of visibility, authorization, business eligibility, and execution. It does not need a Sysbrazo browser session or per-person Sysbrazo role: its authenticated backend resolves role plus user overrides, validates contact scope, then calls the integration-protected route with source `chatbotx`. Do not expose integration credentials or a generic start proxy. Permission is not a guarantee that the client's diagnostic can run; existing blockers may still produce a canceled result with a reason.

Proposed attribution: stamp a server-derived ChatbotX actor snapshot (user ID, workspace ID, display name, integration origin) in run JSON and audit context, not `AutoDiagnosticRun.user_id`. The protected integration route validates that metadata and fixes source `chatbotx`. Basic Auth identifies the calling integration, not the advisor; the trust boundary is the authorized ChatbotX backend. No caller-supplied `canRun=true` flag is treated as authority. Reusing a pre-existing Portal/WhatsApp/Sysbrazo run keeps its original source and initiator.

### New source integration checklist

Adding a model constant alone is not enough. The inspected code has source-specific execution branches and explicit lists in monitoring/reporting:

- Add `SOURCE_CHATBOTX` and update wire/UI type unions and labels in both systems. Preserve all historical values.
- Do not rename `portal`, `whatsapp`, or `sysbrazo`, migrate historical source values, or introduce MiFibrazo/Botmaker display renaming under this ticket. The user explicitly deferred that normalization; only the new ChatbotX origin is added.
- Add a source enable mapping in `AutoDiagnosticService`; its current unknown-source branch has no enable flag. Proposed dedicated switch: `chatbotx_autodiagnostic_enabled`, default disabled, with a reviewed setting registration/seed if required.
- Define daily-limit and user-interaction/auto-repair rules explicitly in the dispatcher/service. New origin does not imply inheriting Portal defaults or Sysbrazo's daily-limit exemption. Present the policy for review before implementation.
- Review executor, repair, retry, cancellation, finalization, events, and message selection so ChatbotX runs cannot unexpectedly trigger WhatsApp intents or require a Portal interaction the panel cannot perform.
- Include ChatbotX in dashboard counts/filters, exports, and concurrent-run monitoring. Review Blade history displays as well as React labels; show the ChatbotX actor where available without changing old user attribution.
- Protect the new start surface and reject attempts to select the new source through inappropriate legacy callers. Existing authorized old routes retain their response contract; source validation additions need compatibility tests.
- The inspected original source migration creates a string column, not a database enum. Verify subsequent constraints before deciding whether a Sysbrazo schema migration is required; never rewrite the historical migration.

Protect active-run lookup and creation with a per-client lock shared by the existing start entry point and the new one. A lock only in the ChatbotX route would not prevent races with Portal/Bot/backoffice. Keep job dispatch behavior and existing repeat/resume semantics for old callers; the new endpoint never implicitly resumes a paused run. Keep the shared change limited to start coordination and prove compatibility with regression tests. Use existing locking patterns after inspecting their transaction/queue ordering.

The diagnostic data model may not require a Sysbrazo migration for the new string source; setting registration or later constraints still need verification. ChatbotX access roles are a separate expected schema change. Every migration/seed must be designed, reviewed, and separately approved for execution.

## 3a. Centralized ChatbotX access roles and individual permissions

Current state: `/admin/users` and workspace member dialogs expose overlapping switches, the mutation schema repeats the key list, and `owner`/`agent` represents membership ownership rather than reusable permission profiles. Improve this inside #15466; do not build a second independent set of diagnostic-only roles.

Proposed design for review:

1. **One permission catalog:** list existing capabilities and `runAutodiagnostic`, grouped with translated labels/descriptions. Derive validated forms and typed policies from it rather than hand-copying keys. Distinguish access to a section, data scope, and operational actions.
2. **Reusable access roles:** proposed workspace-scoped role definitions with name, permission grants, and one role assignment per membership. Preserve the existing owner/agent field and last-owner protection separately. No role inheritance or multiple-role conflict engine in the first version.
3. **User exceptions:** store inherit/allow/deny separately from the role grant. Effective value is an explicit user override when present, otherwise the role grant, otherwise denied. `runAutodiagnostic` never receives an implicit super-admin/owner/edition bypass.
4. **Admin UX:** proposed access-management section linked from the existing admin area, with Users, Roles, and a grouped permission matrix. User editing shows assigned role, exceptions, effective rights, and their origin. Role edits preview affected users; deleting an assigned role is blocked until reassignment. Exact route/navigation is to be reviewed before file creation.
5. **Authority:** initially reuse the existing platform-admin server boundary for role definitions/assignments/overrides. Workspace `permissions.superAdmin` does not automatically grant access-control administration. Any delegated administration needs explicit anti-escalation rules and approval.
6. **Canonical service/resolver:** role and membership writes go through business/repository services with workspace scoping, transactions/concurrency controls, audit, and cache invalidation. Role edits invalidate every affected membership. UI capability data, page/API/action guards and contact restrictions must use the same effective result; no raw-role-only decision at the start endpoint.
7. **Compatibility:** inventory raw `permissions` readers/writers before implementation. Preserve existing effective rights as a legacy baseline or explicit override set during migration; do not auto-assign a generous named role. Existing editors either delegate to the new service or link read-only to it. Avoid storing two independently editable effective-permission snapshots.
8. **Edition boundary:** remove forced full-permission normalization only for access-control paths migrated under this ticket, where it would destroy role/user policy. Keep other edition/licensing behavior intact. Define a clear legacy-versus-managed cutover and test both; do not claim to have removed Community globally.
9. **Fresh execution checks:** fetch current role/override/membership state for each POST, verify contact scope, and deny before any upstream call if ineffective. Revocation does not cancel an already dispatched run. Audit both permission changes and start outcomes with actor/run context.

This requires a reviewed schema design, expected to include a role definition table, membership role assignment, and override storage. Exact names, indexes, foreign keys, tenant/workspace constraints, relation registration and backfill SQL are not yet approved. Do not merely expand `workspaceMemberRole` with job titles: it currently expresses ownership.

The following details remain review gates: workspace-local roles versus global templates, initial role names/grants, single-role assignment, deny precedence, administrative authority, legacy `superAdmin` semantics for non-diagnostic capabilities, and migration/cutover behavior. This is now an access-control workstream within the ticket, not a small checkbox patch.

## 4. ChatbotX integration and UI

- Add authenticated contact support procedures under the contacts API with Zod request/response contracts.
- Reuse the URL/header resolver from #15467 with a small shared extraction if needed. Keep credentials server-side and preserve current SSRF/request protections. No direct database imports in app code.
- Add separate diagnostics and tickets loading/error state. Keep the main panel visible during these requests.
- Extend the no-client rendering branch: it currently returns before rendering support blocks. Provide the ticket's explicit support empty states without showing stale data or an execution button.
- Add collapsible blocks and shared Dialog/Table/Button components. Use real anchors for ticket rows and buttons for diagnostic rows.
- Use the existing panel's compact spacing and container-width behavior; do not copy the demo's large standalone cards or viewport breakpoints unchanged.
- Add translations to all required supported catalogs, including the #15467 locales and the catalogs required by the i18n checker. Avoid dynamic unbounded translation keys.
- History/detail dialogs maintain keyboard focus; no nested interactive elements in a whole-row link/button.

### Polling and load

Proposed active-run interval: 3 seconds with no overlapping requests; back off on errors and obey rate-limit responses. This value is subject to the integration rate-limit budget, not a performance guarantee. The inspected Sysbrazo API limiter defaults to 500 requests/minute per user/IP, so many advisors behind one ChatbotX server can share a budget.

Poll only a selected contact's active run; stop on terminal status, contact change, unmount, or hidden page. On visibility/reopen, refresh real status. Closing the detail dialog does not cancel execution; the selected contact's block can continue tracking it. Revalidate status after transport failure instead of showing a terminal result or enabling duplicate starts.

Deduplicate concurrent reads. Consider a short shared ticket cache (proposed 15 seconds) and short active-status coalescing if needed for the rate budget; cache keys must include the integration identity and client/run, never only a numeric ID. Do not cache an upstream failure as verified-empty, and do not introduce new Redis/infrastructure dependencies. Resolve cache placement before implementation so it does not duplicate stale caches in both projects.

## 5. Proposed affected files

Paths marked **new** are proposed, not existing repository symbols. Final filenames should follow adjacent code; materially different ownership/scope requires review.

### ChatbotX

| Path | Change |
| --- | --- |
| `apps/builder/src/features/contacts/sysbrazo-panel/sysbrazo-panel.tsx` | Mount support blocks and handle no-client/reset behavior. |
| `apps/builder/src/features/contacts/sysbrazo-panel/autodiagnostic-block.tsx` (**new**) | Summary rows, execution and refresh controls. |
| `apps/builder/src/features/contacts/sysbrazo-panel/autodiagnostic-dialog.tsx` (**new**) | Real progress and terminal detail. |
| `apps/builder/src/features/contacts/sysbrazo-panel/autodiagnostic-history-dialog.tsx` (**new**) | On-demand full history and detail navigation. |
| `apps/builder/src/features/contacts/sysbrazo-panel/tickets-block.tsx` (**new**) | Ticket rows, provider state, and expansion. |
| `apps/builder/src/features/contacts/sysbrazo-panel/use-sysbrazo-support.ts` (**new**) | Scoped async state, active-run polling and request invalidation. |
| `apps/builder/src/features/contacts/schema/sysbrazo-support.ts` (**new**) | Boundary schemas and typed statuses. |
| `apps/builder/src/features/contacts/queries/get-sysbrazo-client.query.ts` | Small credential-resolver reuse/extraction, preserving lookup/ONU behavior. |
| `apps/builder/src/features/contacts/queries/sysbrazo-support.query.ts` (**new**) | Authorized read orchestration through existing services. |
| `apps/builder/src/features/contacts/api/private.ts` | Contact-bound read/start procedures; start delegates to server-side orchestration. |
| `packages/database/src/partials/workspace.ts` and `schema/workspace-member.ts` | Reviewed permission types and access-role assignment/override storage; preserve ownership semantics. |
| `packages/database/src/schema/`, `relations/`, `repositories/`, and `drizzle/` | Proposed new role model/relations/repository/migration; exact filenames depend on schema review. Register relations imports and spreads. |
| `apps/builder/src/features/access-control/` (**new**, proposed) | Canonical role editor, matrix, assignments, overrides, schemas and protected mutations; not yet existing APIs. |
| `apps/builder/src/app/` admin route and admin navigation | New access-management entry point; exact route/files to be approved at T0. |
| `apps/builder/src/features/users/components/edit-user-workspaces-dialog.tsx` and `schema/platform-user.ts` | Surface assigned access role, effective permissions and link/shared editor instead of independent switches. |
| `apps/builder/src/features/users/actions/update-user-membership.action.ts` | Delegate to canonical access-control service; no managed-policy overwrite by edition defaults. |
| `packages/business/src/access-control/` (**new**, proposed) | Canonical role/override resolution, protected writes, concurrency and role-wide invalidation. |
| `packages/business/src/workspace-member/service.ts` | Preserve ownership and membership lifecycle while integrating role assignment/overrides. |
| `apps/builder/src/features/workspace-members/helpers.ts` and `hooks/use-permissions-coupling.ts` | Remove duplicate policy/coupling where migrated; no implicit execution grant. |
| `apps/builder/src/features/workspace-members/actions/`, `components/`, and `schema/mutation.ts` | Route existing writes through the canonical policy or retire controls; reject privilege escalation through old payloads. |
| `apps/builder/src/features/invitations/actions/accept-invitation.ts` | Safe assignment/default policy; no role/override grants from untrusted invitations. |
| `apps/builder/src/lib/auth/permission-routes.ts`, `require-workspace-permission.ts`, and permission consumers | Integrate effective permissions without bypassing individual denials; exact reader/writer inventory is a pre-code gate. |
| `apps/builder/src/features/contacts/sysbrazo-panel/permissions.ts` (**new**) | Consume canonical effective capability plus contact scope; no second permission source. |
| `packages/business/src/workspace/service.ts` and other creation call sites | Safe migration-compatible membership defaults; no automatic diagnostic grant. |
| `apps/builder/messages/*.json` | Support panel and access-management translations. |
| `apps/builder/__tests__/sysbrazo-support-api.test.ts` (**new**) | API authorization, mapping, upstream errors. |
| `apps/builder/__tests__/sysbrazo-autodiagnostic-permissions.test.ts` (**new**) | Edition/role matrix, direct POST, revocation, invitation/default and admin mutation tests. |
| `apps/builder/__tests__/workspace-members-actions.test.ts` | Regression coverage for preserved operational grants and ordinary permissions. |
| `packages/business/__tests__/workspace-member-autodiagnostic-permission.test.ts` (**new**) | Scoped writes, cache invalidation, audit, and concurrent generic/capability edits. |
| `packages/business/__tests__/access-control.test.ts` and `apps/builder/__tests__/access-control.test.tsx` (**new**, proposed) | Role resolution, override precedence, assignment/deletion, migration compatibility, admin UI and authorization. |
| `apps/builder/src/features/contacts/sysbrazo-panel/__tests__/` | Focused UI/state tests, proposed new files. |
| `docs/context/feature/contact-sysbrazo-panel.md` | Contract, permissions, async flow and QA documentation. |
| `docs/context/auth/roles-and-permissions.md` (**new**) | Canonical policy, role/user UI, migration and effective-rights examples. |
| `.agents/skills/security-review/SKILL.md` | Document canonical access resolution and sensitive-action rules. |

The expanded access-control areas above are required design scope, not blanket approval to edit all files within them. T0 must provide exact schema, route/navigation, permission reader/writer, and migration file lists for approval before implementation. Server-side client mapping/cache ownership also remains to be finalized. New data-access logic belongs in business/repository layers, not direct app queries.

### Sysbrazo

| Path | Change |
| --- | --- |
| `routes/api.php` | Add authenticated, client-scoped panel endpoints. |
| `app/Http/Controllers/Api/ChatbotxContactSupportController.php` (**new**) | Thin list/detail/tickets/start handlers. |
| `app/Http/Requests/Chatbotx/` (**new**, proposed request files) | Validate query parameters and agreed start payload. |
| `app/Services/AutoDiagnostic/ClientDiagnosticReadService.php` (**new**) | List/detail serialization and summary queries. |
| `app/Services/Helpdesk/ClientSupportTicketsService.php` (**new**) | Provider-aware panel ticket read contract. |
| `app/Http/Controllers/Api/AutoDiagnosticController.php` | Delegate narrowly scoped shared start coordination; preserve old response contracts. |
| `app/Services/AutoDiagnostic/AutoDiagnosticStartService.php` (**new**) | Shared active-run check/create locking and existing start orchestration. |
| `app/Models/AutoDiagnosticRun.php` | Add the distinct ChatbotX source and documented initiator metadata. |
| `app/Services/AutoDiagnostic/AutoDiagnosticService.php` | New source enable mapping and reviewed interaction policy. |
| `app/Jobs/AutoDiagnostic/AutoDiagnosticRunDispatcherJob.php` and `AutoDiagnosticRunExecutorJob.php` | Explicit source policy for limits, execution/events and finalization; no WhatsApp side effects by fallback. |
| `app/Services/AutoDiagnostic/AutoDiagnosticDashboardStatsService.php` | Include new source in stats/filter normalization. |
| `app/Exports/AutoDiagnosticRunsExport.php` | Source filter/export coverage. |
| `app/Console/Commands/AutoDiagnostic/MonitorConcurrentAutodiagnosticRuns.php` | Count the new source in operational monitoring. |
| `resources/src/featured/client/Autodiagnostic/types.ts` and `const.ts` | New source union and display label. |
| `resources/src/featured/autodiagnostic/Dashboard/AutoDiagnosticDashboard.tsx` | Display ChatbotX in source filters and counts. |
| `tests/Feature/Api/ChatbotxContactSupportTest.php` (**new**) | New route/auth/scoping/contracts. |
| `tests/Unit/Services/Helpdesk/ClientSupportTicketsServiceTest.php` (**new**) | Normalization, containment, counts, ordering and failure handling. |
| `tests/Feature/AutoDiagnostic/` | New start coordination/regression tests. |
| `docs/context/integrations/chatbotx-contact-support.md` (**new**) | API contract and compatibility notes. |

Odoo/Redmine client changes are conditional on verified field coverage. Complete the new-source cascade across repair/retry/cancellation/message handlers and Blade/export displays before coding those paths. New setting registration/seed files need an exact reviewed plan. No new vendor integration or diagnostic job type is proposed; ChatbotX access-role migrations are now expected scope but are not approved for execution.

## 6. Verification

Before running commands, approve the exact commands and confirm an isolated test environment. PHP tests may mutate their test database; never run against production or shared client data. Do not start services automatically.

ChatbotX gate, in order:
1. `pnpm lint`.
2. `pnpm --filter builder check-types`, plus database and business workspace type checks using their verified scripts because the shared permission type/service are now in scope.
3. Targeted new/related Vitest tests, then the affected workspace suite as justified (`pnpm --filter builder test`).
4. Coverage (`pnpm --filter builder test -- --coverage`) with the repository threshold preserved. Report baseline failures separately; do not disable thresholds.

Sysbrazo: in the approved app container, run Pint in check mode against touched PHP files, targeted Pest tests, and related existing diagnostic/ticket regressions. Exact new test paths are listed above; inspect test bootstrap/database configuration before execution. Proposed command forms: `docker-compose exec app vendor/bin/pint --test <files>` and `docker-compose exec app vendor/bin/pest <tests>`; substitute the reviewed file list before requesting execution approval.

Required test cases:
- Missing authentication, denied execution permission, unassigned contact, forged client ID, and run/client mismatch.
- Admin control in Community and other editions; missing/false/true grant across agent/owner/workspace-super-admin/platform-admin roles. Only explicit true plus contact access permits execution.
- Named-role assignment and updates, user inherit/allow/deny precedence, assigned-role deletion protection, legacy-to-managed migration, no privilege escalation, and canonical behavior across old/new editors and guards.
- `source=chatbotx` persists and displays correctly, is counted/exported, uses the approved enable/limit/interaction policy, and does not trigger WhatsApp intents or assume Portal sessions. Existing sources remain unchanged.
- Revocation from an already-open panel, grant isolation across workspaces, forged workspace-admin mutations/invitations, creation defaults, legacy JSON parsing, generic permission edits preserving grants, concurrent saves, audit deltas, and cache invalidation.
- Empty, missing client, malformed response, provider timeout, one-provider failure, and both-provider failure.
- Initial three, complete history, accurate totals, additional query parameters, old open tickets preceding newer closed ones, and massive containment.
- Real step timing, failure leaving later steps pending, pre-execution cancellation, historical missing fields, paused/delayed/warning states, active-run reuse, and concurrent starts.
- Contact switch while requests/polling are pending; close/reopen while running; stale credential/mapping cache; API rate limiting.
- Keyboard row activation, Esc, focus restoration, narrow widths, translations, whole-row external links, and no replenishment labels.

Manual diagnostic execution requires a separate explicit approval naming the non-production client/environment because existing jobs can interact with network equipment or external support systems. Prefer mocked provider tests before manual execution.

## 7. Risks and approval gates

Overall risk: **high** after the role/user access-control expansion. Authorization changes and migration can affect existing access beyond this panel; review them as a separate workstream within #15466, with backward-compatibility tests before enabling the diagnostic action.

| Risk | Mitigation |
| --- | --- |
| Exposing another client's support data | Server-resolved mapping, contact access scope, nested run ownership tests. |
| Community/full-permission normalization bypasses an advisor restriction | Explicit operational grant, edition-independent admin control, preservation across writes, fresh POST check. |
| An ordinary member self-grants execution through existing membership endpoints | Platform-admin-only capability mutation; ignore/reject capability changes in other write paths. |
| Wrong source changes automation behavior | Resolve source policy before POST; preserve old consumers. |
| Role migration widens access, locks users out, or overrides an individual denial | Preserve baseline rights, explicit precedence, scoped assignments, dry-reviewed migration and full reader/writer inventory. |
| New source silently omitted from filters or executes under fallback policy | Complete source cascade, operational reports, and source-specific regression tests. |
| Duplicate active diagnostics | Shared per-client start coordination, including old entry points. |
| Missing massive tickets or misleading counts | Verify provider containment/pagination; no false complete totals. |
| Shared rate-limit exhaustion | Active-only polling, bounded retries, coalescing and budget validation. |
| Breaking old API/UI consumers | New response contracts; narrowly scoped start coordination regression tests. |

Approval gates:
1. User reviews these draft SDD files and resolves/accepts pending decisions.
2. Obtain explicit approval for Git preparation separately, preserving existing local edits.
3. After T0 records approval of the proposed permission policy, actor/provider contract and exact remaining files, obtain implementation approval for each described cross-repository scope. Admin-managed execution permission is included in that scope. Do not treat this documentation request as coding approval.
4. Approve verification commands before execution and any manual diagnostic separately.
5. Write iteration context and scoped docs at close. Commit, push, PR creation, deployment, settings changes, and migrations each remain separate approval boundaries.
