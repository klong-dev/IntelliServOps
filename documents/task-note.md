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

## ✅ Recently Completed

### Task 6: Guest to User Registration Flow with OTP
**Ngày:** 2026-02-07  
**Thực hiện bởi:** AI Assistant  

**Mô tả:**
Implement flow cho Guest đăng ký trở thành User thông qua xác thực OTP SMS.

**Flow:**
1. Guest và Staff thỏa thuận thuê nhà xong
2. Staff submit thông tin Guest lên hệ thống (POST `/auth/submit-guest`)
3. Guest tải app mobile và dùng số điện thoại đã cung cấp để request OTP (POST `/auth/request-otp`)
4. Hệ thống gửi OTP 6 số qua SMS
5. Guest verify OTP và tạo password để hoàn tất đăng ký (POST `/auth/verify-otp`)
6. Sau khi thành công, Guest trở thành User và nhận tokens

**Chi tiết kỹ thuật:**

**1. Prisma Schema Updates:**
- Thêm `OtpVerification` model - lưu trữ OTP codes
- Thêm `PendingGuestRegistration` model - lưu thông tin guest chờ đăng ký
- Thêm enums: `OtpPurpose`, `PendingRegistrationStatus`
- Thêm relation `pendingGuestRegistrations` cho Staff model

**2. SMS Module (`src/modules/sms/`):**
- `SmsService` - generate OTP 6 số, queue SMS gửi đi
- `SmsProcessor` - xử lý background job gửi SMS (BullMQ)
- `SmsModule` - đăng ký queue và export service
- Thêm `SMS` queue vào `QueueModule`

**3. Auth DTOs (`src/modules/auth/dto/`):**
- `SubmitGuestInfoDto` - Staff submit thông tin guest
- `RequestOtpDto` - Guest request OTP
- `VerifyOtpDto` - Guest verify OTP và tạo password

**4. Auth Service Methods:**
- `submitGuestInfo()` - Staff submit thông tin, tạo pending registration
- `requestOtp()` - Validate pending, generate & send OTP
- `verifyOtpAndRegister()` - Verify OTP, create User, return tokens
- `resendOtp()` - Invalidate old OTP, send new one

**5. Auth Controller Endpoints:**
- `POST /auth/submit-guest` - Staff only (protected)
- `POST /auth/request-otp` - Public
- `POST /auth/verify-otp` - Public
- `POST /auth/resend-otp` - Public

**6. Security Features:**
- OTP expires in 5 minutes
- Max 5 failed OTP attempts
- Rate limit: 1 OTP request per minute
- Pending registration expires in 30 days
- Phone number masking in logs

**Files thay đổi:**
- `prisma/schema.prisma` - Added OtpVerification, PendingGuestRegistration models
- `prisma/migrations/20260207054402_add_otp_and_pending_registration/` - Migration
- `src/queue/queue.module.ts` - Added SMS queue
- `src/modules/sms/` - New SMS module (service, processor, module, index)
- `src/modules/auth/dto/` - New DTOs (submit-guest-info, request-otp, verify-otp)
- `src/modules/auth/auth.service.ts` - Added registration flow methods
- `src/modules/auth/auth.controller.ts` - Added new endpoints
- `src/modules/auth/auth.module.ts` - Import SmsModule
- `src/modules/index.ts` - Export SMS module

**Update (2026-02-07): Migrated to Supabase Auth OTP**
- ❌ Removed SpeedSMS and Twilio dependencies
- ✅ Migrated to Supabase Auth for OTP SMS sending
- ✅ `src/config/supabase.config.ts` - New Supabase configuration
- ✅ `src/modules/sms/sms.service.ts` - Rewritten to use `supabase.auth.signInWithOtp()` and `verifyOtp()`
- ✅ Dev mode: OTP logged to console when `SUPABASE_ENABLED=false`
- ✅ Production: Real SMS via Supabase when enabled
- ✅ BullMQ SMS processor re-enabled with Redis connection
- ✅ Deleted `speedsms.config.ts` and `twilio.config.ts`

### Task 7: Redis Connection Status & DevOps Improvements
**Ngày:** 2026-02-07  
**Thực hiện bởi:** AI Assistant  

**Mô tả:**
Thêm Redis connection health check và hiển thị trạng thái trong startup banner.

**Thay đổi:**
1. **Startup Banner Enhancement (`src/main.ts`):**
   - Added Redis connection health check using CacheManager
   - Display connection status: 🟢 Connected / 🔴 Disconnected
   - Show Redis host and port in banner
   - Added debug logging for troubleshooting

2. **Redis Module Fix (`src/redis/redis.module.ts`):**
   - Fixed password handling: empty string → undefined for no-auth Redis
   - Proper Redis client configuration

3. **BullMQ SMS Queue:**
   - Re-enabled `sms.processor.ts` (was commented out)
   - Re-enabled BullMQ imports in `sms.module.ts`
   - SMS queue now functional with Redis connection

4. **App Module:**
   - Uncommented `redisConfig` in ConfigModule load array

**Startup Banner Example:**
```
🏠 IntelliRentOps API is running!
📍 Application: http://localhost:3006/api/v1
📚 Swagger Docs: http://localhost:3006/docs
🔧 Environment: development
💾 Redis: 🟢 Connected (nong-vps:6379)
```

**Files thay đổi:**
- `src/main.ts` - Added Redis health check and status display
- `src/redis/redis.module.ts` - Fixed password handling
- `src/app.module.ts` - Uncommented redisConfig
- `src/modules/sms/sms.processor.ts` - Uncommented (enabled)
- `src/modules/sms/sms.module.ts` - Re-enabled BullMQ imports

---

## 📝 Backlog / TODO

### Feature Modules
- [x] UsersModule - User management
- [x] ApartmentsModule - Apartment listings
- [x] ContractsModule - Rental contracts
- [x] InvoicesModule - Billing & invoices
- [x] PaymentsModule - Payment processing (PayOS integration pending)
- [x] IotModule - IoT device control (Tuya integration pending)
- [x] MaintenanceModule - Maintenance requests
- [x] TicketsModule - Support tickets
- [x] NotificationsModule - Multi-channel notifications
- [x] ViewingRequestsModule - Guest apartment viewing

### Prisma Schema
- [x] Define OTP and PendingGuestRegistration models
- [ ] Define remaining entity models in Prisma schema
- [ ] Seed database with sample data

### Common Components
- [x] Exception filters (HttpExceptionFilter)
- [x] Validation pipes (ValidationPipe)
- [ ] Logging interceptors
- [ ] Response transform interceptors

### Testing
- [x] Unit tests (287 tests, 22 suites)
- [ ] Integration tests
- [ ] E2E tests

### CI/CD
- [ ] GitHub Actions workflow
- [ ] Staging deployment
- [ ] Production deployment

### Pending Integrations
- [ ] PayOS payment gateway integration
- [ ] Tuya IoT API integration
- [ ] Email service (SendGrid/SES)

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
