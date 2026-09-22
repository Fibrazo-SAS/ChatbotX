# Onboarding: initial password setup for new users

> Ticket: #15137 (Sysbrazo) — implemented 2026-09.

## Flow

When the platform admin creates a new user (`/admin/users` →
`createPlatformUserAction`), the user **no longer receives a sign-in magic
link**. Instead they get a dedicated **set-password email** with a link to
`/auth/set-password?token=…`, where they define their password for the first
time. Setting the password:

1. verifies their email (`User.emailVerified = true`),
2. stamps `User.onboardingCompletedAt`,
3. creates/updates their credential `Account` row (`providerId: "credential"`,
   hashed with better-auth's own `hashPassword` — same convention as
   `packages/auth/src/provisioning.ts`),
4. consumes the token.

From then on they sign in normally with email + password. The magic-link flow
is **unchanged for every existing user** (they were backfilled to
`onboardingCompletedAt = createdAt` by the migration, so they keep the legacy
magic-link path byte-for-byte).

## Onboarding gate

`User.onboardingCompletedAt IS NULL` ⇔ onboarding pending. The magic-link
hook in `packages/auth/src/server.ts` checks it after resolving the user:
pending users get the set-password email **re-sent** instead of a magic link
(which would verify them without credentials and skip onboarding). This is
also their self-serve recovery path if they lost the original email.

## Token rules

- 32 random bytes (`base64url`), stored only as a SHA-256 hex digest in
  `User.passwordSetupTokenHash` (unique index `User_passwordSetupTokenHash_key`).
- Single-use: `completePasswordSetup` claims the row with an
  `UPDATE … WHERE passwordSetupTokenHash = <hash>` — a double submit or replay
  loses the race and reports the same generic "invalid link" error.
- Expiry: 24h (`passwordSetupTokenExpiresAt`).
- The token is looked up by hash, so no tenant context is needed on the setup
  page — unguessable and per-user, tenant-safe by construction. The page
  accepts no `tenantId` or email input.

## Email

Reuses the existing **sign-up email-verification template**
(`packages/mail` → `sendSignUpVerification` / `SIGNUP_BODY_MJML`,
`DEFAULT_SIGNUP_SUBJECT` = "Verify your email address"), so a tenant's
configured `signupEmailTemplate` custom copy/branding applies automatically.
The `verificationUrl` points at `/auth/set-password?token=…`. Sent with the
same tenant resolution as the other auth emails: brand + logo + public origin
from the request, per-tenant SMTP (`resolveSmtpForTenant`), blocked-SMTP
no-op. No dedicated set-password template exists.

## Schema

| Column | Type | Purpose |
|---|---|---|
| `onboardingCompletedAt` | timestamptz, nullable | `NULL` = onboarding pending; backfilled to `createdAt` for pre-existing users |
| `passwordSetupTokenHash` | text, nullable | SHA-256 of the pending token (unique index) |
| `passwordSetupTokenExpiresAt` | timestamptz, nullable | 24h expiry |

None of the three is exposed through better-auth's session payload
(`SessionUser` omits them in `apps/builder/src/lib/auth/utils.ts`).

## Key files

- `packages/auth/src/password-setup.ts` — `requestPasswordSetup` (mint token +
  send the verification-template email with the set-password link) and
  `completePasswordSetup` (verify, set password, complete onboarding).
  Exported as `@chatbotx.io/auth/password-setup`.
- `packages/auth/src/tenant-email.ts` — `getTenantSettings` +
  `resolveSmtpForTenant` (extracted from `server.ts` to avoid a circular
  import).
- `packages/auth/src/server.ts` — magic-link hook: pending-onboarding branch.
- `apps/builder/src/features/auth/…` — `set-password.tsx` page/form +
  `actions/set-password.action.ts` (public action, no session).
- `apps/builder/src/features/users/actions/create-platform-user.action.ts` —
  creation path now requests the set-password email; rollback of the
  unverified row on send failure is preserved.
