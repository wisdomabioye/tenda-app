ALTER TABLE "gigs" ALTER COLUMN "city" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "gigs" ADD COLUMN "remote" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "gigs_remote_idx" ON "gigs" USING btree ("remote");--> statement-breakpoint
CREATE INDEX "gigs_status_remote_idx" ON "gigs" USING btree ("status","remote");