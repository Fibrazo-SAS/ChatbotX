import { sysbrazoClientMultimediaService } from "@chatbotx.io/business"
import { getChildLogger } from "@chatbotx.io/logger"
import { distributedLock } from "@chatbotx.io/redis"

const log = getChildLogger("purge-sysbrazo-client-multimedia")
const LOCK_KEY = "schedule:purge-sysbrazo-client-multimedia"
const LOCK_TTL_SECONDS = 10 * 60

/**
 * Permanently removes only attachments already past their 30-day multimedia
 * retention. Every delete is naturally idempotent: a missing object or row is
 * safe, while a storage failure leaves the association for a later retry.
 */
export async function purgeSysbrazoClientMultimedia(): Promise<number> {
  return await distributedLock.runExclusive({
    key: LOCK_KEY,
    timeoutInSeconds: LOCK_TTL_SECONDS,
    fn: async () => {
      const due = await sysbrazoClientMultimediaService.listDueForPurge()
      let purged = 0

      for (const multimedia of due) {
        const deleted = await sysbrazoClientMultimediaService.permanentlyDelete(
          {
            multimediaId: multimedia.id,
            sysbrazoClientId: multimedia.sysbrazoClientId,
            workspaceId: multimedia.workspaceId,
          },
        )
        if (deleted) {
          purged += 1
        }
      }

      if (purged > 0) {
        log.info({ purged }, "Purged expired Sysbrazo client multimedia")
      }
      return purged
    },
  })
}
