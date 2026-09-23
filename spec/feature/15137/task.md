# Tasks: Onboarding flows — Initial password setup for new users (ticket 15137)

References: `plan.md` (Approach + Changes), `spec.md` (acceptance criteria).

- [ ] 1. DB schema: add `onboardingCompletedAt`, `passwordSetupTokenHash`, `passwordSetupTokenExpiresAt` + unique index to `userModel` — Owner: `database-schema` (plan §1)
- [ ] 2. Generate migration via `make:migration`, add backfill `UPDATE "User" SET "onboardingCompletedAt" = "createdAt"`, review SQL by hand — Owner: `database-schema` (plan §1, approval gate: never auto-apply)
- [ ] 3. `packages/mail`: `set-password.ts` MJML template + default subject/template + `sendSetPassword` in `index.ts` (+ preview entry) — Owner: `feature-integration` (plan §3)
- [ ] 4. `packages/auth/src/password-setup.ts`: `requestPasswordSetup` (tenant-aware, hashed token, 24h, email) + `completePasswordSetup` (atomic claim, hash password, credential Account row) — Owner: `feature-integration` (plan §2)
- [ ] 5. `packages/auth/src/server.ts`: magic-link hook re-send branch when `onboardingCompletedAt IS NULL`; export new functions from `index.ts` (+ check `exports` map) — Owner: `feature-integration` (plan §2)
- [ ] 6. Builder: `setPasswordRequest` schema, `set-password.action.ts` (public action), `set-password.tsx` form, `app/auth/set-password/page.tsx` — Owner: `feature-integration` (plan §4)
- [ ] 7. Builder: `create-platform-user.action.ts` → `requestPasswordSetup` instead of `signInMagicLink` (rollback preserved) — Owner: `feature-integration` (plan §5)
- [ ] 8. i18n: new `auth.*` keys in `messages/en.json` + `es.json` — Owner: `parent` (plan §6, invariant #7)
- [ ] 9. Tests: `packages/auth/__tests__/password-setup.test.ts`; update `create-platform-user.action.test.ts`; new `apps/builder/__tests__/set-password.action.test.ts` — Owner: `parent` (plan §7)
- [ ] 10. Docs: `docs/context/feature/onboarding-password-setup.md` — Owner: `parent` (plan §8)
- [ ] 11. Validate: `pnpm lint` + typecheck for touched workspaces + tests — Owner: `parent` (quality gate)
- [ ] 12. Present migration SQL for explicit approval before any `db:migrate` (if the user wants it applied) — Owner: `parent` (approval gate)
