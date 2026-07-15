ALTER TABLE "mel_indicators" ALTER COLUMN "level" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "mel_indicators" ALTER COLUMN "level" SET DEFAULT 'Indicator';--> statement-breakpoint
ALTER TABLE "organization_project_settings" ADD COLUMN "mel_levels" jsonb DEFAULT '["Goal","Outcome","Output","Indicator"]'::jsonb NOT NULL;