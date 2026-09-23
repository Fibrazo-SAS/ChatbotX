ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" timestamp(6) with time zone;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "passwordSetupTokenHash" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "passwordSetupTokenExpiresAt" timestamp(6) with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "User_passwordSetupTokenHash_key" ON "User" ("passwordSetupTokenHash");--> statement-breakpoint
-- Backfill (ticket 15137): every user that exists before this migration is
-- "onboarded" — they keep the legacy magic-link flow untouched. Only users
-- created afterwards (platform admin console) start with NULL = onboarding
-- pending, and they must set a password before signing in.
UPDATE "User" SET "onboardingCompletedAt" = "createdAt" WHERE "onboardingCompletedAt" IS NULL;