CREATE TYPE "public"."dispute_winner" AS ENUM('worker', 'poster', 'split');--> statement-breakpoint
CREATE TYPE "public"."gig_category" AS ENUM('delivery', 'photo', 'errand', 'service', 'digital');--> statement-breakpoint
CREATE TYPE "public"."gig_status" AS ENUM('draft', 'open', 'accepted', 'submitted', 'completed', 'disputed', 'resolved', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."gig_transaction_type" AS ENUM('create_escrow', 'release_payment', 'cancel_refund', 'expired_refund', 'dispute_resolved');--> statement-breakpoint
CREATE TYPE "public"."proof_type" AS ENUM('image', 'video', 'document');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gig_id" uuid NOT NULL,
	"raised_by_id" uuid NOT NULL,
	"resolver_wallet_address" text,
	"reason" varchar(2000) NOT NULL,
	"winner" "dispute_winner",
	"raised_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gig_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gig_id" uuid NOT NULL,
	"uploaded_by_id" uuid NOT NULL,
	"url" text NOT NULL,
	"type" "proof_type" DEFAULT 'image' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gig_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gig_id" uuid NOT NULL,
	"type" "gig_transaction_type" NOT NULL,
	"signature" text NOT NULL,
	"amount_lamports" bigint NOT NULL,
	"platform_fee_lamports" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gigs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poster_id" uuid NOT NULL,
	"worker_id" uuid,
	"title" varchar(200) NOT NULL,
	"description" varchar(5000) NOT NULL,
	"payment_lamports" bigint NOT NULL,
	"category" "gig_category" NOT NULL,
	"status" "gig_status" DEFAULT 'draft' NOT NULL,
	"city" text NOT NULL,
	"address" text,
	"latitude" double precision,
	"longitude" double precision,
	"accept_deadline" timestamp with time zone,
	"completion_duration_seconds" integer NOT NULL,
	"accepted_at" timestamp with time zone,
	"escrow_address" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"fee_bps" integer DEFAULT 250 NOT NULL,
	"grace_period_seconds" integer DEFAULT 86400 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gig_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"reviewee_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"comment" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"bio" text,
	"city" text,
	"latitude" double precision,
	"longitude" double precision,
	"reputation_score" integer DEFAULT 0,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_id_users_id_fk" FOREIGN KEY ("raised_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_proofs" ADD CONSTRAINT "gig_proofs_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_proofs" ADD CONSTRAINT "gig_proofs_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_transactions" ADD CONSTRAINT "gig_transactions_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gigs" ADD CONSTRAINT "gigs_poster_id_users_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gigs" ADD CONSTRAINT "gigs_worker_id_users_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_users_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_gig_id_unique" ON "disputes" USING btree ("gig_id");--> statement-breakpoint
CREATE INDEX "disputes_resolved_at_idx" ON "disputes" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "gig_proofs_gig_id_idx" ON "gig_proofs" USING btree ("gig_id");--> statement-breakpoint
CREATE INDEX "gig_transactions_gig_id_idx" ON "gig_transactions" USING btree ("gig_id");--> statement-breakpoint
CREATE INDEX "gigs_poster_id_idx" ON "gigs" USING btree ("poster_id");--> statement-breakpoint
CREATE INDEX "gigs_worker_id_idx" ON "gigs" USING btree ("worker_id");--> statement-breakpoint
CREATE INDEX "gigs_status_idx" ON "gigs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gigs_category_idx" ON "gigs" USING btree ("category");--> statement-breakpoint
CREATE INDEX "gigs_city_idx" ON "gigs" USING btree ("city");--> statement-breakpoint
CREATE INDEX "gigs_status_city_idx" ON "gigs" USING btree ("status","city");--> statement-breakpoint
CREATE INDEX "gigs_created_at_idx" ON "gigs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "gigs_escrow_address_unique" ON "gigs" USING btree ("escrow_address");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_gig_reviewer_unique" ON "reviews" USING btree ("gig_id","reviewer_id");--> statement-breakpoint
CREATE INDEX "reviews_reviewee_id_idx" ON "reviews" USING btree ("reviewee_id");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
-- Seed the single-row platform config on first deploy.
-- Fee defaults to PLATFORM_FEE_BPS env var value (250 bps = 2.5%) if not overridden.
INSERT INTO "platform_config" ("id", "fee_bps", "grace_period_seconds")
VALUES (1, 250, 86400)
ON CONFLICT ("id") DO NOTHING;