# Plan: Onboarding flows — Initial password setup for new users (ticket 15137)

## Approach

Replace the magic-link onboarding email for **newly created platform users** with a dedicated **set-password email** that lands on a new `/auth/set-password` page. After setting the password, the user signs in with email + password. The magic-link flow stays byte-identical for every existing user.

The state machine is a new explicit flag on `User` (the ticket's `password_set`/`onboarding_completed` suggestion): `onboardingCompletedAt`. Existing users are **backfilled** in the migration (grandfathered → magic link keeps working); new users start with `NULL` (onboarding pending → only the set-password email can get them in).

**Decisions (resolving spec open questions Q1–Q6):**

1. **Q1 — "has password" signal**: explicit `onboardingCompletedAt` flag on `User` (not credential-`Account`-row inference). Rationale: legacy magic-link-only users have no credential row and must keep magic-link access; the flag distinguishes them (backfilled) from new pending users (`NULL`). Migration + backfill required.
2. **Q2 — token storage**: dedicated columns on `User` — `passwordSetupTokenHash` + `passwordSetupTokenExpiresAt` (24h, single-use, deleted on success), with a unique index on the hash for O(1) lookup. NOT the better-auth `oneTimeToken` plugin: avoids the `Verification`-table tenant caveat documented in `packages/auth/src/server.ts`, and the atomic claim (UPDATE … WHERE hash matches) gives single-use semantics for free.
3. **Q3 — password hashing**: `hashPassword` from `better-auth/crypto` + credential `Account` row `{ accountId: user.id, providerId: "credential", password: hash, userId, tenantId }` — the exact convention already shipped and tested in `packages/auth/src/provisioning.ts`. Verified in better-auth 1.6.22 `sign-in.mjs`: sign-in finds the credential row via `user.accounts`, so this convention verifies on `signIn.email`.
4. **Q4 — magic link requested by a pending user**: the tenant-scoped `sendMagicLink` hook (which already fetches the user) **re-sends the set-password email** instead of a magic link when `onboardingCompletedAt IS NULL`. This keeps onboarding mandatory (no bypass via magic link) and gives users a self-serve recovery path if they lose the original email. Existing users (backfilled) are unaffected. Mailbox-spam parity with today's magic-link behavior (a request already triggers an email).
5. **Q5 — admin "resend" action**: out of scope for v1 (the hook re-send in Q4 covers recovery). Follow-up if requested.
6. **Q6 — per-tenant custom email template**: v1 ships the default MJML template with tenant branding props (brandName/logo/url resolved per tenant, like every existing auth email). No new tenant-settings custom-template field in v1; follow-up if resellers ask.

## Changes

### 1. Schema + migration (`packages/database`)

- **`packages/database/src/schema/auth-user.ts`** — add to `userModel`:
  - `onboardingCompletedAt: timestamp(timestampConfig)` (nullable)
  - `passwordSetupTokenHash: text()` (nullable)
  - `passwordSetupTokenExpiresAt: timestamp(timestampConfig)` (nullable)
  - `uniqueIndex("User_passwordSetupTokenHash_key").on(table.passwordSetupTokenHash)`
  - Columns are NOT declared as better-auth `additionalFields` (no input/returned) — the hook/action read them via Drizzle directly; the better-auth drizzle adapter keeps working (it only writes the fields it knows).
- **Migration**: generate via `pnpm --filter @chatbotx.io/database make:migration set_password_onboarding`, then **review the SQL by hand** and add the backfill `UPDATE "User" SET "onboardingCompletedAt" = "createdAt"` (grandfather existing users). **Never auto-apply** `db:migrate` — wait for explicit approval (AGENTS.md).
- No `relations/index.ts` change (no new table — invariant #2 does not apply to added columns).

### 2. Auth domain logic (`packages/auth`)

- **`packages/auth/src/password-setup.ts`** (new, mirrors `provisioning.ts` style):
  - `requestPasswordSetup({ email, request })`:
    - Resolve `getPublicOriginFromRequest` + `getTenantSettings` + `resolveSmtpForTenant` (same triple as the existing hooks) — `blocked` SMTP ⇒ return (no send, same as today's hooks).
    - Find the user with the same tenant clauses as the magic-link hook (tenant + reseller-owner fallback). If not found → `APIError(400, "Your email is not registered…")` (parity with the magic-link hook).
    - Mint token: `crypto.randomBytes(32).toString("base64url")`; store `sha256(token)` + `expiresAt = now + 24h` on the user row.
    - Send `sendSetPassword` (new mail fn) with `setPasswordUrl = https://<origin>/auth/set-password?token=<token>` (hostname rewritten to the request's public origin — same pattern as the magic-link hook).
  - `completePasswordSetup({ token, password })`:
    - Find user by `passwordSetupTokenHash = sha256(token)`; fail with "invalid/expired link" if missing or expired.
    - Atomic claim: `UPDATE user SET emailVerified = true, onboardingCompletedAt = now(), passwordSetupTokenHash = NULL, passwordSetupTokenExpiresAt = NULL WHERE id = ? AND passwordSetupTokenHash = ?` — 0 rows affected ⇒ already used/race ⇒ generic "invalid link" error.
    - Hash password with `hashPassword`; create or update the credential `Account` row inside a transaction (insert mirrors `provisioning.ts`; defensive update if a credential row already exists).
    - Return the user id (or a neutral ok) — never leak account state.
- **`packages/auth/src/server.ts`** — magic-link hook: after the existing user lookup, add
  `if (user.onboardingCompletedAt === null) { await requestPasswordSetup({ email, request }); return }`
  before the current `sendMagicLink` branch. Everything else in the hook untouched.
- **`packages/auth/src/index.ts`** — export `requestPasswordSetup`, `completePasswordSetup` (+ check `package.json` `exports` map exposes the module).

### 3. Email (`packages/mail`)

- **`packages/mail/src/emails/set-password.ts`** (new) — MJML builder mirroring `sign-in-magic-link.ts`: `userName`, `setPasswordUrl`, `brandName`, `brandLogoUrl`, `brandUrl`.
- **`packages/mail/src/emails/default-templates.ts`** — add `DEFAULT_SET_PASSWORD_SUBJECT` + `DEFAULT_SET_PASSWORD_TEMPLATE`.
- **`packages/mail/src/index.ts`** — add `sendSetPassword(email, props, transport?)` mirroring `sendMagicLink` (incl. custom-template support, unused in v1).
- **`packages/mail/src/preview.ts`** — add a set-password preview entry (optional, nice for QA).

### 4. Builder — page + action

- **`apps/builder/src/features/auth/schema/action.ts`** — add `setPasswordRequest = z.object({ token: z.string(), newPassword: z.string().min(8).max(100), passwordConfirmation: … }).refine(match)` (same shape as `resetPasswordRequest`).
- **`apps/builder/src/features/auth/actions/set-password.action.ts`** (new, `"use server"`) — `actionClient` (public; not `authActionClient`). Reads `token` from form input (no session, no `tenantId` from client — invariant #10). Calls `completePasswordSetup`, maps `ChatbotXException` to a translated toast via the safe-action error handler; returns ok on success.
- **`apps/builder/src/features/auth/set-password.tsx`** (new client component) — mirrors `reset-password.tsx`: form with new password + confirmation, token as hidden/state field from `useSearchParams`, success → `toast.success` + `redirect("/auth/sign-in")`, error → translated toast. Expired/invalid token → friendly message + button back to sign-in (the action surfaces a specific code).
- **`apps/builder/src/app/auth/set-password/page.tsx`** (new) — server component in the auth layout, like `sign-up/page.tsx`. `/auth` is already a public route prefix in `apps/builder/src/proxy.ts` (verified — no proxy change).

### 5. Builder — creation action

- **`apps/builder/src/features/users/actions/create-platform-user.action.ts`** — replace `auth.api.signInMagicLink({…})` with `requestPasswordSetup({ email: user.email, request })` (imported from `@chatbotx.io/auth`). Keep the existing rollback (`userService.deleteUnverifiedPlatformUser`) on send failure, and the optional membership step unchanged.

### 6. i18n

- **`apps/builder/messages/en.json`** (+ `es.json` mirror, other locales fall back to English per convention):
  - `auth.setPasswordTitle`, `auth.setPasswordDescription`, `auth.setPasswordSuccess`, `auth.setPasswordLinkInvalid`, `auth.setPasswordLinkExpired`, `auth.requestNewLink` (if needed).
- Email subject lives in the mail package (not the UI dictionary), like all other auth emails.

### 7. Tests

- **`packages/auth/__tests__/password-setup.test.ts`** (new, mocking style of `provisioning.test.ts`):
  - request: mints token (hashed at rest), sends email with correct URL + tenant branding, resolves tenant SMTP, blocked-SMTP no-op, unknown email → 400.
  - complete: happy path (verified + completed + account row with credential hash + token cleared), expired token, wrong token, token reuse (second call fails), atomic race (two concurrent claims — one wins).
  - hook: pending user gets set-password email (not magic link); backfilled user still gets magic link.
- **`apps/builder/__tests__/create-platform-user.action.test.ts`** — update mock from `signInMagicLink` to `requestPasswordSetup`; assert send failure still rolls back the unverified row.
- **`apps/builder/__tests__/set-password.action.test.ts`** (new) — success path, invalid token surfaced as translated error, no auth required.
- Verification gate: `pnpm lint` + typecheck for touched workspaces + `pnpm test` (per `.agents/skills/testing-workflow`).

### 8. Docs

- **`docs/context/feature/onboarding-password-setup.md`** (new) — new-user onboarding flow (creation → set-password email → first login), token rules (hashed at rest, 24h, single-use), backfill rationale, and coexistence with the magic-link flow.

## Files affected

| File | Change |
|---|---|
| `packages/database/src/schema/auth-user.ts` | 3 new columns + unique token-hash index |
| `packages/database/drizzle/<migration>.sql` | generated, **manually reviewed** (backfill included), not auto-applied |
| `packages/auth/src/password-setup.ts` | new: request + complete password setup |
| `packages/auth/src/server.ts` | magic-link hook: pending-onboarding re-send branch |
| `packages/auth/src/index.ts` | export new functions (verify `exports` map) |
| `packages/mail/src/emails/set-password.ts` | new MJML template |
| `packages/mail/src/emails/default-templates.ts` | default subject/template |
| `packages/mail/src/index.ts` | `sendSetPassword` |
| `packages/mail/src/preview.ts` | preview entry |
| `apps/builder/src/features/auth/schema/action.ts` | `setPasswordRequest` |
| `apps/builder/src/features/auth/actions/set-password.action.ts` | new public server action |
| `apps/builder/src/features/auth/set-password.tsx` | new form component |
| `apps/builder/src/app/auth/set-password/page.tsx` | new page |
| `apps/builder/src/features/users/actions/create-platform-user.action.ts` | send set-password email instead of magic link |
| `apps/builder/messages/en.json`, `es.json` | new auth keys |
| `packages/auth/__tests__/password-setup.test.ts` | new tests |
| `apps/builder/__tests__/create-platform-user.action.test.ts` | update mocks/asserts |
| `apps/builder/__tests__/set-password.action.test.ts` | new tests |
| `docs/context/feature/onboarding-password-setup.md` | new doc |

## Risk assessment

**Medium.** Auth touchpoints are shared and tenant-scoped (white-label), so correctness matters, but the surface is narrow:

- **Magic-link regression** is the ticket's top constraint: the hook change is a single additive branch gated on `onboardingCompletedAt IS NULL` — backfilled users take the exact old path. Covered by tests.
- **Migration** is additive (nullable columns + one index) with a backfill `UPDATE`; no destructive change. Not auto-applied.
- **Token security**: hashed at rest, 24h expiry, single-use atomic claim, unique index, timing-safe compare — mirrors the security posture of the existing reset-password flow, reviewed per `.agents/skills/security-review`.
- **Tenant isolation**: token lives on the user row (per-tenant unique email), so no cross-tenant replay; the page accepts no `tenantId` input; the email resolves tenant settings exactly like the existing hooks.
- **Rollback path** in `createPlatformUserAction` preserved: a failed set-password email still removes the unverified row.

## Approval gates

- **Plan approval required before coding** (explicit "ok"/"aprobado"/"approved").
- **Migration**: generate + review SQL, present for explicit approval before applying — `db:migrate` is never run automatically.
- **No changes** to: `/api/auth/magic-link/verify`, the magic-link email template, `sendMagicLink`'s send path for verified users, social sign-in, invitations, or public sign-up.
