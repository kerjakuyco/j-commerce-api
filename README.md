# j-commerce-api

Backend API untuk single-store e-commerce — NestJS + Prisma + MySQL. Dipanggil oleh:
- **Mobile app**: [`j-commerce`](https://github.com/...) (Flutter)
- **Admin panel**: [`j-commerce-admin`](https://github.com/...) (Vite + React)

> **Status:** Semua fitur backend di `FEATURES.md` dan `ROADMAP.md` selesai diimplementasikan. Backend belum published.

## Tech Stack

- **NestJS 10** + TypeScript 5 (strict mode)
- **Prisma 5** ORM
- **MySQL 8** (via Docker Compose)
- **Passport JWT** + bcrypt
- **Swagger** untuk OpenAPI docs
- **Midtrans Snap** server-side integration (sandbox)
- **Multer** file upload (local disk)

Lihat [`STACK.md`](./STACK.md) untuk dependency lengkap.

## Architecture

NestJS module pattern dengan Clean Architecture. Setiap feature module (auth, products, orders, dll) terdiri dari:
- Controller (HTTP layer, tipis)
- Service (business logic)
- DTO (validation)
- Prisma model (database)

Lihat [`ARCHITECTURE.md`](./ARCHITECTURE.md) untuk detail.

## Features

50+ REST endpoints di 17 modules. Lihat [`FEATURES.md`](./FEATURES.md).

Highlights:
- **Auth**: Register, login, JWT access + refresh tokens, role-based access (customer/admin)
- **Catalog**: Products dengan variants, images, reviews, search/filter/sort/paginate
- **Cart & Wishlist**: Server-side persistence
- **Orders**: Full lifecycle (PENDING → PAID → PACKED → SHIPPED → DELIVERED, atau CANCELLED)
- **Midtrans Snap**: Server-side token generation + webhook handler
- **Vouchers**: Validation, quota tracking, expiry
- **Dashboard**: Revenue chart, top products, order stats untuk admin

## Project Structure

```
src/
├── main.ts                 # Bootstrap
├── app.module.ts           # Root module
├── prisma/                 # Prisma service
├── common/                 # Shared (decorators, guards, filters, interceptors)
├── config/                 # Env config (typed)
└── modules/
    ├── auth/
    ├── users/
    ├── categories/
    ├── products/
    ├── orders/
    ├── payments/
    └── ... (17 modules total)
prisma/
├── schema.prisma
├── migrations/
└── seed.ts
test/
├── unit/                   # *.spec.ts
└── e2e/                    # *.e2e-spec.ts
docker-compose.yml         # MySQL 8 + phpMyAdmin
```

## Getting Started

### Prerequisites
- Node.js 20 LTS
- Docker + Docker Compose
- npm 10+

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env

# 3. Generate secure JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Paste the output into JWT_SECRET and REFRESH_TOKEN_SECRET in .env

# 4. Start MySQL
docker compose up -d

# 5. Wait for MySQL to be ready (~10s), then run migrations
npm run prisma:migrate

# 6. Seed initial data
npm run prisma:seed

# 7. Start the server
npm run start:dev
```

Server runs on `http://localhost:3000`.

### Access Points

| URL | Purpose |
|---|---|
| `http://localhost:3000/api/v1/*` | REST API |
| `http://localhost:3000/api/docs` | Swagger UI |
| `http://localhost:3000/health` | Health check |
| `http://localhost:8080` | phpMyAdmin (MySQL admin) |
| `http://localhost:5555` | Prisma Studio (run `npm run prisma:studio`) |

### Demo Accounts (after seed)

```
Admin:
  Email:    admin@jcommerce.com
  Password: admin123

Customer:
  Email:    demo@jcommerce.com
  Password: demo1234
```

### Mobile App Integration

Point your Flutter app to this backend:

```bash
# Default (Android emulator → host)
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1

# iOS simulator
flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1

# Real device (replace with your machine's local IP)
flutter run --dart-define=API_BASE_URL=http://192.168.1.100:3000/api/v1
```

## Scripts

| Script | Description |
|---|---|
| `npm run start:dev` | Start dev server with watch |
| `npm run build` | Build for production |
| `npm run start:prod` | Run production build |
| `npm run lint` | Lint + auto-fix |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run prisma:migrate` | Create + apply migration |
| `npm run prisma:seed` | Seed initial data |
| `npm run prisma:reset` | Reset DB + re-seed (destructive) |

## Related Repositories

- **`j-commerce`** (mobile) — published ✅
- **`j-commerce-api`** (this repo) — in development 🚧
- **`j-commerce-admin`** — planned

## License

MIT
