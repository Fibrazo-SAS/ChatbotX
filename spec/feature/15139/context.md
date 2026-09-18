# Context: Restrict flow deactivation/activation by role (ticket 15139)

## Summary (done vs plan)

Implemented exactly per plan: agents can no longer activate/deactivate flows.
- Server-side gate in `updateFlowAction` (owner / tenant superAdmin flag / global platform super admin).
- Blocked attempts audited (`flowActivationBlocked` / `flowDeactivationBlocked`) and rejected with 403 + translated message.
- UI: flows table status Switch disabled with tooltip for members that cannot toggle.
- `enableInInbox` and rename intentionally NOT gated (per plan decision).

## Files changed

- `apps/builder/src/lib/auth/flow-status-permissions.ts` (new) — `canToggleFlowStatus` helper
- `apps/builder/src/lib/safe-action.ts` — `workspaceActionClient` ctx now exposes `workspaceMemberRole` + `user` (additive)
- `apps/builder/src/features/flows/actions/update-flow-action.ts` — gate + blocked-attempt audit + 403; `updateFlow` exported for tests
- `apps/builder/src/features/flows/flows-table-columns.tsx` — disabled Switch + tooltip + onError toast
- `apps/builder/src/features/flows/flows-table.tsx` — threads `canToggleFlowStatus`
- `apps/builder/src/app/space/[workspaceId]/(has-folder)/flows/page.tsx` — computes capability (React-cached membership)
- `apps/builder/messages/*.json` (20 locales) — new keys
- `apps/builder/__tests__/update-flow-action.test.ts` (new) — 8 tests
- `docs/context/flow/flow-status-permissions.md` (new)

## Tests run

- `pnpm --filter builder build` ✅ (Next.js production build, full route table generated)
- `pnpm --filter builder lint` (i18n:check) ✅
- `pnpm --filter builder check-types` ✅
- `pnpm --filter builder exec vitest run __tests__/update-flow-action.test.ts` — 8/8 ✅
- `pnpm exec ultracite check` on touched files ✅
- Full builder suite: 2356/2359 pass. The 3 failures are in `broadcasts-calendar.test.tsx` and are **pre-existing** — verified they fail identically on clean HEAD (stash test), unrelated to this ticket.

## Deviations from plan

1. i18n keys were added to **all 20 locale files**, not just en/es: builder `lint` runs `i18n:check`, which enforces key parity across locales. Non-es locales got English values (repo convention; translators fill later).
2. `zh-CN.json` has a legacy/partial structure (many nested `errors` sections); the batch insertion initially misplaced one key — fixed manually and re-validated with `i18n:check`.

## Subagents executed

None.

## Next steps / blockers

- Manual QA with the three roles (owner, agent, tenant superAdmin, platform superAdmin) — see below.
- Commit spec + code together (SDD convention).
- Out of scope (flagged in plan): restricting `enableInInbox`, delete/duplicate, or gating other flow surfaces — ask the client if wanted.

## How to test

Automated: `pnpm --filter builder exec vitest run __tests__/update-flow-action.test.ts`

Manual QA:
1. **Owner** → Flows list → status switch toggles; audit log shows `activate`/`deactivate`.
2. **Agent** (flows permission, no superAdmin flag) → status switch appears disabled with tooltip "Only the owner or a superAdmin can activate or deactivate flows."; a direct `updateFlowAction({ active: false })` call returns 403 and the audit log shows `flowDeactivationBlocked` with user/role/flow.
3. **Agent with superAdmin flag** → can toggle normally.
4. **Platform super admin** → can toggle normally.
5. **Agent rename** → still works (audit `update`).
