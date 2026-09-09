import { and, db, eq } from "@chatbotx.io/database/client"
import { sessionModel, userModel } from "@chatbotx.io/database/schema"
import type { UserModel } from "@chatbotx.io/database/types"
import { BaseService } from "../base.service"
import { tenantService } from "../enterprise/tenant/service"
import {
  ChatbotXException,
  forbiddenException,
  notFoundException,
} from "../errors"
import { isSuperAdmin } from "./utils"

class UserService extends BaseService {
  /**
   * Clear the forced-password-change gate for a user. Called server-side ONLY
   * after better-auth has verified the current password and applied the change —
   * never expose a standalone "clear the flag" path to clients, or a provisioned
   * account could keep its temporary password.
   */
  async clearMustChangePassword(userId: string): Promise<void> {
    await db
      .update(userModel)
      .set({ mustChangePassword: false })
      .where(eq(userModel.id, userId))
  }

  async findByIdOrFail(userId: string): Promise<UserModel> {
    const user = await db.query.userModel.findFirst({ where: { id: userId } })
    if (!user) {
      throw notFoundException("User not found")
    }
    return user
  }

  /**
   * Platform-level user creation for the super-admin console (/admin/users).
   *
   * Creates the account unverified (`emailVerified=false`); the super admin
   * action then sends a better-auth magic link and the user is verified when
   * they use it. Emails are unique per tenant — platform users live in the
   * root tenant via the column default, so the plain email lookup is correct
   * for this flow.
   */
  async createPlatformUser(props: {
    email: string
    name?: string | null
  }): Promise<UserModel> {
    const email = props.email.trim().toLowerCase()
    const existing = await db.query.userModel.findFirst({
      where: { email },
    })
    if (existing) {
      throw new ChatbotXException(`A user with email ${email} already exists`)
    }

    const [user] = await db
      .insert(userModel)
      .values({
        email,
        name: props.name?.trim() || null,
        emailVerified: false,
      })
      .returning()

    return user
  }

  /**
   * Platform-admin deactivation (/admin/users): the user can no longer create
   * new auth sessions (blocked by the `session.create.before` hook in
   * packages/auth) and all existing sessions are revoked immediately, so the
   * change takes effect on their next request anywhere (builder + realtime).
   * Data is never deleted — reactivation fully restores access.
   */
  /**
   * Grant/revoke /admin console access. Guards:
   *  • only the env PLATFORM_ADMIN_EMAIL admin may call this (checked by the
   *    action; re-asserted here so no other path can flip the flag),
   *  • the env admin's own flag can never be revoked (their access comes from
   *    the env anyway, but the flag must not silently diverge),
   *  • an active reseller owner can never be promoted — they would see every
   *    tenant's users/workspaces, breaking white-label isolation.
   */
  async setPlatformSuperAdmin(props: {
    userId: string
    value: boolean
    actorIsEnvAdmin: boolean
  }): Promise<void> {
    if (!props.actorIsEnvAdmin) {
      throw forbiddenException(
        "Only the platform admin account can grant or revoke platform super admin",
      )
    }
    const user = await this.findByIdOrFail(props.userId)
    if (isSuperAdmin(user) && !props.value) {
      throw forbiddenException(
        "The PLATFORM_ADMIN_EMAIL account cannot lose platform super admin",
      )
    }
    const ownedTenant = await tenantService.findByOwner(user.id)
    if (props.value && ownedTenant?.status === "active") {
      throw forbiddenException(
        "A reseller owner cannot be promoted to platform super admin",
      )
    }

    await db
      .update(userModel)
      .set({ isPlatformSuperAdmin: props.value })
      .where(eq(userModel.id, props.userId))
  }

  async deactivatePlatformUser(userId: string): Promise<void> {
    const user = await this.findByIdOrFail(userId)
    if (isSuperAdmin(user)) {
      // The PLATFORM_ADMIN_EMAIL account is the platform's recovery anchor:
      // deactivating it would lock the /admin console with no one left to
      // unlock it (and the flag-based promoted admins can't re-grant).
      throw new ChatbotXException(
        "The platform super admin cannot be deactivated",
      )
    }

    await db
      .update(userModel)
      .set({ deactivatedAt: new Date() })
      .where(eq(userModel.id, userId))
    await db.delete(sessionModel).where(eq(sessionModel.userId, userId))
  }

  async reactivatePlatformUser(userId: string): Promise<void> {
    await db
      .update(userModel)
      .set({ deactivatedAt: null })
      .where(eq(userModel.id, userId))
  }

  /**
   * Remove an UNVERIFIED platform user (rollback of createPlatformUser when
   * the sign-in email fails). Guarded by `emailVerified=false` so a verified
   * account can never be deleted through this path.
   */
  async deleteUnverifiedPlatformUser(userId: string): Promise<void> {
    await db
      .delete(userModel)
      .where(and(eq(userModel.id, userId), eq(userModel.emailVerified, false)))
  }
}

export const userService = new UserService()
