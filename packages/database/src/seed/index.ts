import { db } from "../client"
import { ROOT_TENANT_ID, tenantModel, userModel } from "../schema"

async function main() {
  // Ensure the root tenant (id = ROOT_TENANT_ID) exists — every default tenant FK
  // resolves to it. On a fresh/partial DB the migrations may not have left the row,
  // and the platform admin below would otherwise violate User_tenantId_Tenant_id_fkey.
  await db
    .insert(tenantModel)
    .values({ id: ROOT_TENANT_ID, status: "active" })
    .onConflictDoNothing()

  // Skip if a user already exists (idempotent seed)
  const existing = await db.query.userModel.findFirst()
  if (existing) {
    return
  }

  // Platform admin comes from PLATFORM_ADMIN_EMAIL — never a demo user
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL
  if (!adminEmail) {
    console.log("PLATFORM_ADMIN_EMAIL not set; skipping seed")
    return
  }

  // Create platform admin user (login via magic link / reset password).
  // No demo workspace/tenant: the admin creates their own workspace from the UI.
  await db
    .insert(userModel)
    .values({
      email: adminEmail,
      name: "Platform Admin",
      emailVerified: true,
    })
    .returning()
    .then((result) => result[0])

  return true
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
