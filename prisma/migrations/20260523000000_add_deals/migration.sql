CREATE TABLE "deals" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "customer_id" INTEGER,
    "salesperson_id" INTEGER,
    "stage" TEXT NOT NULL DEFAULT 'lead',
    "expected_value" DECIMAL(12, 2),
    "probability" INTEGER NOT NULL DEFAULT 10,
    "expected_close_date" DATE,
    "source" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "deals"
    ADD CONSTRAINT "deals_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "deals"
    ADD CONSTRAINT "deals_salesperson_id_fkey"
    FOREIGN KEY ("salesperson_id") REFERENCES "salespersons"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "deals_stage_idx" ON "deals"("stage");
CREATE INDEX "deals_customer_id_idx" ON "deals"("customer_id");
CREATE INDEX "deals_salesperson_id_idx" ON "deals"("salesperson_id");
CREATE INDEX "deals_expected_close_date_idx" ON "deals"("expected_close_date");
