-- CreateTable
CREATE TABLE "salespersons" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT,
    "line_user_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salespersons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tax_id" TEXT,
    "vat_registered" BOOLEAN NOT NULL DEFAULT true,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'not_purchase_yet',
    "address" TEXT,
    "province" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "line_id" TEXT,
    "other_id" TEXT,
    "account_manager_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "sku_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "color" TEXT,
    "grade" TEXT,
    "thickness" DECIMAL(8,2),
    "height" DECIMAL(8,2),
    "width" DECIMAL(8,2),
    "weight" DECIMAL(8,3),
    "volume" DECIMAL(10,4),
    "ws_cost" DECIMAL(12,2),
    "rt_cost" DECIMAL(12,2),
    "date_last_cost_adj" DATE,
    "date_last_invoice" DATE,
    "total_qty_invoiced" DECIMAL(12,3) DEFAULT 0,
    "total_amount_invoiced" DECIMAL(14,2) DEFAULT 0,
    "total_qty_quoted" DECIMAL(12,3) DEFAULT 0,
    "total_amount_quoted" DECIMAL(14,2) DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_transform_rules" (
    "id" SERIAL NOT NULL,
    "pattern" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_transform_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "doc_type" TEXT NOT NULL,
    "doc_number" TEXT NOT NULL,
    "doc_date" DATE NOT NULL,
    "channel" TEXT,
    "salesperson_id" INTEGER,
    "payment_status" TEXT,
    "ref_doc_number" TEXT,
    "customer_id" INTEGER,
    "subtotal" DECIMAL(12,2),
    "vat" DECIMAL(12,2),
    "total" DECIMAL(12,2),
    "notes" TEXT,
    "gdrive_file_id" TEXT,
    "gdrive_filename" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_items" (
    "id" SERIAL NOT NULL,
    "document_id" INTEGER NOT NULL,
    "line_no" INTEGER,
    "description" TEXT,
    "quantity" DECIMAL(10,3),
    "unit" TEXT,
    "unit_price" DECIMAL(12,2),
    "total" DECIMAL(12,2),
    "product_id" INTEGER,

    CONSTRAINT "document_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_log" (
    "id" SERIAL NOT NULL,
    "gdrive_file_id" TEXT,
    "filename" TEXT,
    "status" TEXT NOT NULL,
    "error_msg" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_tax_id_key" ON "customers"("tax_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_code_key" ON "products"("sku_code");

-- CreateIndex
CREATE INDEX "product_transform_rules_product_id_priority_idx" ON "product_transform_rules"("product_id", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "documents_gdrive_file_id_key" ON "documents"("gdrive_file_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_account_manager_id_fkey" FOREIGN KEY ("account_manager_id") REFERENCES "salespersons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_transform_rules" ADD CONSTRAINT "product_transform_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_salesperson_id_fkey" FOREIGN KEY ("salesperson_id") REFERENCES "salespersons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_items" ADD CONSTRAINT "document_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
