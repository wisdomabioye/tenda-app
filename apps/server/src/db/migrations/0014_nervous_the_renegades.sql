ALTER TABLE "messages" ADD COLUMN "attachment_url" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "attachment_type" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "attachment_size" integer;--> statement-breakpoint
CREATE INDEX "conversations_user_a_last_msg_idx" ON "conversations" USING btree ("user_a_id","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversations_user_b_last_msg_idx" ON "conversations" USING btree ("user_b_id","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_created_at_idx" ON "reports" USING btree ("created_at" DESC NULLS LAST);