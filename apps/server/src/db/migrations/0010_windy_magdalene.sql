ALTER TABLE "reviews" ALTER COLUMN "gig_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "offer_id" uuid;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_offer_id_exchange_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."exchange_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_offer_reviewer_unique" ON "reviews" USING btree ("offer_id","reviewer_id");