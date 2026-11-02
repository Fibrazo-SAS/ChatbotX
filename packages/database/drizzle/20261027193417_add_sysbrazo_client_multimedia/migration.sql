CREATE TABLE "ConversationSysbrazoClientContext" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"workspaceId" bigint NOT NULL,
	"conversationId" bigint NOT NULL,
	"sysbrazoClientId" text NOT NULL,
	"documentId" text NOT NULL,
	"activatedAt" timestamp(6) with time zone NOT NULL,
	"expiresAt" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SysbrazoClientMultimedia" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"workspaceId" bigint NOT NULL,
	"sysbrazoClientId" text NOT NULL,
	"attachmentId" bigint NOT NULL,
	"attachmentCreatedAt" timestamp(6) with time zone NOT NULL,
	"messageId" bigint NOT NULL,
	"messageCreatedAt" timestamp(6) with time zone NOT NULL,
	"conversationId" bigint NOT NULL,
	"sourceContactId" bigint NOT NULL,
	"documentIdSnapshot" text NOT NULL,
	"deletedAt" timestamp(6) with time zone,
	"deletedBy" bigint,
	"purgeAt" timestamp(6) with time zone
);
--> statement-breakpoint
CREATE TABLE "SysbrazoClientMultimediaRead" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"workspaceId" bigint NOT NULL,
	"multimediaId" bigint NOT NULL,
	"userId" bigint NOT NULL,
	"readAt" timestamp(6) with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ConversationSysbrazoClientContext_workspace_conversation_key" ON "ConversationSysbrazoClientContext" ("workspaceId","conversationId");--> statement-breakpoint
CREATE INDEX "ConversationSysbrazoClientContext_workspace_conversation_expires_idx" ON "ConversationSysbrazoClientContext" ("workspaceId","conversationId","expiresAt");--> statement-breakpoint
CREATE UNIQUE INDEX "SysbrazoClientMultimedia_attachment_key" ON "SysbrazoClientMultimedia" ("workspaceId","attachmentId","attachmentCreatedAt");--> statement-breakpoint
CREATE INDEX "SysbrazoClientMultimedia_client_history_idx" ON "SysbrazoClientMultimedia" ("workspaceId","sysbrazoClientId","deletedAt","createdAt");--> statement-breakpoint
CREATE INDEX "SysbrazoClientMultimedia_due_purge_idx" ON "SysbrazoClientMultimedia" ("purgeAt") WHERE "purgeAt" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "SysbrazoClientMultimediaRead_multimedia_user_key" ON "SysbrazoClientMultimediaRead" ("multimediaId","userId");--> statement-breakpoint
CREATE INDEX "SysbrazoClientMultimediaRead_workspace_user_idx" ON "SysbrazoClientMultimediaRead" ("workspaceId","userId");--> statement-breakpoint
ALTER TABLE "ConversationSysbrazoClientContext" ADD CONSTRAINT "ConversationSysbrazoClientContext_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "ConversationSysbrazoClientContext" ADD CONSTRAINT "ConversationSysbrazoClientContext_7bOkR1BW6mlx_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SysbrazoClientMultimedia" ADD CONSTRAINT "SysbrazoClientMultimedia_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SysbrazoClientMultimedia" ADD CONSTRAINT "SysbrazoClientMultimedia_conversationId_Conversation_id_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SysbrazoClientMultimedia" ADD CONSTRAINT "SysbrazoClientMultimedia_sourceContactId_Contact_id_fkey" FOREIGN KEY ("sourceContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SysbrazoClientMultimedia" ADD CONSTRAINT "SysbrazoClientMultimedia_deletedBy_User_id_fkey" FOREIGN KEY ("deletedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SysbrazoClientMultimediaRead" ADD CONSTRAINT "SysbrazoClientMultimediaRead_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SysbrazoClientMultimediaRead" ADD CONSTRAINT "SysbrazoClientMultimediaRead_SueApc6wuoC2_fkey" FOREIGN KEY ("multimediaId") REFERENCES "SysbrazoClientMultimedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SysbrazoClientMultimediaRead" ADD CONSTRAINT "SysbrazoClientMultimediaRead_userId_User_id_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;