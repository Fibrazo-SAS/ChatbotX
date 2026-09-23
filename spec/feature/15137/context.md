# Context: Onboarding flows — Initial password setup for new users (ticket 15137)

## Summary

Implemented the new-user onboarding flow: platform-created users now receive a
dedicated 24h "set password" email (link → `/auth/set-password`) instead of a
sign-in magic link. After setting their password they sign in with
email + password. Existing users are untouched: the migration backfills
`onboardingCompletedAt = createdAt`, so they keep the legacy magic-link path
byte-for-byte. The magic-link hook gained a single additive branch that
re-sends the set-password email to onboarding-pending users (keeps onboarding
mandatory and serves as the recovery path).

Everything in the plan was implemented as written. No deviations from the
approved decisions (Q1 flag + backfill, Q2 hashed token columns, Q3 better-auth
`hashPassword` + credential Account row, Q4 hook re-send, Q5 no admin resend in
v1, Q6 default template only).

## Files changed

- `packages/database/src/schema/auth-user.ts` — 3 columns + unique token-hash index.
- `packages/database/drizzle/20260921200355_set_password_onboarding/migration.sql` — generated + backfill, **reviewed, NOT applied**.
- `packages/auth/src/password-setup.ts` (new) — `requestPasswordSetup` / `completePasswordSetup`.
- `packages/auth/src/tenant-email.ts` (new) — extracted `getTenantSettings` + `resolveSmtpForTenant` (avoids circular import).
- `packages/auth/src/server.ts` — imports refactor + magic-link hook pending-onboarding branch.
- `packages/auth/package.json` — `./password-setup` export.
- `packages/mail/src/emails/set-password.ts` (new) + `default-templates.ts` + `index.ts` — `sendSetPassword` + defaults.
- `apps/builder/src/features/auth/schema/action.ts` — `setPasswordRequest`.
- `apps/builder/src/features/auth/actions/set-password.action.ts` (new) — public action.
- `apps/builder/src/features/auth/set-password.tsx` (new) — form.
- `apps/builder/src/app/auth/set-password/page.tsx` (new) — route (public via existing `/auth` prefix).
- `apps/builder/src/features/users/actions/create-platform-user.action.ts` — requests set-password email; rollback preserved.
- `apps/builder/src/lib/auth/utils.ts` — `SessionUser` omits the 3 internal columns.
- `apps/builder/messages/*.json` — 4 new `auth.*` keys (en + es translated, other locales English fallback per convention).
- `packages/auth/__tests__/password-setup.test.ts` (new), `apps/builder/__tests__/set-password.action.test.ts` (new), `apps/builder/__tests__/create-platform-user.action.test.ts` (updated).
- `docs/context/feature/onboarding-password-setup.md` (new).

## Tests run

- `pnpm --filter @chatbotx.io/auth test` — 55 passed (7 files).
- Builder: `set-password.action.test.ts` + `create-platform-user.action.test.ts` — 8 passed.
- Builder full suite: 2358 passed; the only failures are 3 **pre-existing**
  `broadcasts-calendar.test.tsx` failures (verified identical on clean HEAD).
- `check-types`: `@chatbotx.io/database`, `@chatbotx.io/mail`, `@chatbotx.io/auth`, `builder` — all clean.
- `ultracite check` — clean on all 16 touched files.

## Deviations

- **Email template:** decided after first manual QA to **reuse the existing
  sign-up email-verification template** (`sendSignUpVerification`,
  `signupEmailTemplate` custom template respected) instead of shipping a new
  dedicated set-password template — the platform already brands that one.
  `packages/mail` set-password additions were removed accordingly. Q6 in the
  plan is therefore moot.
- (Note: `docker-compose.yml` and `AGENTS.md` carry pre-existing local
  modifications by the user that were left untouched.)

## Next steps / blockers

- **Blocker:** migration `20260921200355_set_password_onboarding` is generated
  and reviewed but **not applied** — awaiting explicit user approval to run
  `pnpm --filter @chatbotx.io/database db:migrate` (never auto-applied per
  AGENTS.md).
- Optional follow-ups (explicitly out of v1): per-tenant custom set-password
  email template; "resend link" action in the admin console; mail preview
  entry in `packages/mail/src/preview.ts`.

## How to test

1. Apply the migration (after approval).
2. `/admin/users` → create a user → they receive the set-password email
   (MailHog locally) with a link to `/auth/set-password?token=…`.
3. Open the link → set a password → redirected to `/auth/sign-in` → sign in
   with email + password.
4. Regression: an existing user requests a magic link from `/auth/sign-in` and
   signs in through the link exactly as before.
5. Edge: while onboarding is pending, requesting a magic link for that email
   re-sends the set-password email instead.
