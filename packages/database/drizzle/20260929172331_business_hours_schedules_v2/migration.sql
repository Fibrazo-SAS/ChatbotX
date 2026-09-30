CREATE TABLE "BusinessHours" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"workspaceId" bigint NOT NULL,
	"name" text NOT NULL,
	"timezone" text,
	"active" boolean DEFAULT true NOT NULL,
	"intervals" jsonb DEFAULT '[]' NOT NULL,
	"holidays" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "BusinessHours_workspaceId_idx" ON "BusinessHours" ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "BusinessHours_workspaceId_name_key" ON "BusinessHours" ("workspaceId","name");--> statement-breakpoint
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;