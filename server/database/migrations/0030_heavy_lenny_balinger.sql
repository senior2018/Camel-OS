ALTER TABLE "content_items" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "published_url" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "is_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "spend" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "metrics" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_communications_settings" ADD COLUMN "platforms" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_communications_settings" ADD COLUMN "platform_metrics" jsonb DEFAULT '{}'::jsonb NOT NULL;