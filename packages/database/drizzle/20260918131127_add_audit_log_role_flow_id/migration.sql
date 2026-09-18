ALTER TABLE "AuditLog" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "AuditLog" ADD COLUMN "flowId" bigint;--> statement-breakpoint
CREATE INDEX "AuditLog_flowId_createdAt_id_idx" ON "AuditLog" ("flowId","createdAt" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "flowId" IS NOT NULL;