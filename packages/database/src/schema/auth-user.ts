import {
  type AnyPgColumn,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import {
  bigintAsString,
  ROOT_TENANT_ID,
  sharedColumns,
  timestampConfig,
} from "../partials/shared"
import { tenantModel } from "./enterprise/tenant"

export const userModel = pgTable(
  "User",
  {
    ...sharedColumns,
    name: text(),
    email: text().notNull(),
    emailVerified: boolean().default(false).notNull(),
    image: text(),
    isAnonymous: boolean().default(false).notNull(),
    mustChangePassword: boolean().default(false).notNull(),
    // Platform-operator console (/admin) access. The PLATFORM_ADMIN_EMAIL
    // account is always a super admin regardless of this flag (env backdoor);
    // this flag lets the platform admin grant console access to additional
    // users without touching the environment. Only the env admin can set it.
    isPlatformSuperAdmin: boolean().default(false).notNull(),
    // Soft-deactivation (platform admin /admin/users): when set, the user can
    // no longer create new auth sessions (see the session.create.before hook
    // in packages/auth) and existing sessions are revoked on deactivation.
    // NULL = active. Reactivation clears it.
    deactivatedAt: timestamp(timestampConfig),
    // Onboarding gate for newly created users (ticket 15137): NULL means the
    // user still has to set their password via the set-password link — they
    // only receive the set-password email, never a magic link. Backfilled to
    // `createdAt` for pre-existing users so the legacy magic-link flow keeps
    // working untouched for them.
    onboardingCompletedAt: timestamp(timestampConfig),
    // Single-use, 24h token for the initial password-setup link. Only the
    // SHA-256 hex digest is stored; the raw token goes out in the email.
    // NULL when no setup is pending.
    passwordSetupTokenHash: text(),
    passwordSetupTokenExpiresAt: timestamp(timestampConfig),
    // Tenant key for white-label isolation. Defaults to the root tenant (the
    // platform / main site). When it points at a reseller's `Tenant`, this row
    // is an end-customer (sub-account) isolated inside that tenant. Email is
    // unique *within* a tenant, never across tenants.
    tenantId: bigintAsString()
      .notNull()
      .default(ROOT_TENANT_ID)
      .references((): AnyPgColumn => tenantModel.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
  },
  (table) => [
    // Per-tenant email uniqueness: the same email may exist once per tenant
    // (platform or any reseller), all as fully isolated rows.
    uniqueIndex("User_email_tenant_key").on(table.email, table.tenantId),
    // O(1) lookup of a pending password-setup token by its hash. PostgreSQL
    // unique indexes allow multiple NULLs, so users without a pending setup
    // are unaffected.
    uniqueIndex("User_passwordSetupTokenHash_key").on(
      table.passwordSetupTokenHash,
    ),
    index("User_tenantId_idx").on(table.tenantId),
  ],
)
