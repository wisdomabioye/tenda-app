CREATE TYPE "public"."exchange_dispute_winner" AS ENUM('seller', 'buyer', 'split');--> statement-breakpoint
CREATE TYPE "public"."exchange_offer_status" AS ENUM('draft', 'open', 'accepted', 'paid', 'completed', 'disputed', 'resolved', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."exchange_transaction_type" AS ENUM('create_escrow', 'accept', 'mark_paid', 'release_payment', 'cancel_refund', 'expired_refund', 'dispute_raised', 'dispute_resolved');--> statement-breakpoint
ALTER TYPE "public"."gig_transaction_type" ADD VALUE 'accept_gig' BEFORE 'release_payment';--> statement-breakpoint
CREATE TABLE "exchange_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"opened_by_id" uuid NOT NULL,
	"reason" varchar(2000) NOT NULL,
	"winner" "exchange_dispute_winner",
	"resolver_wallet_address" text,
	"admin_note" text,
	"raised_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "exchange_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"buyer_id" uuid,
	"lamports_amount" bigint NOT NULL,
	"fiat_amount" integer NOT NULL,
	"fiat_currency" varchar(3) NOT NULL,
	"rate" double precision NOT NULL,
	"payment_window_seconds" integer DEFAULT 86400 NOT NULL,
	"payment_account_ids" uuid[] DEFAULT '{}' NOT NULL,
	"status" "exchange_offer_status" DEFAULT 'draft' NOT NULL,
	"accept_deadline" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"escrow_address" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exchange_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"uploaded_by_id" uuid NOT NULL,
	"url" text NOT NULL,
	"type" "proof_type" DEFAULT 'image' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exchange_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"type" "exchange_transaction_type" NOT NULL,
	"signature" text NOT NULL,
	"amount_lamports" bigint NOT NULL,
	"platform_fee_lamports" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_exchange_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"method" varchar(100) NOT NULL,
	"account_name" varchar(100) NOT NULL,
	"account_number" varchar(100) NOT NULL,
	"bank_name" varchar(100),
	"additional_info" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DROP INDEX "messages_conversation_id_idx";--> statement-breakpoint
DROP INDEX "messages_created_at_idx";--> statement-breakpoint
ALTER TABLE "exchange_disputes" ADD CONSTRAINT "exchange_disputes_offer_id_exchange_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."exchange_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_disputes" ADD CONSTRAINT "exchange_disputes_opened_by_id_users_id_fk" FOREIGN KEY ("opened_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_offers" ADD CONSTRAINT "exchange_offers_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_offers" ADD CONSTRAINT "exchange_offers_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_proofs" ADD CONSTRAINT "exchange_proofs_offer_id_exchange_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."exchange_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_proofs" ADD CONSTRAINT "exchange_proofs_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_transactions" ADD CONSTRAINT "exchange_transactions_offer_id_exchange_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."exchange_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_exchange_accounts" ADD CONSTRAINT "user_exchange_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_disputes_offer_id_unique" ON "exchange_disputes" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "exchange_disputes_resolved_at_idx" ON "exchange_disputes" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "exchange_offers_seller_id_idx" ON "exchange_offers" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "exchange_offers_buyer_id_idx" ON "exchange_offers" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "exchange_offers_status_idx" ON "exchange_offers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "exchange_offers_currency_idx" ON "exchange_offers" USING btree ("fiat_currency");--> statement-breakpoint
CREATE INDEX "exchange_offers_status_currency_idx" ON "exchange_offers" USING btree ("status","fiat_currency");--> statement-breakpoint
CREATE INDEX "exchange_offers_status_lamports_idx" ON "exchange_offers" USING btree ("status","lamports_amount");--> statement-breakpoint
CREATE INDEX "exchange_offers_accept_deadline_idx" ON "exchange_offers" USING btree ("accept_deadline");--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_offers_escrow_unique" ON "exchange_offers" USING btree ("escrow_address");--> statement-breakpoint
CREATE INDEX "exchange_proofs_offer_id_idx" ON "exchange_proofs" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "exchange_transactions_offer_id_idx" ON "exchange_transactions" USING btree ("offer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_transactions_signature_unique" ON "exchange_transactions" USING btree ("signature");--> statement-breakpoint
CREATE INDEX "user_exchange_accounts_user_id_idx" ON "user_exchange_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_exchange_accounts_active_idx" ON "user_exchange_accounts" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "user_exchange_accounts_unique_method_number" ON "user_exchange_accounts" USING btree ("user_id","method","account_number");--> statement-breakpoint
CREATE INDEX "gig_subscriptions_city_category_idx" ON "gig_subscriptions" USING btree ("city","category");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_at_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_unread_idx" ON "messages" USING btree ("conversation_id","sender_id") WHERE read_at IS NULL;