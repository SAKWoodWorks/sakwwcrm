/*
  Warnings:

  - You are about to drop the column `color` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "products" DROP COLUMN "color",
DROP COLUMN "height",
ADD COLUMN     "length" DECIMAL(8,2);
