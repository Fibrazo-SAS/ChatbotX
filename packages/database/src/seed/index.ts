import { createId } from "@chatbotx.io/utils"
import { db } from "../client"
import { userModel, workspaceMemberModel, workspaceModel } from "../schema"

async function main() {
  // Skip if a user already exists (idempotent seed)
  let user = await db.query.userModel.findFirst()
  if (user) {
    return
  }

  // Platform admin comes from PLATFORM_ADMIN_EMAIL — never a demo user
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL
  if (!adminEmail) {
    console.log("PLATFORM_ADMIN_EMAIL not set; skipping seed")
    return
  }

  // Create platform admin user (login via magic link / reset password)
  user = await db
    .insert(userModel)
    .values({
      email: adminEmail,
      name: "Platform Admin",
      emailVerified: true,
    })
    .returning()
    .then((result) => result[0])

  // Create workspace
  const workspacesCount = await db.$count(workspaceModel)
  if (workspacesCount === 0) {
    const workspace = await db
      .insert(workspaceModel)
      .values({
        id: createId(),
        ownerId: user?.id ?? "",
        name: "DEMO",
        timezone: "Asia/Saigon",
      })
      .returning()
      .then((result) => result[0])

    await db.insert(workspaceMemberModel).values({
      id: createId(),
      workspaceId: workspace?.id ?? "",
      userId: user?.id ?? "",
      role: "owner",
      permissions: {
        superAdmin: true,
        analytics: true,
        flows: true,
        contacts: true,
        onlyAssignedContacts: true,
        emailAndPhone: true,
        broadcast: true,
        ecommerce: true,
      },
    })
  }

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
