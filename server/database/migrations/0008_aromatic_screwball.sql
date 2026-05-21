ALTER TYPE "public"."client_type" ADD VALUE 'donor';--> statement-breakpoint
ALTER TYPE "public"."client_type" ADD VALUE 'partner';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "metadata" jsonb;