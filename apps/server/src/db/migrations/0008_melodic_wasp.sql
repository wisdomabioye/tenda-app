CREATE TYPE "public"."report_content_type" AS ENUM('gig', 'message', 'user', 'review');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('spam', 'harassment', 'inappropriate', 'fraud', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'reviewed', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TABLE "blocked_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword" varchar(200) NOT NULL,
	"added_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_user_id" uuid NOT NULL,
	"content_type" "report_content_type" NOT NULL,
	"content_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"note" varchar(500),
	"content_snapshot" varchar(2000),
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"admin_note" varchar(1000),
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "blocked_keywords" ADD CONSTRAINT "blocked_keywords_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blocked_keywords_keyword_unique" ON "blocked_keywords" USING btree ("keyword");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_reporter_content_unique" ON "reports" USING btree ("reporter_id","content_type","content_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reports_content_type_status_idx" ON "reports" USING btree ("content_type","status");--> statement-breakpoint
CREATE INDEX "reports_content_id_idx" ON "reports" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "reports_reported_user_id_idx" ON "reports" USING btree ("reported_user_id");