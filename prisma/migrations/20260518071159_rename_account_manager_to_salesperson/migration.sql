/*
  Warnings:

  - You are about to drop the column `account_manager_id` on the `customers` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_account_manager_id_fkey";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "account_manager_id",
ADD COLUMN     "salesperson_id" INTEGER;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_salesperson_id_fkey" FOREIGN KEY ("salesperson_id") REFERENCES "salespersons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
