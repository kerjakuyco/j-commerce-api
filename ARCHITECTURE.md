# j-commerce-api — Architecture

Dokumen ini menjelaskan **arsitektur teknis** backend `j-commerce-api`. Baca di awal setiap sesi untuk memahami layering, dependency rule, dan alur data.

---

## 1. Stack Overview

```
┌─────────────────────────────────────────┐
│            HTTP Clients                 │
│   (Flutter mobile, React admin)         │
└─────────────┬───────────────────────────┘
              │ REST/JSON
┌─────────────▼───────────────────────────┐
│           NestJS Application            │
│  ┌────────────────────────────────────┐ │
│  │ Middlewares: Helmet, CORS, Rate   │ │
│  │ limit, Body parser                │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ Global Pipes: Validation           │ │
│  │ Global Filters: HttpException      │ │
│  │ Global Guards: JwtAuth, Roles     │ │
│  │ Global Interceptors: Logging       │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ Module Layer:                      │ │
│  │  Auth, Users, Products, Orders...  │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ Service Layer: Business logic      │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ Prisma Client (ORM)                │ │
│  └────────────────────────────────────┘ │
└─────────────┬───────────────────────────┘
              │ SQL
┌─────────────▼───────────────────────────┐
│            MySQL 8 Database              │
└─────────────────────────────────────────┘
```

---

## 2. Module Architecture (per-feature)

Setiap feature module mengikuti pola NestJS standard:

```
modules/<feature>/
├── <feature>.module.ts        # NestJS module declaration
├── <feature>.controller.ts     # HTTP endpoints (thin layer)
├── <feature>.service.ts        # Business logic
├── dto/
│   ├── create-<feature>.dto.ts # Request DTO with validation
│   └── update-<feature>.dto.ts
├── entities/
│   └── <feature>.entity.ts     # Response shape (or use Prisma types directly)
└── guards/ (if specific to module)
```

**Layer responsibilities:**
- **Controller:** Parse request, call service, return response. No business logic.
- **Service:** Business logic, database calls, external API calls. Throws exceptions on errors.
- **DTO:** Validation rules for incoming data (`class-validator`).
- **Entity:** Shape of outgoing data (often reuses Prisma types).

---

## 3. Dependency Rule

```
Controller → Service → PrismaService → Database
                          ↓
                    External APIs (Midtrans, etc.)
```

**Strict rules:**
- Controllers **never** call Prisma directly
- Services **never** know about HTTP (no `Request`, `Response`)
- DTOs are input-only, Entities are output-only
- Cross-module access: import other module's **Service** (not Controller)

---

## 4. Authentication Flow

```
┌────────┐         ┌─────────┐         ┌────────┐
│ Mobile │ ──────► │ /auth/  │ ──────► │ bcrypt │
│        │ POST    │ register│ hash    │   +    │
│        │         │         │ ──────► │  JWT   │
│        │ ◄────── │         │ ◄────── │        │
│        │ 201     │         │ tokens  └────────┘
└────────┘         └─────────┘
                        │
                        │ subsequent requests
                        ▼
                 ┌─────────────┐
                 │ JwtAuthGuard │
                 │ (global)     │
                 └─────────────┘
                        │
                        │ if @Roles('ADMIN')
                        ▼
                 ┌─────────────┐
                 │ RolesGuard   │
                 └─────────────┘
                        │
                        ▼
                 ┌─────────────┐
                 │ Controller   │
                 └─────────────┘
```

**Token strategy:**
- **Access token**: 15 min TTL, JWT signed with `JWT_SECRET`, contains `{ sub: userId, role }`
- **Refresh token**: 7 days TTL, opaque random string stored in DB (`RefreshToken` table)
- **Rotation**: Each `/auth/refresh` issues new pair, old refresh token revoked

**Public endpoints opt-out:**
```typescript
@Public()
@Post('login')
async login(@Body() dto: LoginDto) { ... }
```

---

## 5. Error Handling

All errors are converted to a consistent JSON response:

```json
{
  "statusCode": 400,
  "message": "Email sudah terdaftar",
  "error": "Bad Request",
  "details": { "email": ["Email sudah terdaftar"] },
  "timestamp": "2026-06-16T08:30:00.000Z",
  "path": "/api/v1/auth/register"
}
```

**Global exception filter** catches:
- `HttpException` (from controllers/services)
- `PrismaClientKnownRequestError` → 400/404/409 based on error code
- `ValidationPipe` errors → 422 with field details
- Generic `Error` → 500

**Custom exceptions** (in `common/exceptions/`):
- `NotFoundException` → 404 with custom message
- `ConflictException` → 409 (e.g., email already exists)
- `BusinessException` → 400 with code

---

## 6. Database Schema (Prisma)

### 6.1 Entity Relationship Overview

```
User ──┬── 1:N ── Address
       ├── 1:N ── Order
       ├── 1:N ── Review
       ├── 1:N ── Notification
       ├── 1:N ── RefreshToken
       └── 1:N ── WishlistItem ── N:1 ── Product

Category ── 1:N ── Product ── 1:N ── ProductVariant
                       ├── 1:N ── ProductImage
                       └── 1:N ── Review

Order ── 1:N ── OrderItem ── N:1 ── Product
   └── 1:1 ── Payment
   └── N:1 ── Address
```

### 6.2 Key Design Decisions

- **Soft delete:** `User`, `Category`, `Product` have `deletedAt` field. Prisma middleware auto-filters `WHERE deletedAt IS NULL`.
- **Money as num:** All prices stored as `DECIMAL(15,2)` in MySQL, mapped to `Float` in Prisma (for portfolio scope, no need for BigInt precision).
- **Cascading deletes:**
  - Delete `Category` → blocked if has products
  - Delete `Product` → soft delete (preserves order history)
  - Delete `User` → soft delete (preserves audit trail)
  - Delete `Order` → soft delete via `cancelledAt` flag, items preserved

### 6.3 Indexes

```prisma
model User {
  email String @unique  // login lookup
  @@index([role, deletedAt])
  @@index([createdAt])  // for "new customers" stats
}

model Product {
  slug String @unique
  @@index([categoryId, deletedAt])
  @@index([isFeatured, deletedAt])
  @@index([isFlashSale, flashSaleEndsAt])
  @@fulltext([name, description, brand])  // MySQL FULLTEXT
}

model Order {
  orderNumber String @unique
  @@index([userId, createdAt])
  @@index([status, createdAt])
}

model Notification {
  @@index([userId, isRead, createdAt])
}
```

---

## 7. External Integrations

### 7.1 Midtrans Snap

```
┌────────┐                 ┌────────┐                 ┌──────────┐
│ Mobile │ POST           │ API    │ Snap.createTx   │ Midtrans │
│        │ /payments/...  │        │ ──────────────► │ Snap API  │
│        │                │        │ snapToken       │          │
│        │ ◄─────────────│        │ ◄────────────── │          │
│        │ open WebView   │        │                 │          │
│        │ snapToken      │        │                 │          │
│        │                │        │ POST /notification            │
│        │                │        │ ◄────────────── │ webhook  │
│        │                │        │ update order    │          │
└────────┘                 └────────┘                 └──────────┘
```

**Sandbox mode** (default):
- `MIDTRANS_IS_PRODUCTION=false`
- `MIDTRANS_SERVER_KEY=SB-Mid-server-xxx` (sandbox key)
- `MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx`
- Use `https://app.sandbox.midtrans.com/snap/v1/transactions` endpoint

**Production mode** (when user provides real keys):
- `MIDTRANS_IS_PRODUCTION=true`
- Use `https://app.midtrans.com/snap/v1/transactions`

**Webhook signature verification:**
```typescript
import { createHash } from 'crypto';

function verifySignature(notification: any): boolean {
  const { signature_key, order_id, status_code, gross_amount, server_key } = notification;
  const input = `${order_id}${status_code}${gross_amount}${server_key}`;
  const expected = createHash('sha512').update(input).digest('hex');
  return expected === signature_key;
}
```

### 7.2 File Upload (Multer)

```
┌────────┐  multipart    ┌────────┐  write file  ┌──────────┐
│ Admin  │ ────────────► │ API    │ ──────────► │ uploads/ │
│        │ POST /upload  │        │              │ (disk)   │
│        │               │        │ return URL   │          │
│        │ ◄─────────────│        │ ◄─────────── │          │
└────────┘  { url }      └────────┘              └──────────┘
                                                      │
                                                      ▼
                                            served at /uploads/*
```

**Storage strategy:** Local disk for portfolio. Production swap-in: S3/Cloudinary (just change Multer config + serve via CDN).

---

## 8. Request/Response Flow Example

**Endpoint: `GET /products?page=1&limit=20&categoryId=1`**

```
1. Request arrives at Express
2. Helmet middleware adds security headers
3. CORS middleware checks origin
4. Throttler checks rate limit
5. Body parser (no-op for GET)
6. Logging interceptor starts timer
7. JwtAuthGuard validates JWT (or @Public bypass)
8. RolesGuard checks @Roles() if any
9. ValidationPipe validates query DTO (page, limit must be integers)
10. Controller method called with validated DTO
11. Controller calls Service.getProducts(dto)
12. Service builds Prisma query:
    {
      where: { deletedAt: null, categoryId: dto.categoryId, price: { gte, lte }, rating: { gte } },
      skip: (page-1) * limit,
      take: limit,
      orderBy: { ... }
    }
13. Service also fetches total count for pagination meta
14. Prisma executes SQL
15. Service transforms Prisma models to response DTOs (if needed)
16. Service returns `{ data: products, meta: { total, page, limit, totalPages } }`
17. Controller returns the service result
18. Logging interceptor logs: "GET /products 200 45ms user-123"
19. Response sent to client
```

**Total time:** ~50-150ms typical.

---

## 9. Security

- **Passwords:** Bcrypt with cost factor 12 (~250ms to hash)
- **JWT secrets:** Min 32 chars, stored in `.env`, never committed
- **SQL injection:** Prevented by Prisma parameterized queries
- **XSS:** None risk since we only output JSON (no HTML rendering server-side)
- **CSRF:** Not applicable (no cookies, all auth via `Authorization: Bearer`)
- **Rate limiting:** 100 req/min per IP (configurable), stricter on auth endpoints (10/min)
- **CORS:** Whitelist specific origins (mobile app config, admin domain)
- **Helmet:** Sets `X-Content-Type-Options`, `X-Frame-Options`, etc.
- **Input validation:** All DTOs validated with `class-validator` (whitelist strips unknown fields)
- **Midtrans webhook:** Signature verification prevents spoofing

---

## 10. Testing Strategy

| Layer | Test Type | Tool |
|---|---|---|
| Service | Unit | Jest + mock Prisma client |
| Controller | Unit | Jest + mock service |
| Auth flow | E2E | Supertest against real NestJS app |
| Critical paths | E2E | Supertest (auth, orders, payments) |
| Database | Integration | Test DB (separate `DATABASE_URL_TEST`) |

**Test pyramid:** 70% unit, 20% integration, 10% e2e

**Mock strategy:** Prisma client mocked via `jest-mock-extended` for unit tests. Real DB for integration tests.

---

## 11. Deployment (Portfolio Scope)

**Local development:**
```bash
docker compose up -d          # MySQL 8
npm run prisma:migrate        # Apply schema
npm run seed                 # Seed initial data
npm run start:dev            # Server on :3000
```

**Production-ready (not deploying, but architected for):**
- Docker image: `Dockerfile` multi-stage
- Environment: `NODE_ENV=production`, all secrets via env vars
- Process: PM2 or systemd
- Reverse proxy: Nginx with SSL termination
- Database: Managed MySQL (RDS, Cloud SQL, PlanetScale)

---

## 12. Folder Structure

```
j-commerce-api/
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── migrations/              # Migration history
│   └── seed.ts                  # Initial data
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── prisma/                  # Prisma service + middleware
│   ├── common/
│   │   ├── decorators/          # @Public, @CurrentUser, @Roles
│   │   ├── filters/             # Global exception filter
│   │   ├── guards/              # JwtAuthGuard, RolesGuard
│   │   ├── interceptors/        # Logging interceptor
│   │   └── pipes/               # Custom validation pipes
│   ├── config/                  # Env config (typed)
│   └── modules/
│       ├── auth/
│       ├── users/
│       ├── categories/
│       ├── products/
│       ├── orders/
│       ├── payments/
│       └── ...
├── test/
│   ├── unit/                    # *.spec.ts
│   └── e2e/                     # *.e2e-spec.ts
├── docker-compose.yml           # MySQL 8
├── .env.example                 # Sample env vars
├── .gitignore
├── nest-cli.json
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsconfig.test.json
├── eslint.config.mjs
├── .prettierrc
├── README.md
├── FEATURES.md
├── ARCHITECTURE.md
├── STACK.md
└── ROADMAP.md
```
