ALTER TABLE "gigs" ADD COLUMN "country" text DEFAULT 'NG' NOT NULL;--> statement-breakpoint
CREATE INDEX "gigs_country_idx" ON "gigs" USING btree ("country");--> statement-breakpoint
CREATE INDEX "gigs_status_country_idx" ON "gigs" USING btree ("status","country");