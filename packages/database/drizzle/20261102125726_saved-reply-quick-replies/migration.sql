ALTER TABLE "SavedReply" ADD COLUMN "imagePath" text;--> statement-breakpoint
ALTER TABLE "SavedReply" ADD COLUMN "secondText" text;--> statement-breakpoint
ALTER TABLE "SavedReply" ADD COLUMN "createdById" bigint;--> statement-breakpoint
ALTER TABLE "SavedReply" ADD COLUMN "updatedById" bigint;--> statement-breakpoint
ALTER TABLE "SavedReply" ALTER COLUMN "shortcut" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "SavedReply" ADD CONSTRAINT "SavedReply_createdById_User_id_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "SavedReply" ADD CONSTRAINT "SavedReply_updatedById_User_id_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;