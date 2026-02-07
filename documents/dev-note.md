# IntelliRentOps - Developer Notes

## 📋 Tổng Quan Dự Án

**IntelliRentOps** là nền tảng quản lý cho thuê bất động sản toàn diện, kết nối:
- Property owners (Partners)
- Rental operators
- Staff
- Tenants (Users)

Hệ thống bao gồm Web portal, Mobile app, và Admin panel với IoT integration.

---

## 🏗️ Cấu Trúc Thư Mục (NestJS Modular Structure)

```
src/
├── common/                    # Shared components (guards, decorators, enums, filters, pipes)
│   ├── decorators/           # Custom decorators (@Public, @Roles, @CurrentUser)
│   ├── enums/                # Role enums và các enum dùng chung
│   ├── guards/               # JwtAuthGuard, RolesGuard
│   ├── filters/              # Exception filters (TODO)
│   ├── pipes/                # Validation pipes (TODO)
│   └── interceptors/         # Logging, transform interceptors (TODO)
│
├── config/                    # Configuration files
│   ├── app.config.ts         # App general settings
│   ├── database.config.ts    # PostgreSQL settings
│   ├── jwt.config.ts         # JWT authentication
│   ├── redis.config.ts       # Redis caching & queue
│   ├── supabase.config.ts    # Supabase Auth (OTP SMS)
│   ├── payos.config.ts       # PayOS payment gateway
│   └── tuya.config.ts        # Tuya IoT API
│
├── modules/                   # Feature modules (business logic)
│   ├── auth/                 # Authentication module
│   ├── sms/                  # SMS module (Supabase OTP + BullMQ)
│   ├── users/                # User management (TODO)
│   ├── apartments/           # Apartment listings (TODO)
│   ├── contracts/            # Rental contracts (TODO)
│   ├── invoices/             # Billing & invoices (TODO)
│   ├── payments/             # Payment processing (TODO)
│   ├── iot/                  # IoT device control (TODO)
│   ├── maintenance/          # Maintenance requests (TODO)
│   └── tickets/              # Support tickets (TODO)
│
├── prisma/                    # Prisma ORM
│   ├── prisma.module.ts      # PrismaModule (Global)
│   └── prisma.service.ts     # PrismaService
│
├── queue/                     # BullMQ background jobs
│   └── queue.module.ts       # QueueModule với các queues
│
├── redis/                     # Redis caching
│   └── redis.module.ts       # RedisModule với cache-manager
│
├── shared/                    # Shared modules across features
│   └── shared.module.ts      # Tập hợp Prisma, Redis, Queue
│
├── utils/                     # Utility functions
│   ├── generators.util.ts    # UUID, reference number generators
│   └── formatters.util.ts    # Date, currency formatters
│
├── app.module.ts              # Root module
├── app.controller.ts          # Health check endpoints
├── app.service.ts             # App service
└── main.ts                    # Bootstrap (Swagger, ValidationPipe, CORS)
```

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Core | NestJS + TypeScript (strict mode) |
| Database | PostgreSQL 15+ |
| ORM | Prisma |
| Auth | JWT + Passport |
| Authorization | RBAC (Role-Based Access Control) |
| Caching | Redis + cache-manager |
| Queue | BullMQ (background jobs) |
| Payment | PayOS |
| IoT | Tuya API |
| API Docs | Swagger/OpenAPI |
| Deployment | Docker + docker-compose |

---

## 👥 User Roles (RBAC)

```typescript
enum Role {
  GUEST = 'guest',      // Web visitors, browsing only
  USER = 'user',        // Tenants with active contracts
  STAFF = 'staff',      // Technicians, maintenance workers
  OPERATOR = 'operator', // Operations managers
  ADMIN = 'admin',      // System administrators
  PARTNER = 'partner',  // Property owners
}
```

---

## 📌 Coding Conventions

### 1. Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `user-contract.service.ts` |
| Classes | PascalCase | `UserContractService` |
| Methods | camelCase | `findByUserId()` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS` |
| Interfaces | PascalCase với `I` prefix (optional) | `UserPayload` hoặc `IUserPayload` |
| DTOs | PascalCase + Dto suffix | `CreateUserDto` |
| Entities | PascalCase | `RentalContract` |

### 2. Module Structure

Mỗi feature module trong `modules/` nên có cấu trúc:

```
modules/users/
├── dto/                  # Data Transfer Objects
│   ├── create-user.dto.ts
│   └── update-user.dto.ts
├── entities/             # Prisma types/interfaces
├── users.controller.ts   # HTTP endpoints
├── users.service.ts      # Business logic
├── users.module.ts       # Module definition
└── index.ts              # Exports
```

### 3. API Endpoints

- Global prefix: `/api/v1`
- Use RESTful conventions
- Protected routes: Sử dụng `@Roles()` decorator
- Public routes: Sử dụng `@Public()` decorator

### 4. Error Handling

- Sử dụng built-in NestJS exceptions
- Custom exceptions đặt trong `common/exceptions/`
- Response format chuẩn với interceptors

---

## 🔐 Authentication Flow

1. User login → Nhận `accessToken` + `refreshToken`
2. Access token: 7 ngày (JWT)
3. Refresh token: 30 ngày
4. Guard `JwtAuthGuard` verify token tự động
5. `RolesGuard` check quyền dựa trên `@Roles()` decorator

---

## 📊 Database

- Schema file: `prisma/schema.prisma`
- SQL init: `database/init.sql`
- ERD: `database/erd_logical.drawio`

### Migration Commands

```bash
# Generate migration
npx prisma migrate dev --name <migration_name>

# Apply migration
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Reset database
npx prisma migrate reset
```

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run development
npm run start:dev

# Swagger docs
http://localhost:3000/docs
```

---

## 🐳 Docker

```bash
# Start all services (PostgreSQL, Redis, App)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

---

## ⚠️ Lưu Ý Quan Trọng

1. **KHÔNG commit `.env`** - sử dụng `.env.example` làm template
2. **Sử dụng UUID** cho tất cả primary keys
3. **Soft delete** cho User, Staff, Operator, Admin, Partner, Apartment
4. **KHÔNG hard delete** financial records (Invoice, Payment, Contract)
5. **Check contract status** trước khi cho phép IoT device control
6. **Validate payment amount** không vượt quá invoice total
7. **Transaction** khi tạo contract để tránh race condition

---

## 📞 Contacts

- API Docs: http://localhost:3000/docs
- GitHub: https://github.com/klong-dev/IntelliServOps
