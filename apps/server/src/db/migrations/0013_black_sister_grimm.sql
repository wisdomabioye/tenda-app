CREATE TYPE "public"."airdrop_recipient_status" AS ENUM('pending', 'distributed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."airdrop_status" AS ENUM('draft', 'approved', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."dispute_sender" AS ENUM('party_a', 'party_b', 'admin');--> statement-breakpoint
CREATE TABLE "airdrop_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" varchar(1000),
	"lamports_per_recipient" bigint NOT NULL,
	"total_lamports" bigint DEFAULT 0 NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"batch_size" integer DEFAULT 30 NOT NULL,
	"status" "airdrop_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "airdrop_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid,
	"wallet_address" text NOT NULL,
	"batch_index" integer NOT NULL,
	"status" "airdrop_recipient_status" DEFAULT 'pending' NOT NULL,
	"signature" text,
	"distributed_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" varchar(2000) NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dispute_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_id" uuid,
	"sender_role" "dispute_sender" NOT NULL,
	"body" varchar(2000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dispute_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gig_dispute_id" uuid,
	"exchange_dispute_id" uuid,
	"assigned_to_id" uuid,
	"party_a_last_read_at" timestamp with time zone,
	"party_b_last_read_at" timestamp with time zone,
	"admin_last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "exchange_offers" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "gigs" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "gigs" ADD COLUMN "featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "airdrop_campaigns" ADD CONSTRAINT "airdrop_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airdrop_campaigns" ADD CONSTRAINT "airdrop_campaigns_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airdrop_recipients" ADD CONSTRAINT "airdrop_recipients_campaign_id_airdrop_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."airdrop_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airdrop_recipients" ADD CONSTRAINT "airdrop_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_thread_id_dispute_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."dispute_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_messages" ADD CONSTRAINT "dispute_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_threads" ADD CONSTRAINT "dispute_threads_gig_dispute_id_disputes_id_fk" FOREIGN KEY ("gig_dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_threads" ADD CONSTRAINT "dispute_threads_exchange_dispute_id_exchange_disputes_id_fk" FOREIGN KEY ("exchange_dispute_id") REFERENCES "public"."exchange_disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_threads" ADD CONSTRAINT "dispute_threads_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "airdrop_campaigns_status_idx" ON "airdrop_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "airdrop_recipients_campaign_idx" ON "airdrop_recipients" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "airdrop_recipients_batch_idx" ON "airdrop_recipients" USING btree ("campaign_id","batch_index");--> statement-breakpoint
CREATE INDEX "airdrop_recipients_wallet_idx" ON "airdrop_recipients" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "airdrop_recipients_status_idx" ON "airdrop_recipients" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "airdrop_recipients_campaign_wallet_unique" ON "airdrop_recipients" USING btree ("campaign_id","wallet_address");--> statement-breakpoint
CREATE INDEX "announcements_active_priority_idx" ON "announcements" USING btree ("is_active","priority");--> statement-breakpoint
CREATE INDEX "announcements_expires_at_idx" ON "announcements" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "dispute_messages_thread_created_at_idx" ON "dispute_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "dispute_messages_sender_id_idx" ON "dispute_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dispute_threads_gig_dispute_unique" ON "dispute_threads" USING btree ("gig_dispute_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dispute_threads_exchange_dispute_unique" ON "dispute_threads" USING btree ("exchange_dispute_id");--> statement-breakpoint
CREATE INDEX "dispute_threads_assigned_to_idx" ON "dispute_threads" USING btree ("assigned_to_id");--> statement-breakpoint
CREATE INDEX "exchange_offers_hidden_idx" ON "exchange_offers" USING btree ("hidden");--> statement-breakpoint
CREATE INDEX "gigs_hidden_idx" ON "gigs" USING btree ("hidden");--> statement-breakpoint
CREATE INDEX "gigs_featured_idx" ON "gigs" USING btree ("featured");