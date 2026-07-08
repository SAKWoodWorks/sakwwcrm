CREATE INDEX IF NOT EXISTS "salespersons_line_user_id_idx" ON "salespersons"("line_user_id");
CREATE INDEX IF NOT EXISTS "salespersons_link_code_idx" ON "salespersons"("link_code");

CREATE INDEX IF NOT EXISTS "documents_customer_id_idx" ON "documents"("customer_id");
CREATE INDEX IF NOT EXISTS "documents_doc_type_idx" ON "documents"("doc_type");
CREATE INDEX IF NOT EXISTS "documents_salesperson_id_idx" ON "documents"("salesperson_id");
