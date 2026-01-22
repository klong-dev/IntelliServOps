# IntelliRentOps - Task Notes

## 📋 Mục Đích

File này ghi lại các task đã thực hiện trong dự án để các developer có thể theo dõi tiến độ và hiểu những gì đã được làm.

---

## ✅ Completed Tasks

### Task 1: Database Schema Design
**Ngày:** 2026-01-21  
**Thực hiện bởi:** AI Assistant  

**Mô tả:**
Tạo file SQL khởi tạo database PostgreSQL cho toàn bộ hệ thống IntelliRentOps.

**Chi tiết:**
- Tạo 26 bảng chia thành 9 nhóm:
  - **Actors (6):** Guest, User, Staff, Operator, Admin, Partner
  - **Assets (2):** Apartment, Room
  - **Contracts (2):** RentalContract, UserContractMember
  - **Requests (4):** ContactRequest, BookingRequest, Appointment, PartnerRequest
  - **Operations (3):** Task, MaintenanceRequest, Ticket
  - **Financial (2):** Invoice, Payment
  - **IoT (3):** IoTDevice, UtilityMeter, UtilityReading
  - **Documents (2):** Policy, LegalDocument
  - **Audit (2):** ActivityLog, Notification

- Tạo PostgreSQL ENUM types cho tất cả status/type fields
- Setup foreign keys với cascading rules phù hợp
- Tạo indexes đơn và composite cho tối ưu performance
- Tạo triggers tự động cập nhật `updated_at`
- Thêm comments mô tả cho từng bảng

**Files thay đổi:**
- `database/init.sql` - SQL initialization script

---

### Task 2: ERD Diagram
**Ngày:** 2026-01-21  
**Thực hiện bởi:** AI Assistant  

**Mô tả:**
Tạo Logical ERD diagram dạng draw.io XML.

**Chi tiết:**
- Thiết kế 26 bảng với phân nhóm màu sắc
- Thể hiện quan hệ FK giữa các bảng
- Thêm legend giải thích màu sắc

**Files thay đổi:**
- `database/erd_logical.drawio` - Draw.io ERD diagram

---

### Task 3: NestJS Base Project Setup
**Ngày:** 2026-01-22  
**Thực hiện bởi:** AI Assistant  

**Mô tả:**
Khởi tạo NestJS project với đầy đủ tech stack theo yêu cầu.

**Chi tiết:**
- Tạo NestJS project với TypeScript strict mode
- Cài đặt dependencies:
  - `@prisma/client` - Prisma ORM
  - `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` - JWT Auth
  - `bcrypt` - Password hashing
  - `@nestjs/config` - Configuration management
  - `class-validator`, `class-transformer` - Validation
  - `@nestjs/swagger` - API documentation
  - `@nestjs/cache-manager`, `cache-manager-redis-yet`, `redis` - Redis caching
  - `@nestjs/bullmq`, `bullmq`, `ioredis` - Background jobs
  - `axios` - HTTP client

- Setup modules:
  - `PrismaModule` - Database connection
  - `RedisModule` - Caching với Redis
  - `QueueModule` - BullMQ với 5 queues (email, notification, payment, iot, invoice)
  - `AuthModule` - JWT authentication

- Setup RBAC:
  - `JwtAuthGuard` - Authentication guard
  - `RolesGuard` - Authorization guard
  - `@Public()` decorator - Bypass authentication
  - `@Roles()` decorator - Role-based access
  - `@CurrentUser()` decorator - Get current user

- Configuration files:
  - `app.config.ts` - App settings
  - `database.config.ts` - PostgreSQL
  - `jwt.config.ts` - JWT tokens
  - `redis.config.ts` - Redis connection
  - `payos.config.ts` - PayOS payment
  - `tuya.config.ts` - Tuya IoT API

- Docker:
  - `Dockerfile` - Multi-stage build
  - `docker-compose.yml` - PostgreSQL, Redis, NestJS app
  - `.dockerignore` - Ignore rules

- Swagger documentation tại `/docs`

**Files thay đổi:**
- Tất cả files trong `src/`
- `prisma/schema.prisma`
- `.env`, `.env.example`
- `Dockerfile`, `docker-compose.yml`, `.dockerignore`
- `.gitignore`

**Git:**
- Initial commit pushed to `https://github.com/klong-dev/IntelliServOps.git` (branch: main)

---

### Task 4: Folder Structure Refactoring
**Ngày:** 2026-01-22  
**Thực hiện bởi:** AI Assistant  

**Mô tả:**
Tái cấu trúc thư mục theo NestJS Modular Structure convention (GeeksforGeeks).

**Chi tiết:**
- Áp dụng **Modular Structure** phù hợp với enterprise project

- Cấu trúc mới:
  ```
  src/
  ├── common/           # Shared components
  │   ├── decorators/   # @Public, @Roles, @CurrentUser
  │   ├── enums/        # Role enum
  │   └── guards/       # JwtAuthGuard, RolesGuard
  │
  ├── config/           # Configuration files
  │
  ├── modules/          # Feature modules
  │   └── auth/         # Authentication module
  │       ├── strategies/
  │       ├── auth.module.ts
  │       └── auth.service.ts
  │
  ├── prisma/           # Prisma ORM
  ├── queue/            # BullMQ
  ├── redis/            # Redis caching
  ├── shared/           # SharedModule (Prisma, Redis, Queue)
  ├── utils/            # Helper functions
  │   ├── generators.util.ts
  │   └── formatters.util.ts
  │
  └── app.module.ts     # Root module with new imports
  ```

- Xóa thư mục `src/auth/` cũ (đã di chuyển sang `src/modules/auth/`)
- Cập nhật `AppModule` với import paths mới
- Tạo `SharedModule` để tập hợp infrastructure modules
- Tạo utility functions (generators, formatters)

**Files thay đổi:**
- `src/common/guards/` - Moved from auth
- `src/common/decorators/` - Moved from auth
- `src/modules/auth/` - Auth module mới
- `src/shared/` - SharedModule mới
- `src/utils/` - Utility functions mới
- `src/app.module.ts` - Updated imports
- `src/app.controller.ts` - Updated import paths

---

### Task 5: Documentation
**Ngày:** 2026-01-22  
**Thực hiện bởi:** AI Assistant  

**Mô tả:**
Tạo thư mục `documents/` với dev-note.md và task-note.md.

**Chi tiết:**
- `dev-note.md` - Hướng dẫn đầy đủ cho developers:
  - Cấu trúc thư mục
  - Tech stack
  - Coding conventions
  - Authentication flow
  - Database commands
  - Docker commands
  - Lưu ý quan trọng

- `task-note.md` - Ghi chép các task đã thực hiện (file này)

**Files thay đổi:**
- `documents/dev-note.md`
- `documents/task-note.md`

---

## 🔄 In Progress Tasks

*Chưa có task đang thực hiện*

---

## 📝 Backlog / TODO

### Feature Modules
- [ ] UsersModule - User management
- [ ] ApartmentsModule - Apartment listings
- [ ] ContractsModule - Rental contracts
- [ ] InvoicesModule - Billing & invoices
- [ ] PaymentsModule - Payment processing (PayOS integration)
- [ ] IotModule - IoT device control (Tuya integration)
- [ ] MaintenanceModule - Maintenance requests
- [ ] TicketsModule - Support tickets

### Prisma Schema
- [ ] Define all 26 entity models in Prisma schema
- [ ] Create initial migration
- [ ] Seed database with sample data

### Common Components
- [ ] Exception filters
- [ ] Validation pipes
- [ ] Logging interceptors
- [ ] Response transform interceptors

### Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests

### CI/CD
- [ ] GitHub Actions workflow
- [ ] Staging deployment
- [ ] Production deployment

---

## 📌 Notes

- Khi thêm task mới, copy template bên dưới:

```markdown
### Task X: [Tên Task]
**Ngày:** YYYY-MM-DD  
**Thực hiện bởi:** [Tên]  

**Mô tả:**
[Mô tả ngắn gọn về task]

**Chi tiết:**
- [Chi tiết 1]
- [Chi tiết 2]

**Files thay đổi:**
- `path/to/file1`
- `path/to/file2`
```
