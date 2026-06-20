# j-commerce-api — Features

Dokumen ini adalah **sumber kebenaran** untuk seluruh fitur backend `j-commerce-api`. Baca file ini **di awal setiap sesi** sebelum melanjutkan pekerjaan, supaya konteks dan scope tidak hilang antar percakapan.

> **Tujuan repo:** Backend API untuk single-store e-commerce — NestJS + Prisma + MySQL, dipanggil oleh Flutter mobile app (`j-commerce`) dan admin web (`j-commerce-admin`).

**Status legend:**
- `[x]` = implemented
- `[~]` = implemented but minimal/placeholder
- `[ ]` = deferred

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | NestJS 10 |
| Language | TypeScript 5.x (strict mode) |
| ORM | Prisma 5 |
| Database | MySQL 8 |
| Auth | Passport.js + passport-jwt + bcrypt |
| Validation | class-validator + class-transformer |
| Docs | Swagger / OpenAPI 3 (via `@nestjs/swagger`) |
| Payment | Midtrans Snap (server-side integration) |
| File upload | Multer (local disk for portfolio scope) |
| Email | Nodemailer (optional, stub by default) |
| Testing | Jest + Supertest |
| Containerization | Docker Compose (MySQL 8) |
| Linting | ESLint + Prettier (NestJS defaults) |

---

## 2. Modules Overview

```
src/
├── main.ts                    # App bootstrap
├── app.module.ts              # Root module
├── prisma/                    # Prisma service wrapper
├── common/                    # Decorators, filters, interceptors, pipes, guards
├── config/                    # Env config (database, JWT, Midtrans, etc.)
├── modules/
│   ├── auth/                  # register, login, refresh, me, forgot password
│   ├── users/                 # User CRUD (admin)
│   ├── categories/            # Category CRUD
│   ├── products/              # Product CRUD + search/filter/paginate
│   ├── product-variants/      # SKU + stock per variant
│   ├── product-images/        # Image gallery
│   ├── reviews/               # Product reviews
│   ├── addresses/             # User addresses
│   ├── cart/                  # Server-side cart with mobile local fallback
│   ├── wishlist/              # User wishlist sync
│   ├── orders/                # Order CRUD + status flow
│   ├── payments/              # Midtrans Snap integration
│   ├── notifications/         # In-app notifications
│   ├── vouchers/              # Voucher codes
│   ├── banners/               # Home banners
│   ├── upload/                # File upload endpoint
│   ├── dashboard/             # Admin stats (revenue, top products, charts)
│   └── health/                # Health check
└── seed/                      # Database seeder
```

---

## 3. Daftar Fitur Lengkap

### 3.1 Auth
- [x] **Register** dengan email + password + name + phone (default role: CUSTOMER)
- [x] **Login** dengan email + password → return `{ user, accessToken, refreshToken, expiresIn }`
- [x] **Refresh token** endpoint — exchange refresh token for new access token
- [x] **Get current user** (`/auth/me`) — protected, returns user profile
- [x] **Forgot password** (`/auth/forgot-password`) — accept email, return success (no real email gateway in portfolio scope)
- [x] **Logout** (`/auth/logout`) — invalidate refresh token (revoke from DB)
- [x] **Change password** (`/auth/change-password`) — protected, requires old password
- [x] Bcrypt password hashing (cost 12)
- [x] JWT access token (15 min TTL) + refresh token (7 days TTL, stored in DB)
- [x] `JwtAuthGuard` global (with `@Public()` decorator opt-out)
- [x] `RolesGuard` + `@Roles('ADMIN', 'CUSTOMER')` decorator
- [x] `CurrentUser` decorator to extract user from request

### 3.2 Users (Admin)
- [x] **List users** (`GET /users?page=&limit=&search=&role=`) — admin only
- [x] **Get user by id** (`GET /users/:id`) — admin only
- [x] **Update user** (`PATCH /users/:id`) — admin or self
- [x] **Delete user** (`DELETE /users/:id`) — admin only (soft delete via `deletedAt`)
- [x] **Toggle user active** (`PATCH /users/:id/active`) — admin only

### 3.3 Categories
- [x] **List categories** (`GET /categories`) — public, includes thumbnail
- [x] **Get category by id/slug** (`GET /categories/:idOrSlug`)
- [x] **Create category** (`POST /categories`) — admin only
- [x] **Update category** (`PATCH /categories/:id`) — admin only
- [x] **Delete category** (`DELETE /categories/:id`) — admin only (cascades to products? No, blocks if has products)

### 3.4 Products
- [x] **List products** (`GET /products?page=&limit=&categoryId=&search=&minPrice=&maxPrice=&minRating=&sort=`) — public
- [x] **Get product by id/slug** (`GET /products/:idOrSlug`) — includes variants, images, specs, avg rating
- [x] **Featured products** (`GET /products/featured?limit=10`) — public
- [x] **Flash sale products** (`GET /products/flash-sale?limit=10`) — public
- [x] **Related products** (`GET /products/:id/related?limit=6`) — public, same category
- [x] **Create product** (`POST /products`) — admin only
- [x] **Update product** (`PATCH /products/:id`) — admin only
- [x] **Delete product** (`DELETE /products/:id`) — admin only (soft delete)
- [x] Search uses MySQL FULLTEXT index on `name`, `description`, `brand`
- [x] Pagination via `page` + `limit` query params, returns `{ data, meta: { total, page, limit, totalPages } }`

### 3.5 Product Variants
- [x] **Create variant** (`POST /products/:productId/variants`) — admin only
- [x] **Update variant** (`PATCH /variants/:id`) — admin only
- [x] **Delete variant** (`DELETE /variants/:id`) — admin only
- [x] Stock check on order create (decrement stock atomically)

### 3.6 Product Images
- [x] **Add image** (`POST /products/:productId/images`) — admin only, accepts URL or upload
- [x] **Reorder images** (`PATCH /products/:productId/images/reorder`) — admin only
- [x] **Delete image** (`DELETE /images/:id`) — admin only
- [x] **Upload image file** (`POST /upload/image`) — multipart, returns URL

### 3.7 Reviews
- [x] **List reviews per product** (`GET /products/:productId/reviews?page=&limit=&minRating=`) — public
- [x] **Create review** (`POST /products/:productId/reviews`) — protected, must have ordered product (DELIVERED status)
- [x] **Update review** (`PATCH /reviews/:id`) — owner only
- [x] **Delete review** (`DELETE /reviews/:id`) — owner or admin
- [x] Rating 1-5 stars + comment + optional images (up to 3)
- [x] Auto-update product `rating` avg + `totalReview` count via Prisma middleware

### 3.8 Addresses
- [x] **List user addresses** (`GET /addresses`) — protected
- [x] **Create address** (`POST /addresses`) — protected
- [x] **Update address** (`PATCH /addresses/:id`) — protected, owner only
- [x] **Delete address** (`DELETE /addresses/:id`) — protected, owner only
- [x] **Set default address** (`PATCH /addresses/:id/default`) — protected, auto-uncheck others
- [x] **List provinces/cities** (`GET /addresses/regions`) — public, hardcoded JSON (mock dropdown data)

### 3.9 Cart (server-side, optional)
- [x] **Get cart** (`GET /cart`) — protected
- [x] **Add to cart** (`POST /cart/items`) — protected
- [x] **Update qty** (`PATCH /cart/items/:id`) — protected
- [x] **Remove item** (`DELETE /cart/items/:id`) — protected
- [x] **Clear cart** (`DELETE /cart`) — protected
- [~] **Catatan:** Mobile app attempts remote cart sync first, with SharedPreferences fallback for demo/offline mode.

### 3.10 Wishlist
- [x] **Get wishlist** (`GET /wishlist`) — protected
- [x] **Add to wishlist** (`POST /wishlist/:productId`) — protected
- [x] **Remove from wishlist** (`DELETE /wishlist/:productId`) — protected
- [~] **Catatan:** Mobile app attempts remote wishlist sync first, with local ID fallback for demo/offline mode.

### 3.11 Orders
- [x] **Create order** (`POST /orders`) — protected, calculates subtotal, validates stock atomically
- [x] **List user orders** (`GET /orders?status=&page=&limit=`) — protected
- [x] **Get order by id** (`GET /orders/:id`) — protected, owner or admin
- [x] **Cancel order** (`PATCH /orders/:id/cancel`) — protected, owner only, only if PENDING/PAID
- [x] **Confirm received** (`PATCH /orders/:id/confirm-received`) — protected, owner only, only if SHIPPED
- [x] **Update order status** (`PATCH /orders/:id/status`) — admin only
- [x] **Order status enum**: `PENDING`, `PAID`, `PACKED`, `SHIPPED`, `DELIVERED`, `CANCELLED`
- [x] Order number auto-generated: `INV-YYYYMMDD-XXXXX` (e.g. `INV-20260616-A4B2C`)
- [x] Auto-restore stock on cancel

### 3.12 Payments (Midtrans Snap)
- [x] **Get snap token** (`POST /payments/midtrans/snap-token`) — protected, creates Snap transaction
- [x] **Midtrans webhook** (`POST /payments/midtrans/notification`) — public (verified by signature), updates payment status
- [x] **Get payment by order id** (`GET /payments/order/:orderId`) — protected
- [x] **Midtrans config** via env vars: `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`
- [x] Signature verification on webhook to prevent spoofing
- [x] Order auto-updates to `PAID` on successful payment notification

### 3.13 Vouchers
- [x] **List active vouchers** (`GET /vouchers?page=&limit=`) — public
- [x] **List all vouchers for admin** (`GET /vouchers/admin/all?page=&limit=`) — admin only
- [x] **Get voucher by code** (`GET /vouchers/:code`) — public
- [x] **Create voucher** (`POST /vouchers`) — admin only
- [x] **Update voucher** (`PATCH /vouchers/:id`) — admin only
- [x] **Delete voucher** (`DELETE /vouchers/:id`) — admin only
- [x] **Validate voucher** (`POST /vouchers/validate`) — protected, returns discount amount
- [x] Voucher types: `PERCENTAGE` (max 100%), `FIXED` (nominal)
- [x] Quota tracking + expiry date

### 3.14 Notifications
- [x] **List user notifications** (`GET /notifications?unreadOnly=`) — protected
- [x] **Mark as read** (`PATCH /notifications/:id/read`) — protected
- [x] **Mark all as read** (`PATCH /notifications/read-all`) — protected
- [x] **Delete notification** (`DELETE /notifications/:id`) — protected
- [x] **Send broadcast** (`POST /notifications/broadcast`) — admin only
- [x] Types: `PROMO`, `ORDER`, `SYSTEM`
- [x] Auto-create notifications on order status change

### 3.15 Banners
- [x] **List active banners** (`GET /banners`) — public
- [x] **List all banners for admin** (`GET /banners/admin/all`) — admin only
- [x] **Get banner by id** (`GET /banners/:id`) — public
- [x] **Create banner** (`POST /banners`) — admin only
- [x] **Update banner** (`PATCH /banners/:id`) — admin only
- [x] **Delete banner** (`DELETE /banners/:id`) — admin only
- [x] Sort order (`sortOrder` field) for display sequence

### 3.16 Upload
- [x] **Upload image** (`POST /upload/image`) — protected, multipart, returns `{ url, filename, size, mimetype }`
- [x] **Upload multiple** (`POST /upload/images`) — protected, max 5 files
- [x] **Delete file** (`DELETE /upload/:filename`) — protected
- [x] Local disk storage at `uploads/` (configurable via `UPLOAD_DIR`)
- [x] Serve via static endpoint `/uploads/*`
- [x] MIME type validation (jpg, png, webp only)
- [x] File size limit (5 MB default)

### 3.17 Dashboard (Admin)
- [x] **Stats overview** (`GET /dashboard/stats`) — admin only
  - Total revenue (sum of PAID/DELIVERED orders this month)
  - Total orders (this month + growth %)
  - Total customers
  - Total products
  - Recent orders (5 latest)
- [x] **Revenue chart** (`GET /dashboard/revenue?period=7d|30d|90d|1y`) — daily totals
- [x] **Top products** (`GET /dashboard/top-products?limit=10`) — by sold count
- [x] **Order status breakdown** (`GET /dashboard/order-status`) — counts per status

### 3.18 Health Check
- [x] **Health** (`GET /health`) — returns `{ status: 'ok', db: 'connected', uptime, version }`

---

## 4. Non-Functional

### 4.1 API Design
- [x] RESTful convention, JSON request/response
- [x] Consistent error format: `{ statusCode, message, error, details? }`
- [x] HTTP status codes (200, 201, 400, 401, 403, 404, 409, 422, 500)
- [x] Pagination: `{ data: [...], meta: { total, page, limit, totalPages } }`
- [x] API versioning: `/api/v1/*`
- [x] CORS configured for mobile + admin origins
- [x] Helmet for security headers
- [x] Rate limiting (100 req/min default) via `@nestjs/throttler`

### 4.2 Validation
- [x] DTOs with `class-validator` decorators
- [x] Global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform)
- [x] Custom error messages in Indonesian

### 4.3 Database
- [x] Prisma migrations
- [x] Foreign key constraints with `onDelete` rules
- [x] Indexes on frequently queried fields (`email`, `slug`, `categoryId`, `userId`, etc.)
- [x] Soft delete on `User`, `Product`, `Category` (via `deletedAt`)
- [x] Auto-update `updatedAt` via Prisma

### 4.4 Logging
- [x] NestJS Logger (built-in)
- [x] Request logging interceptor (method, path, status, duration, user)
- [x] Log level configurable via `LOG_LEVEL` env

### 4.5 Testing
- [x] Unit tests for services (mock Prisma)
- [x] E2E tests for critical paths (auth, orders) using Supertest
- [x] Test database (separate `DATABASE_URL`)

### 4.6 Documentation
- [x] Swagger UI at `/api/docs`
- [x] OpenAPI JSON at `/api/docs-json`
- [x] DTOs annotated with `@ApiProperty`
- [x] Controllers annotated with `@ApiTags` + `@ApiOperation`

---

## 5. Di Luar Scope

Fitur berikut **TIDAK** dibangun di backend ini (di repo lain atau di client):

- **Push notification** (FCM/APNs) — hanya in-app list di mobile
- **Realtime chat** dengan seller
- **Multi-vendor** / multi-toko
- **Loyalty points** / referral
- **Blog** / artikel
- **Email gateway** real — `/auth/forgot-password` return success tapi tidak kirim email
- **Image storage cloud** (S3/Cloudinary) — pakai local disk untuk portfolio
- **OAuth social login** (Google/Apple) — admin/backend tidak handle ini, hanya menerima JWT
- **GraphQL endpoint** — REST only

---

## 6. Acceptance Criteria

- [x] `npm run build` sukses tanpa error TypeScript
- [x] `npm run lint` bersih
- [x] `npm test` lulus (unit tests)
- [x] `npm run test:e2e` lulus (e2e tests)
- [x] `docker compose up -d` menjalankan MySQL
- [x] `npm run prisma:migrate` sukses membuat schema
- [x] `npm run seed` populate data awal (1 admin, 1 customer, 8 kategori, 8 produk, 3 banner, 3 voucher)
- [x] `npm run start:dev` server jalan di `http://localhost:3000`
- [x] Swagger UI accessible di `http://localhost:3000/api/docs`
- [x] Semua 50+ endpoint documented di Swagger
- [x] Mobile app (mock mode) bisa point ke API ini dan jalan

---

## 7. Source of Truth

File ini WAJIB dibaca di awal setiap sesi. Jika ada perubahan endpoint, schema, atau behavior, update file ini **terlebih dahulu** sebelum mengubah kode.
