# j-commerce-api — Tech Stack

Dokumen ini adalah **satu-satunya sumber kebenaran** untuk semua teknologi, package, dan versi yang dipakai di project `j-commerce-api`.

---

## 1. Runtime

| Item | Versi |
|---|---|
| Node.js | 20 LTS (minimum 18.x) |
| npm | 10.x (or pnpm 9.x / yarn 4.x) |
| TypeScript | `^5.5.0` |
| NestJS | `^10.4.0` |
| MySQL | `8.0+` (running locally via Docker) |

---

## 2. Core Dependencies (production)

| Package | Versi | Fungsi |
|---|---|---|
| `@nestjs/common` | `^10.4.0` | NestJS core |
| `@nestjs/core` | `^10.4.0` | NestJS bootstrap |
| `@nestjs/platform-express` | `^10.4.0` | Express adapter |
| `@nestjs/config` | `^3.2.0` | Environment config |
| `@nestjs/swagger` | `^7.4.0` | OpenAPI / Swagger UI |
| `@nestjs/throttler` | `^6.2.0` | Rate limiting |
| `@nestjs/jwt` | `^10.2.0` | JWT signing/verifying |
| `@nestjs/passport` | `^10.0.3` | Passport integration |
| `@nestjs/mapped-types` | `^2.0.5` | DTO helpers |
| `passport` | `^0.7.0` | Auth strategies |
| `passport-jwt` | `^4.0.1` | JWT strategy |
| `passport-local` | `^1.0.0` | Local strategy (optional) |
| `@prisma/client` | `^5.20.0` | Prisma ORM client |
| `bcrypt` | `^5.1.1` | Password hashing |
| `class-validator` | `^0.14.1` | DTO validation decorators |
| `class-transformer` | `^0.5.1` | Object transformation |
| `multer` | `^1.4.5-lts.1` | File upload handling |
| `midtrans-client` | `^1.4.0` | Midtrans Snap SDK |
| `helmet` | `^7.1.0` | Security headers |
| `cors` | `^2.8.5` | CORS middleware |
| `compression` | `^1.7.4` | Response compression |
| `reflect-metadata` | `^0.2.2` | NestJS metadata |
| `rxjs` | `^7.8.1` | Reactive extensions |
| `uuid` | `^10.0.0` | UUID generation |
| `dotenv` | `^16.4.5` | `.env` loading (dev) |

## 3. Dev Dependencies

| Package | Versi | Fungsi |
|---|---|---|
| `@nestjs/cli` | `^10.4.0` | NestJS CLI (`nest new`, `nest g`) |
| `@nestjs/testing` | `^10.4.0` | NestJS testing utilities |
| `@nestjs/schematics` | `^10.2.0` | Code generation |
| `@types/express` | `^5.0.0` | Express type definitions |
| `@types/jest` | `^29.5.13` | Jest types |
| `@types/node` | `^22.7.0` | Node.js types |
| `@types/bcrypt` | `^5.0.2` | Bcrypt types |
| `@types/multer` | `^1.4.12` | Multer types |
| `@types/uuid` | `^10.0.0` | UUID types |
| `@types/passport-jwt` | `^4.0.1` | Passport JWT types |
| `@types/cors` | `^2.8.17` | CORS types |
| `@types/compression` | `^1.7.5` | Compression types |
| `@types/supertest` | `^6.0.2` | Supertest types |
| `prisma` | `^5.20.0` | Prisma CLI (migrations, generate, seed) |
| `typescript` | `^5.5.0` | TypeScript compiler |
| `ts-node` | `^10.9.2` | TypeScript execution (for prisma seed) |
| `ts-jest` | `^29.2.5` | Jest TypeScript transformer |
| `tsconfig-paths` | `^4.2.0` | Path alias resolution |
| `jest` | `^29.7.0` | Test runner |
| `supertest` | `^7.0.0` | HTTP E2E testing |
| `jest-mock-extended` | `^4.0.0-beta1` | Prisma mocking |
| `eslint` | `^10.5.0` | Linting |
| `@typescript-eslint/eslint-plugin` | `^8.61.1` | TS lint rules |
| `@typescript-eslint/parser` | `^8.61.1` | TS parser |
| `prettier` | `^3.3.3` | Code formatting |

## 4. Environment Variables

```bash
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Database
DATABASE_URL=mysql://root:password@localhost:3306/j_commerce
DATABASE_URL_TEST=mysql://root:password@localhost:3306/j_commerce_test

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your-refresh-token-secret-min-32-chars
REFRESH_TOKEN_EXPIRES_IN=7d

# Midtrans
MIDTRANS_SERVER_KEY=SB-Mid-server-XXXXXXXX
MIDTRANS_CLIENT_KEY=SB-Mid-client-XXXXXXXX
MIDTRANS_IS_PRODUCTION=false

# Upload
UPLOAD_DIR=./uploads
UPLOAD_MAX_SIZE_MB=5

# Rate limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

## 5. Prisma Schema Configuration

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "fullTextIndex"]
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

**Key features used:**
- `previewFeatures = ["fullTextSearch", "fullTextIndex"]` — MySQL FULLTEXT indexes for product search

## 6. Scripts

```json
{
  "scripts": {
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "prisma:studio": "prisma studio",
    "prisma:seed": "ts-node prisma/seed.ts",
    "prisma:reset": "prisma migrate reset --force"
  }
}
```

## 7. TypeScript Configuration

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "paths": {
      "@/*": ["src/*"],
      "@common/*": ["src/common/*"],
      "@modules/*": ["src/modules/*"]
    }
  }
}
```

## 8. Test Configuration

**Unit tests** (`jest.config.js` or in `package.json`):
```json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

**E2E tests** (`test/jest-e2e.json`):
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

## 9. Docker Setup (Development)

`docker-compose.yml`:
```yaml
services:
  mysql:
    image: mysql:8.0
    container_name: j-commerce-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: j_commerce
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
  phpmyadmin:
    image: phpmyadmin:latest
    container_name: j-commerce-phpmyadmin
    restart: unless-stopped
    environment:
      PMA_HOST: mysql
      PMA_PORT: 3306
      PMA_ARBITRARY: 1
    ports:
      - "8080:80"
    depends_on:
      - mysql

volumes:
  mysql_data:
```

## 10. API Documentation

- **Swagger UI:** `http://localhost:3000/api/docs`
- **OpenAPI JSON:** `http://localhost:3000/api/docs-json`
- **Base path:** `/api/v1`
- **Authentication:** `Authorization: Bearer <accessToken>`

## 11. Prinsip Update

1. **Tambah dependency baru?** → Update file ini dulu, baru `package.json`.
2. **Naik versi NestJS?** → Cek [migration guide](https://docs.nestjs.com/migration-guide).
3. **Ganti ORM?** → Diskusikan dulu, baru update `ARCHITECTURE.md` & file ini.
4. **Lock versions in production:** Commit `package-lock.json` ke repo.

## 12. API Base URL

Default base URL: `http://localhost:3000/api/v1`

Configurable via `PORT` env var. Production example: `https://api.jcommerce.com/api/v1`
