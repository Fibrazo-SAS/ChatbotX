import { db, inArray, lt } from "@chatbotx.io/database/client"
import { auditLogModel } from "@chatbotx.io/database/schema"
import { getChildLogger } from "@chatbotx.io/logger"
import { AUDIT_LOG_RETENTION_DAYS } from "@chatbotx.io/worker-config"

const log = getChildLogger("purge-audit-logs")

/**
 * Deletes audit-log rows older than the retention window (default 90 days).
 * Bounded per run so a huge backlog cannot stall the schedule queue: each
 * execution removes at most one chunk and the daily cadence drains the rest.
 */
const MAX_ROWS_PER_RUN = 10_000

export async function purgeAuditLogs(): Promise<number> {
  const cutoff = new Date(
    Date.now() - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  )

  const ids = await db
    .select({ id: auditLogModel.id })
    .from(auditLogModel)
    .where(lt(auditLogModel.createdAt, cutoff))
    .limit(MAX_ROWS_PER_RUN)

  if (ids.length === 0) {
    return 0
  }

  await db.delete(auditLogModel).where(
    inArray(
      auditLogModel.id,
      ids.map((row) => row.id),
    ),
  )

  log.info(
    { deleted: ids.length, retentionDays: AUDIT_LOG_RETENTION_DAYS },
    "purgeAuditLogs: expired audit rows deleted",
  )

  return ids.length
}
