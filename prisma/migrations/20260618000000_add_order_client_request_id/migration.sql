ALTER TABLE `orders` ADD COLUMN `clientRequestId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `orders_clientRequestId_key` ON `orders`(`clientRequestId`);
