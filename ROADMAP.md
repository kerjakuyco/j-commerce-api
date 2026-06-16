# j-commerce-api — Roadmap & Completion Status

Dokumen ini merangkum status akhir implementasi backend `j-commerce-api`.

## Status Tracker

- [x] **Phase -1**: Dokumentasi (`FEATURES.md`, `ARCHITECTURE.md`, `STACK.md`, `ROADMAP.md`)
- [x] **Phase 0**: Bootstrap NestJS + Prisma + dependencies + Docker Compose
- [x] **Phase 1**: Prisma schema + seed data
- [x] **Phase 2**: Auth + Users module
- [x] **Phase 3**: Catalog module (categories, products, variants, images, reviews)
- [x] **Phase 4**: Cart, Wishlist, Address modules
- [x] **Phase 5**: Orders module (create, list, detail, status flow, cancel, confirm)
- [x] **Phase 6**: Vouchers, Notifications, Banners modules
- [x] **Phase 7**: Midtrans Snap integration (server-side + webhook)
- [x] **Phase 8**: Upload + Dashboard stats endpoints
- [x] **Phase 9**: Swagger docs, validation polish, tests, docker compose, README

## Completed Modules

- [x] `auth`: register, login, refresh, forgot password, logout, change password, current user
- [x] `users`: list, detail, update admin/self, soft delete, active toggle
- [x] `categories`: public list/detail, admin create/update/delete
- [x] `products`: public catalog filters, featured, flash sale, related, admin CRUD
- [x] `product-variants`: create/update/delete variants, stock managed by order flow
- [x] `product-images`: add, reorder, delete gallery images
- [x] `reviews`: list, create, update, delete, rating recalculation
- [x] `addresses`: CRUD, default address, public region data
- [x] `cart`: get, add, update quantity/selected, remove, clear
- [x] `wishlist`: get, add, remove
- [x] `orders`: create with atomic stock decrement, list/detail, cancel, confirm received, admin status update
- [x] `payments`: Midtrans Snap token, webhook signature verification, payment lookup
- [x] `vouchers`: public list/detail, admin CRUD, protected validation
- [x] `notifications`: list, mark read, mark all read, delete, admin broadcast, order notifications
- [x] `banners`: public list/detail, admin CRUD
- [x] `upload`: single/multiple local image upload, delete file, static serving
- [x] `dashboard`: stats overview, revenue chart, top products, order status breakdown
- [x] `health`: database health payload

## Verification

- [x] `npm run build` succeeds
- [x] `npm run format:check` succeeds
- [x] `npm run lint:check` succeeds
- [x] `npm test` succeeds
- [x] `npm run test:e2e` succeeds

## Runtime Commands

- `docker compose up -d` starts MySQL + phpMyAdmin.
- `npm run prisma:migrate` applies Prisma migration locally.
- `npm run seed` populates demo data.
- `npm run start:dev` starts the API on `http://localhost:3000`.
- Swagger UI is available at `http://localhost:3000/api/docs`.

## Related Repositories

- `j-commerce` — Flutter mobile app
- `j-commerce-api` — NestJS + Prisma backend
- `j-commerce-admin` — Vite + React admin panel
