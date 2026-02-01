# IntelliRentOps - Task Plan

> **Mục đích:** File này mô tả chi tiết kế hoạch thực hiện dự án, giúp AI Assistant hoặc developers hiểu được tiến độ và tiếp tục công việc từ bất kỳ điểm dừng nào.  
> **Cập nhật lần cuối:** 2026-02-01

---

## 📊 Tổng Quan Dự Án

### Mô Tả
IntelliRentOps là nền tảng quản lý cho thuê bất động sản với:
- Web portal cho Guest (tìm kiếm căn hộ)
- Mobile app cho User (tenant - thanh toán, IoT control)
- Admin panel cho Staff/Operator/Admin
- Partner portal cho Property owners

### Tech Stack
- **Backend:** NestJS + TypeScript (strict mode)
- **Database:** PostgreSQL 15+ với Prisma ORM
- **Auth:** JWT + Passport với RBAC
- **Cache:** Redis + cache-manager
- **Queue:** BullMQ
- **Payment:** PayOS
- **IoT:** Tuya API
- **Docs:** Swagger/OpenAPI

---

## 🏗️ Kiến Trúc Hệ Thống

### Multi-Tenant Architecture
Dự án sử dụng **Shared Database with Tenant ID** pattern:
- Tất cả actors (User, Staff, Operator, Admin, Partner) chia sẻ cùng database
- Sử dụng `tenant_id` hoặc relation keys để isolate data
- RBAC guards kiểm soát access theo role

### RBAC Model
```
Role Hierarchy: ADMIN > OPERATOR > STAFF > USER > GUEST
                PARTNER (separate branch)

Access Control:
- @Roles('admin') - Chỉ admin
- @Roles('admin', 'operator') - Admin hoặc operator
- @Public() - Không cần authentication
```

---

## 📋 Kế Hoạch Thực Hiện

### Phase 1: Planning & Architecture ✅
**Trạng thái:** HOÀN THÀNH

| Task | Mô tả | Trạng thái |
|------|-------|------------|
| 1.1 | Đọc hiểu documentation | ✅ Done |
| 1.2 | Phân tích schema với real-world scenarios | ✅ Done |
| 1.3 | Tạo task-plan.md | ✅ Done |
| 1.4 | Tạo system-architecture.md | 🔄 In Progress |

---

### Phase 2: Prisma Schema & Entities
**Trạng thái:** CHƯA BẮT ĐẦU

#### 2.1 Enums Definition
```prisma
// Các enums cần tạo:
- PreferredContactMethod, StaffRole, OperatorShift, AdminRoleLevel
- FurnishingStatus, ApartmentStatus, RoomType, RoomStatus
- ContractStatus, ContractMemberType, ContractAccessLevel
- ContactRequestStatus, ContactRequestSource, BookingRequestStatus
- AppointmentType, AppointmentStatus, AppointmentOutcome
- PartnerRequestStatus, PartnerPropertyType, PartnerContractType
- TaskType, TaskPriority, TaskStatus
- MaintenanceCategory, MaintenanceUrgency, MaintenanceStatus, CostCoverage
- TicketCategory, TicketPriority, TicketStatus
- InvoiceStatus, PaymentMethod, PaymentStatus
- IoTDeviceType, IoTDeviceStatus, UtilityMeterType, UtilityMeterStatus
- UtilityReadingType, PolicyType, LegalDocumentType
- ActivityLogActorType, ActivityLogStatus
- NotificationRecipientType, NotificationType, NotificationChannel, DeliveryStatus
```

#### 2.2 Entity Models
Thứ tự tạo theo dependency:

**Level 1 (No dependencies):**
- Guest, Admin

**Level 2 (Actors with minimal deps):**
- Staff, Operator, Partner

**Level 3 (Core entities):**
- User (depends on Staff for created_by)
- Policy, LegalDocument (depends on Admin)

**Level 4 (Assets):**
- Apartment (depends on Partner, Operator)
- Room (depends on Apartment)

**Level 5 (Contracts):**
- RentalContract (depends on Apartment, Staff)
- UserContractMember (depends on User, RentalContract)

**Level 6 (Requests):**
- ContactRequest (depends on Guest, Apartment, Operator)
- BookingRequest (depends on Guest, Apartment, ContactRequest, Operator, RentalContract)
- Appointment (depends on Guest, Apartment, ContactRequest, Staff)
- PartnerRequest (depends on Partner, Operator)

**Level 7 (Operations):**
- Task (depends on Staff, Operator, Apartment)
- MaintenanceRequest (depends on User, RentalContract, Apartment, Room, Task)
- Ticket (depends on User, RentalContract, Staff)

**Level 8 (Financial):**
- Invoice (depends on RentalContract)
- Payment (depends on Invoice, User, Staff)

**Level 9 (IoT):**
- IoTDevice (depends on Apartment, Room)
- UtilityMeter (depends on Apartment)
- UtilityReading (depends on UtilityMeter, RentalContract, Staff)

**Level 10 (Audit):**
- ActivityLog (standalone, polymorphic reference)
- Notification (standalone, polymorphic reference)

#### 2.3 Migration
```bash
npx prisma migrate dev --name init_all_entities
npx prisma generate
```

**Commit:** `feat(prisma): add all 26 entity models`

---

### Phase 3: Core Modules

#### 3.1 Auth Module Enhancement
**File Structure:**
```
src/modules/auth/
├── dto/
│   ├── login.dto.ts
│   ├── register.dto.ts
│   └── refresh-token.dto.ts
├── strategies/
│   └── jwt.strategy.ts (existing)
├── auth.controller.ts (NEW)
├── auth.service.ts (enhance)
└── auth.module.ts (existing)
```

**Endpoints:**
- `POST /auth/login` - Login cho tất cả actor types
- `POST /auth/register` - Register User (Guest → User flow)
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Invalidate refresh token

**Commit:** `feat(auth): implement login/register for all actor types`

#### 3.2 Users Module
**File Structure:**
```
src/modules/users/
├── dto/
│   ├── create-user.dto.ts
│   └── update-user.dto.ts
├── users.controller.ts
├── users.service.ts
├── users.module.ts
└── index.ts
```

**Endpoints:**
- `GET /users` - List users (Admin/Operator only)
- `GET /users/:id` - Get user detail
- `POST /users` - Create user (Staff authorized)
- `PATCH /users/:id` - Update user
- `DELETE /users/:id` - Soft delete user (Admin only)

**Commit:** `feat(users): add user management module`

#### 3.3 Apartments Module
```
src/modules/apartments/
├── dto/
│   ├── create-apartment.dto.ts
│   ├── update-apartment.dto.ts
│   └── search-apartment.dto.ts
├── apartments.controller.ts
├── apartments.service.ts
├── apartments.module.ts
└── index.ts
```

**Endpoints:**
- `GET /apartments` - Public listing với filters
- `GET /apartments/:id` - Apartment detail
- `POST /apartments` - Create (Partner/Admin)
- `PATCH /apartments/:id` - Update
- `POST /apartments/:id/approve` - Operator approve

**Commit:** `feat(apartments): add apartment management module`

#### 3.4 Contracts Module
```
src/modules/contracts/
├── dto/
├── contracts.controller.ts
├── contracts.service.ts
├── contracts.module.ts
└── index.ts
```

**Commit:** `feat(contracts): add contract management module`

---

### Phase 4: Business Modules

| Module | Priority | Dependencies |
|--------|----------|--------------|
| InvoicesModule | P1 | Contracts |
| PaymentsModule | P1 | Invoices, PayOS config |
| MaintenanceModule | P2 | Contracts, Tasks |
| TicketsModule | P2 | Contracts |
| IoTModule | P3 | Contracts, Tuya config |

---

### Phase 5: Common Components

| Component | Mô tả |
|-----------|-------|
| HttpExceptionFilter | Xử lý exceptions, format response |
| ValidationPipe | Validate DTOs |
| LoggingInterceptor | Log requests/responses |
| TransformInterceptor | Chuẩn hóa response format |

---

## 🔍 Schema Analysis - Real-World Validation

### Phân Tích Schema Hiện Tại

#### ✅ Điểm Mạnh
1. **Actor Separation:** Tách biệt Guest và User đúng chuẩn
2. **Junction Table:** UserContractMember hỗ trợ nhiều tenant trong 1 căn hộ
3. **Soft Delete:** Có is_active flag cho các entity quan trọng
4. **Audit Trail:** ActivityLog và Notification đầy đủ

#### ⚠️ Cần Bổ Sung/Điều Chỉnh

1. **Refresh Token Storage:**
   - Cần thêm bảng `RefreshToken` hoặc field `refresh_token_hash` cho mỗi actor
   - Hoặc lưu trong Redis với TTL

2. **Password Reset:**
   - Cần thêm `password_reset_token`, `password_reset_expires` cho actors

3. **Apartment Availability Check:**
   - Cần trigger/logic đảm bảo chỉ 1 active contract per apartment

4. **Multi-image Handling:**
   - `images` field dạng JSON, cần cân nhắc tách thành bảng `ApartmentImage`

5. **Tenant Organization (Optional):**
   - Nếu cần multi-tenant SaaS, cần thêm `Organization` entity
   - Hiện tại schema phù hợp cho single-tenant operation

---

## 🚀 Cách Tiếp Tục Từ File Này

### Nếu Chưa Hoàn Thành Phase Hiện Tại:
1. Đọc section Phase tương ứng
2. Kiểm tra Task nào có trạng thái 🔄 hoặc ⏳
3. Thực hiện task đó theo mô tả

### Nếu Bắt Đầu Phase Mới:
1. Đánh dấu Phase trước là ✅
2. Bắt đầu từ task 1 của Phase mới
3. Commit sau mỗi milestone như đã định

### Commands Thường Dùng:
```bash
# Development
npm run start:dev

# Prisma
npx prisma generate
npx prisma migrate dev --name <name>
npx prisma studio

# Git
git add .
git commit -m "feat(module): description"
git push origin main
```

---

## 📝 Commit Convention

Format: `<type>(<scope>): <subject>`

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Code restructuring
- `test` - Adding tests
- `chore` - Maintenance

**Examples:**
```
feat(prisma): add all 26 entity models
feat(auth): implement login/register for all actor types
feat(users): add user management module
fix(auth): handle expired refresh token
docs(readme): update API documentation
```

---

*File này được cập nhật sau mỗi milestone. Luôn kiểm tra section "Current Progress" để biết trạng thái hiện tại.*
