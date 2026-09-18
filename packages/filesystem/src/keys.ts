import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const keys = () =>
  createEnv({
    server: {
      S3_ENDPOINT: z.url().optional(),
      // Public endpoint used to sign browser-facing presigned upload/download
      // URLs. `S3_ENDPOINT` is what the server-side S3 client connects to and
      // may be a Docker-internal host (e.g. `host.docker.internal`) that a
      // browser cannot resolve; set this to the public host so presigned URLs
      // are reachable from the client. Falls back to S3_ENDPOINT when unset.
      S3_PUBLIC_ENDPOINT: z.url().optional(),
      S3_ACCESS_KEY_ID: z.string().min(1).optional(),
      S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
      S3_REGION: z.string().min(1),
      S3_BUCKET: z.string().min(1),
    },
    runtimeEnv: process.env,
    skipValidation: process.env.SKIP_ENV_CHECK === "true",
  })

export const filesystemEnv = keys()
