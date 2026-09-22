import {
  platformCredentialService,
  resolveTenantSettingsByDomain,
} from "@chatbotx.io/business"
import { ROOT_TENANT_ID } from "@chatbotx.io/database/schema"
import type { SmtpTransportOptions } from "@chatbotx.io/mail/transport"
import { logger } from "./logger"
import { getTenantId, resolveTenantOwnerId } from "./tenant-context"

export type SmtpResolution =
  | { kind: "default" }
  | {
      kind: "transport"
      transport: SmtpTransportOptions & {
        fromEmail: string
        fromName?: string
      }
    }
  | { kind: "blocked" }

/**
 * Resolve the white-label tenant settings (brand, email templates) for the
 * domain a request came in on. The middleware stamps the bound domain into
 * `x-domain`; empty string falls back to the platform's own settings.
 */
export const getTenantSettings = async (request: Request) => {
  const domain = request.headers.get("x-domain") ?? ""
  return await resolveTenantSettingsByDomain(domain)
}

/**
 * Which SMTP an auth/transactional email must go out through:
 * - the platform's own tenant (root, self-hosted) always uses the default
 *   SMTP from the environment (e.g. MailHog in local dev);
 * - a white-label reseller with an SMTP credential uses their own transport;
 * - a reseller WITHOUT a credential gets `blocked` — auth emails are skipped
 *   rather than leaking the platform sender. Never blocks the platform itself.
 */
export const resolveSmtpForTenant = async (): Promise<SmtpResolution> => {
  const tenantId = getTenantId()
  const ownerId = await resolveTenantOwnerId(tenantId)
  if (!ownerId || tenantId === ROOT_TENANT_ID) {
    return { kind: "default" }
  }

  const smtp = await platformCredentialService.findDecryptedForUser({
    userId: ownerId,
    type: "smtp",
  })
  if (!smtp) {
    logger.warn(
      { tenantId, ownerId },
      "Reseller has no SMTP credential configured; skipping auth email send",
    )
    return { kind: "blocked" }
  }

  return {
    kind: "transport",
    transport: {
      host: smtp.config.host,
      port: smtp.config.port,
      username: smtp.config.username,
      password: smtp.config.password,
      fromEmail: smtp.config.fromEmail,
      fromName: smtp.config.fromName,
    },
  }
}
