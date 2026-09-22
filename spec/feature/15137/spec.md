# Specification: Onboarding flows — Initial password setup for new users

## Ticket
- **URL**: Redmine issue #15137 (project: Sysbrazo) — "Chatbox: Flujos de onboarding - Configuración inicial de contraseña para usuarios nuevos"
- **Tracker**: Feature
- **Priority**: High
- **Complexity**: Medium
- **Goal**: Keep the existing magic-link login flow working exactly as today for existing users. When a **new user** is created in the platform, send them a dedicated, short-lived "set your password" link instead of a sign-in magic link. After setting the password, the user signs in normally with email + password.

## Problem

Today, the only platform path that creates a brand-new user account is the platform-admin console (`/admin/users` → `createPlatformUserAction`). It creates the `User` row unverified (`emailVerified=false`) and immediately triggers better-auth's `signInMagicLink`, which emails a magic link. The first "login" happens by clicking that link, which auto-verifies the account and creates a session — the user never defines credentials.

This onboarding flow must change: the creation email should carry a dedicated **set-password** link (short expiry, e.g. 24h) that lands on a new screen where the user defines their password for the first time. After that, they log in with email + password. The magic-link flow must keep working untouched for users who already have an account.

## Current state (verified in code)

**Auth stack** — better-auth, configured in `packages/auth/src/server.ts`:
- Plugins: `magicLink`, `oneTimeToken`, `bearer`, `anonymous`, `nextCookies`.
- `emailAndPassword` enabled with `disableSignup: true` and `requireEmailVerification: true` (public sign-up was disabled by ticket 14997; new accounts come from the platform admin).
- The `magicLink` plugin's `sendMagicLink` hook is tenant-scoped (white-label brand, per-tenant SMTP resolution via `resolveSmtpForTenant`, custom tenant template `magicLinkEmailTemplate`) and **rejects emails with no `User` row** ("Your email is not registered…").

**User creation path** — `apps/builder/src/features/users/actions/create-platform-user.action.ts`:
1. `userService.createPlatformUser({ email, name })` → inserts unverified `User` (root tenant).
2. Optional immediate workspace membership via `workspaceMemberService.addMemberForPlatformAdmin`.
3. `auth.api.signInMagicLink({ body: { email } })` → better-auth stores a `Verification` token and the tenant-scoped hook emails the magic link.
4. On email failure, rolls back the unverified row (`userService.deleteUnverifiedPlatformUser`).

**Schema** — `packages/database/src/schema/auth-user.ts`:
- `User`: `emailVerified`, `mustChangePassword`, `isAnonymous`, `isPlatformSuperAdmin`, `deactivatedAt`, `tenantId` (per-tenant email uniqueness `User_email_tenant_key`).
- `Account` (`auth-account.ts`): has `password: text()` — better-auth's credential row for email+password; today only created by the (disabled) sign-up flow.
- There is **no** `passwordSet`/`onboardingCompleted` flag yet — the ticket's dependency list suggests adding one.

**Email package** — `packages/mail/src/index.ts`:
- `sendMagicLink`, `sendResetPassword`, `sendSignUpVerification`, `sendAccountCredentials` — each has a default MJML template, `{{var}}` substitution, and per-tenant custom-template override.
- Per-tenant email templates are resolved in `packages/auth/src/server.ts` from the tenant settings (`magicLinkEmailTemplate`, `signupEmailTemplate`, `forgotPasswordEmailTemplate`); a new flow will likely need its own (e.g. `setPasswordEmailTemplate`).

**Closest structural precedent** — the reset-password flow (`/auth/forgot-password` → `sendResetPassword` hook → `/auth/reset-password` page + `resetPasswordRequest` schema) is the model to mirror for the new set-password page: token in URL, form with new password + confirmation, then sign-in.

**Invitations** — `inviteWorkspaceMemberAction` creates a shareable code (no email sent); `acceptInvitationAction` requires an already-authenticated user. Not a user-creation path and out of scope.

## Acceptance Criteria

- [ ] A newly created platform user receives a **set-password email** (new template + subject) with a link to a new `/auth/set-password` page — never a sign-in magic link.
- [ ] The set-password link carries a single-use, expiring token (24h). Expired/used/invalid tokens show a friendly, translated error with a path back to sign-in.
- [ ] The set-password page validates password strength (min 8 chars, confirmation match — consistent with existing `emailPasswordSignUpRequest`) and submits via a server action.
- [ ] On successful set: the password is stored hashed in the credential `Account` row (same hashing better-auth uses for email+password sign-in, so login works), `emailVerified` becomes `true`, and the token is consumed/invalidated.
- [ ] After set-up, the user can sign in with email + password via the existing sign-in form; the flow is forced/guided for the first login (onboarding is mandatory on first entry).
- [ ] Existing users keep the magic-link flow byte-for-byte: no change to `/api/auth/magic-link/verify`, the `sendMagicLink` hook, or the magic-link email template.
- [ ] Users who already set a password (or social-only users) never receive a set-password email through any path.
- [ ] Email sending respects white-label tenancy exactly like the existing hooks: tenant brand, per-tenant SMTP resolution, hostname rewrite to the public origin, `blocked` SMTP handling.
- [ ] Regression tests: existing `create-platform-user.action.test.ts` updated; new tests cover token expiry, reuse, wrong-tenant/email mismatch, and that magic link still works for existing users.
- [ ] `pnpm lint` + typecheck + tests pass; no new direct `db` import in the app layer.

## Design decisions (proposed here, finalized in `plan.md`)

1. **Trigger point**: only `createPlatformUserAction` (the single "user just created" event in this edition). The magic-link hook and social flows stay untouched.
2. **"Has password" source of truth**: an explicit flag on `User` (e.g. `passwordSetAt: timestamp | null` — the ticket's `password_set` suggestion) vs. existence of a credential `Account` row. Preference: **flag on `User`** — cheap to index/query in the magic-link hook and admin console, and unambiguous for accounts created before this feature (all of them get `NULL` and keep magic links). Final call in plan.md; either way needs a migration + `relations/index.ts` updates.
3. **Token mechanism**: better-auth's `oneTimeToken` plugin (already enabled) vs. a dedicated column. The `Verification`-table caveat documented in `server.ts` (tokens carry no tenant) applies to both; the set-password link will validate email + token + expiry server-side. Final call in plan.md.
4. **Edge case — magic link requested by a password-less new user**: request must NOT silently verify them. Options: (a) the magic-link sign-in hook returns the generic "not registered" error for users without a password; (b) it sends the set-password link instead. Preference: **(a) generic error** (avoids leaking account state; simplest; matches existing behavior for unknown emails). Final call in plan.md.
5. **Password hashing**: reuse better-auth's internal hash so `signIn.email` verifies correctly (no custom hash). Verify exact API (`better-auth` hash utils vs. an internal `auth.api` path) in plan.md.
6. **Resend capability**: out of scope for v1 unless trivial (admin can already recreate; unverified rows are rolled back only on send failure). Noted as open question.

## Out of scope / non-goals

- Any change to the magic-link flow, its templates, or `/api/auth/magic-link/verify`.
- Social sign-in (Google/Facebook) behavior — social-created users are unaffected.
- Invitations (`inviteWorkspaceMemberAction` / `acceptInvitationAction`) — not a user-creation path today.
- Public sign-up re-enablement (ticket 14997 territory).

## Open questions (answer in `plan.md`)

- Q1: Flag on `User` vs. credential `Account` row as the "has password" signal?
- Q2: `oneTimeToken` plugin vs. dedicated token column for the set-password link?
- Q3: Exact better-auth API for creating the credential `Account` row with the right hash (server-side, without a session)?
- Q4: Should requesting a magic link for a password-less user send the set-password email instead of erroring?
- Q5: Should the admin console get a "resend set-password link" action in v1?
- Q6: Does the tenant-settings surface need a new `setPasswordEmailTemplate` custom template, or reuse an existing one for v1?

## Skills & Rules

Load these skills:
- `.agents/skills/security-review` (auth token handling, password hashing, expiry, tenant isolation)
- `.agents/skills/business-data-access` (service-layer access; no new direct `db` in app layer — invariant #9)
- `.agents/skills/builder-ui-i18n` (new auth page/form + translation keys — invariant #7)
- `.agents/skills/drizzle-database` (only if a `User` column / migration lands)
- `.agents/skills/testing-workflow` (verification gate)

Rules to follow:
- Never run/apply `db:migrate` automatically — generate and inspect the SQL, wait for explicit approval (AGENTS.md).
- White-label tenancy (invariant #10/#18): the set-password email must resolve brand/SMTP/host per tenant like the existing hooks (`getTenantSettings`, `resolveSmtpForTenant`, hostname rewrite), and must never accept `tenantId` from client input.
- Magic-link regression (ticket requirement): the existing hooks, templates and verify route must remain byte-identical.
- i18n (invariant #7): every user-facing string via `useTranslations()`; add keys to `apps/builder/messages/en.json`.
- No dynamic `import()` in `packages/*` (allowed in `apps/builder`).

## Docs to Update

- `docs/context/feature/onboarding-password-setup.md` (new) — the new-user onboarding flow: creation → set-password email → first login, token rules, and how it coexists with the magic-link flow.
