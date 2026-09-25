# Context: Workspaces admin view — owner counter, owners ABM, row actions (#15136)

## Summary (vs plan)

Implemented exactly per plan.md, with one favorable deviation: **no new member
actions were needed** — the `/admin/users` console already shipped
`addUserToWorkspaceAction`, `updateUserMembershipAction`, and
`removeUserMembershipAction` (platform-admin gated, with last-owner guards in
the service), so the ABM dialog reuses them instead of adding three new
actions. Only 3 new actions were created (status, schedule/cancel deletion).

## Files changed

- `apps/builder/src/features/admin/schema/admin-workspace.ts` — resource extended (`isActive`, `scheduledDeletionAt`, `members`, `ownerCount`) + 3 request schemas.
- `apps/builder/src/features/admin/queries/list-admin-workspaces.ts` — new columns + `members`/`ownerCount` mapping.
- `apps/builder/src/features/admin/actions/update-workspace-status.action.ts` — new.
- `apps/builder/src/features/admin/actions/schedule-workspace-deletion.action.ts` — new.
- `apps/builder/src/features/admin/actions/cancel-workspace-deletion.action.ts` — new.
- `apps/builder/src/features/admin/components/manage-workspace-owners-dialog.tsx` — new.
- `apps/builder/src/features/admin/components/admin-workspaces-table.tsx` — counter badge, state badges, Actions column, delete confirm.
- `apps/builder/messages/en.json`, `es.json` — new `platformAdmin.workspaces.*` keys.
- `apps/builder/__tests__/admin-workspace-actions.test.ts` — new.
- `apps/builder/__tests__/list-admin-workspaces.test.ts` — new.
- `docs/context/feature/admin-workspace-directory.md` — new.

## Deviations

1. Member ABM reuses existing `/admin/users` actions (no duplicates created).
2. Last-owner guard errors surface as `serverError` toasts (raw service
   message, English) — same convention as the existing `/admin/users` console.
3. `messages/en.d.json.ts` (next-intl generated types) not hand-edited; it
   regenerates on the next dev/build run.

## Verification (run with user approval, 2026-09-23)

- [x] Targeted tests: 5/5 passed (`admin-workspace-actions.test.ts`, `list-admin-workspaces.test.ts`).
- [x] `pnpm --filter builder check-types` — passed.
- [x] `pnpm --filter builder lint` (i18n check) — passed after adding the new keys to all four locales (en, es, pt-BR, pt-PT). The i18n check requires every locale to carry every key, so pt-BR/pt-PT got full translations instead of falling back to English.
- [x] `pnpm turbo build --filter=builder` — passed (5m21s, all routes generated).
- [x] `ultracite check` on all touched files — clean (fixed nested ternary + deps in `admin-workspaces-table.tsx`, formatting in the dialog).
- [ ] Full `pnpm test` (entire builder suite) and root `pnpm lint` (all workspaces) — not run (heavy); no behavior outside the touched surface was changed.

Manual QA (after running the builder):
1. Open `/admin/workspaces` as platform super admin → owners column shows "N owners".
2. Click the counter → dialog lists members; add a user (search), change a role, remove a member.
3. Try to remove/demote the last owner of a workspace → error toast.
4. Actions menu: Deactivate/Activate toggles the row state; Delete asks for confirmation, row shows "Scheduled for deletion" badge and Cancel deletion appears.
5. Non-platform-admin cannot reach the route nor call the actions.

## Next steps

- Get user approval to run lint/typecheck/tests, then fix any findings.
- Consider `pt-BR`/`pt-PT` translations (currently fall back to English, per convention).
