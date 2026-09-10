import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const keys = () =>
  createEnv({
    server: {
      SMTP_SERVER: z
        .url()
        .min(1)
        .default("smtp://username:password@localhost:1025"),
      // Optional fallback relay used only if the primary SMTP fails (mirrors
      // the sysbrazo MAIL_FALLBACK_* behavior: primary relay -> Gmail backup).
      SMTP_FALLBACK_SERVER: z.url().optional(),
      SMTP_FROM: z.string().min(1),
    },
    runtimeEnv: {
      SMTP_SERVER:
        process.env.SMTP_SERVER || "smtp://username:password@localhost:1025",
      SMTP_FALLBACK_SERVER: process.env.SMTP_FALLBACK_SERVER,
      SMTP_FROM: process.env.SMTP_FROM,
    },
    skipValidation: process.env.SKIP_ENV_CHECK === "true",
  })

export const mailEnv = keys()
