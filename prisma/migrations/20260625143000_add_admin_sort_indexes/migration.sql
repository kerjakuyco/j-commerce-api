-- Admin column sorting uses backend pagination, so these indexes keep ORDER BY
-- paths from falling back to slow table scans/filesorts as data grows.

CREATE INDEX `users_deletedAt_name_idx` ON `users`(`deletedAt`, `name`);
CREATE INDEX `users_deletedAt_email_idx` ON `users`(`deletedAt`, `email`);
CREATE INDEX `users_deletedAt_role_idx` ON `users`(`deletedAt`, `role`);
CREATE INDEX `users_deletedAt_isActive_idx` ON `users`(`deletedAt`, `isActive`);
CREATE INDEX `users_deletedAt_createdAt_idx` ON `users`(`deletedAt`, `createdAt`);

CREATE INDEX `categories_name_idx` ON `categories`(`name`);

CREATE INDEX `products_deletedAt_isActive_createdAt_idx` ON `products`(`deletedAt`, `isActive`, `createdAt`);
CREATE INDEX `products_deletedAt_isActive_name_idx` ON `products`(`deletedAt`, `isActive`, `name`);
CREATE INDEX `products_deletedAt_isActive_brand_idx` ON `products`(`deletedAt`, `isActive`, `brand`);
CREATE INDEX `products_deletedAt_isActive_basePrice_idx` ON `products`(`deletedAt`, `isActive`, `basePrice`);
CREATE INDEX `products_deletedAt_isActive_rating_idx` ON `products`(`deletedAt`, `isActive`, `rating`);
CREATE INDEX `products_deletedAt_isActive_totalSold_idx` ON `products`(`deletedAt`, `isActive`, `totalSold`);

CREATE INDEX `orders_createdAt_idx` ON `orders`(`createdAt`);
CREATE INDEX `orders_total_idx` ON `orders`(`total`);

CREATE INDEX `vouchers_createdAt_idx` ON `vouchers`(`createdAt`);
CREATE INDEX `vouchers_type_idx` ON `vouchers`(`type`);
CREATE INDEX `vouchers_value_idx` ON `vouchers`(`value`);
CREATE INDEX `vouchers_quota_idx` ON `vouchers`(`quota`);
CREATE INDEX `vouchers_usedCount_idx` ON `vouchers`(`usedCount`);
CREATE INDEX `vouchers_minPurchase_idx` ON `vouchers`(`minPurchase`);
CREATE INDEX `vouchers_startsAt_idx` ON `vouchers`(`startsAt`);
CREATE INDEX `vouchers_expiresAt_idx` ON `vouchers`(`expiresAt`);
CREATE INDEX `vouchers_isActive_idx` ON `vouchers`(`isActive`);
