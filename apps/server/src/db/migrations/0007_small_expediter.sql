ALTER TABLE "gigs" ADD COLUMN "cross_border" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "country" text;