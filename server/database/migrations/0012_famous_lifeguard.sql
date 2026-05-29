CREATE TABLE "crm_lookup_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_lookup_values_org_kind_key_uq" UNIQUE("organization_id","kind","key")
);
--> statement-breakpoint
ALTER TABLE "opportunities" ALTER COLUMN "source" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "opportunities" ALTER COLUMN "source" SET DEFAULT 'other';--> statement-breakpoint
ALTER TABLE "opportunities" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "opportunities" ALTER COLUMN "type" SET DEFAULT 'consulting';--> statement-breakpoint
ALTER TABLE "crm_lookup_values" ADD CONSTRAINT "crm_lookup_values_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_lookup_values_org_kind_idx" ON "crm_lookup_values" USING btree ("organization_id","kind");--> statement-breakpoint
-- Backfill every existing organization with the default opportunity sources +
-- types so live data keeps rendering after the enum-to-text switch. Idempotent
-- via ON CONFLICT (org_id, kind, key) DO NOTHING.
INSERT INTO "crm_lookup_values" ("organization_id", "kind", "key", "label", "sort_order")
SELECT o.id, kind_key.kind, kind_key.key, kind_key.label, kind_key.sort_order
FROM "organizations" o
CROSS JOIN (VALUES
  ('opportunity_source', 'tender',      'Tender',      0),
  ('opportunity_source', 'grant',       'Grant',       1),
  ('opportunity_source', 'partnership', 'Partnership', 2),
  ('opportunity_source', 'referral',    'Referral',    3),
  ('opportunity_source', 'inbound',     'Inbound',     4),
  ('opportunity_source', 'other',       'Other',       5),
  ('opportunity_type',   'consulting',  'Consulting',  0),
  ('opportunity_type',   'training',    'Training',    1),
  ('opportunity_type',   'research',    'Research',    2),
  ('opportunity_type',   'advisory',    'Advisory',    3),
  ('opportunity_type',   'other',       'Other',       4)
) AS kind_key(kind, key, label, sort_order)
ON CONFLICT ("organization_id", "kind", "key") DO NOTHING;