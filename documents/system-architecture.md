# IntelliRentOps - System Architecture

> **Version:** 1.0  
> **Cập nhật lần cuối:** 2026-02-01  
> **Tác giả:** AI Assistant

---

## 📊 Tổng Quan Kiến Trúc

IntelliRentOps sử dụng **Clean Architecture** kết hợp với **NestJS Modular Structure**, tích hợp **Multi-Tenant RBAC** cho phép quản lý nhiều loại actors với quyền hạn riêng biệt.

---

## 🏛️ Multi-Tenant Architecture

### Mô Hình Được Chọn: **Shared Database with Discriminator**

```
┌─────────────────────────────────────────────────────────────┐
│                      SINGLE DATABASE                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   PostgreSQL                          │  │
│  │                                                       │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │  │
│  │  │  Guest  │  │  User   │  │  Staff  │  │ Partner │ │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │  │
│  │                                                       │  │
│  │  ┌──────────────────────────────────────────────────┐│  │
│  │  │            Shared Resources                      ││  │
│  │  │  - Apartments (owned_by Partner)                 ││  │
│  │  │  - Contracts (linked to Apartment + User)       ││  │
│  │  │  - Invoices/Payments (linked to Contract)       ││  │
│  │  └──────────────────────────────────────────────────┘│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Lý Do Chọn Mô Hình Này

| Tiêu chí | Shared Database | Separate Database | Shared Schema |
|----------|-----------------|-------------------|---------------|
| Chi phí | ✅ Thấp | ❌ Cao | ✅ Thấp |
| Phức tạp | ✅ Vừa phải | ❌ Cao | ❌ Rất cao |
| Data isolation | ✅ RBAC based | ✅ Physical | ❌ Row-level |
| Cross-tenant queries | ✅ Dễ dàng | ❌ Khó | ❌ Phức tạp |
| Phù hợp use case | ✅ Rental Ops | ❌ Enterprise SaaS | ❌ Large scale |

**Kết luận:** IntelliRentOps là single-instance operation platform nên Shared Database with RBAC là lựa chọn tối ưu.

---

## 🔐 Role-Based Access Control (RBAC)

### Actor Types & Hierarchy

```
                          ┌─────────┐
                          │  ADMIN  │
                          │ (Super) │
                          └────┬────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         ┌────┴────┐     ┌─────┴─────┐    ┌────┴────┐
         │OPERATOR │     │   ADMIN   │    │ PARTNER │
         │(Manager)│     │ (Regular) │    │ (Owner) │
         └────┬────┘     └───────────┘    └─────────┘
              │
         ┌────┴────┐
         │  STAFF  │
         │(Worker) │
         └────┬────┘
              │
         ┌────┴────┐
         │  USER   │
         │(Tenant) │
         └────┬────┘
              │
         ┌────┴────┐
         │  GUEST  │
         │(Visitor)│
         └─────────┘
```

### Permission Matrix

| Resource | GUEST | USER | STAFF | OPERATOR | ADMIN | PARTNER |
|----------|-------|------|-------|----------|-------|---------|
| **Apartments (Public)** | R | R | R | CRUD | CRUD | R (own) |
| **Apartments (Private)** | ❌ | R (contracted) | R | CRUD | CRUD | R (own) |
| **RentalContract** | ❌ | R (own) | R (assigned) | RU | CRUD | ❌ |
| **Invoice** | ❌ | R (own) | ❌ | R | CRUD | ❌ |
| **Payment** | ❌ | CRU (own) | R | R | CRUD | ❌ |
| **IoTDevice** | ❌ | Control (contracted) | R | R | CRUD | ❌ |
| **MaintenanceRequest** | ❌ | CRU (own) | RU (assigned) | CRUD | CRUD | ❌ |
| **Task** | ❌ | ❌ | RU (assigned) | CRUD | CRUD | ❌ |
| **Ticket** | ❌ | CRU (own) | RU (assigned) | CRUD | CRUD | ❌ |
| **User Accounts** | ❌ | R (self) | C (authorized) | RU | CRUD | ❌ |
| **Staff Accounts** | ❌ | ❌ | R (self) | RU | CRUD | ❌ |
| **Partner Properties** | ❌ | ❌ | ❌ | R | CRUD | CRUD (own) |

### RBAC Implementation

```typescript
// 1. Role Enum (Existing)
enum Role {
  GUEST = 'guest',
  USER = 'user',
  STAFF = 'staff',
  OPERATOR = 'operator',
  ADMIN = 'admin',
  PARTNER = 'partner',
}

// 2. Guards Flow
Request → JwtAuthGuard → RolesGuard → Handler

// 3. Decorators Usage
@Controller('apartments')
export class ApartmentsController {
  
  @Get()
  @Public() // No auth required
  findAll() {}
  
  @Post()
  @Roles(Role.ADMIN, Role.PARTNER) // Only admin or partner
  create() {}
  
  @Post(':id/approve')
  @Roles(Role.OPERATOR, Role.ADMIN) // Only operator or admin
  approve() {}
}

// 4. Resource-Level Access
// Check ownership in service layer
async findContract(id: string, user: JwtPayload) {
  const contract = await this.prisma.rentalContract.findUnique({
    where: { id },
    include: { members: true }
  });
  
  if (user.role === Role.USER) {
    const isMember = contract.members.some(m => m.userId === user.sub);
    if (!isMember) throw new ForbiddenException();
  }
  
  return contract;
}
```

---

## 🏗️ System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Controllers │  │   Swagger    │  │ Exception Filter │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      APPLICATION LAYER                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Services   │  │    Guards    │  │   Interceptors   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                       DOMAIN LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Entities   │  │     DTOs     │  │      Enums       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE LAYER                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────┐ │
│  │ Prisma  │ │  Redis  │ │ BullMQ  │ │  PayOS  │ │ Tuya  │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Module Structure

```
src/
├── common/                      # Cross-cutting concerns
│   ├── decorators/             # @Public, @Roles, @CurrentUser
│   ├── enums/                  # Role enum, shared enums
│   ├── guards/                 # JwtAuthGuard, RolesGuard
│   ├── filters/                # HttpExceptionFilter
│   ├── interceptors/           # LoggingInterceptor, TransformInterceptor
│   └── pipes/                  # ValidationPipe customization
│
├── config/                      # Configuration
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── jwt.config.ts
│   ├── redis.config.ts
│   ├── payos.config.ts
│   └── tuya.config.ts
│
├── modules/                     # Feature modules
│   ├── auth/                   # Authentication
│   │   ├── dto/
│   │   ├── strategies/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   │
│   ├── actors/                 # Actor management
│   │   ├── users/              # Tenant management
│   │   ├── staff/              # Staff management
│   │   ├── operators/          # Operator management
│   │   ├── admins/             # Admin management
│   │   └── partners/           # Partner management
│   │
│   ├── apartments/             # Property management
│   ├── rooms/                  # Room management
│   ├── contracts/              # Contract & membership
│   ├── requests/               # Contact, Booking, Appointment
│   ├── operations/             # Tasks, Maintenance, Tickets
│   ├── financial/              # Invoices, Payments
│   ├── iot/                    # IoT devices, Utility meters
│   ├── documents/              # Policies, Legal docs
│   └── notifications/          # Notification system
│
├── prisma/                      # Database ORM
│   ├── prisma.module.ts
│   └── prisma.service.ts
│
├── queue/                       # Background jobs
│   ├── processors/
│   └── queue.module.ts
│
├── redis/                       # Caching
│   └── redis.module.ts
│
├── shared/                      # Shared infrastructure
│   └── shared.module.ts
│
├── utils/                       # Utilities
│   ├── generators.util.ts
│   └── formatters.util.ts
│
├── app.module.ts
├── app.controller.ts
├── app.service.ts
└── main.ts
```

---

## 🔄 Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                       │
└─────────────────────────────────────────────────────────────┘

1. Login Request
   ┌────────┐  POST /auth/login   ┌────────────┐
   │ Client │ ────────────────── │ AuthController │
   └────────┘  {email, password}  └──────┬─────┘
                                          │
                                          ▼
   ┌─────────────────────────────────────────────────────────┐
   │                    AuthService.login()                   │
   │  1. Find actor by email in all actor tables             │
   │  2. Verify password with bcrypt                         │
   │  3. Generate access token (JWT, 7d)                     │
   │  4. Generate refresh token (JWT, 30d)                   │
   │  5. Store refresh token hash in Redis/DB                │
   └───────────────────────────┬─────────────────────────────┘
                               │
                               ▼
   ┌────────┐  {accessToken,   ┌────────────┐
   │ Client │ ◀──refreshToken} │ AuthController │
   └────────┘                  └────────────┘

2. Protected Request
   ┌────────┐  GET /users       ┌────────────┐
   │ Client │ ─────────────── │   Guards    │
   └────────┘  Bearer token     └──────┬─────┘
                                       │
       ┌───────────────────────────────┴───────────────────┐
       ▼                                                   ▼
   ┌─────────────┐                                ┌─────────────┐
   │JwtAuthGuard │                                │ RolesGuard  │
   │ - Validate JWT                               │ - Check role│
   │ - Extract payload                            │ - @Roles()  │
   └──────┬──────┘                                └──────┬──────┘
          │                                              │
          └───────────────────┬──────────────────────────┘
                              ▼
                        ┌───────────┐
                        │  Handler  │
                        └───────────┘

3. Token Refresh
   ┌────────┐  POST /auth/refresh  ┌────────────┐
   │ Client │ ──────────────────  │ AuthController │
   └────────┘  {refreshToken}      └──────┬─────┘
                                          │
                                          ▼
   ┌─────────────────────────────────────────────────────────┐
   │                  AuthService.refresh()                   │
   │  1. Verify refresh token signature                      │
   │  2. Check if token exists in Redis/DB                   │
   │  3. Generate new access token                           │
   │  4. (Optional) Rotate refresh token                     │
   └───────────────────────────┬─────────────────────────────┘
                               ▼
   ┌────────┐  {accessToken}   ┌────────────┐
   │ Client │ ◀────────────── │ AuthController │
   └────────┘                  └────────────┘
```

---

## 💾 Data Flow: Guest to Tenant Conversion

```
┌─────────────────────────────────────────────────────────────┐
│              GUEST TO TENANT CONVERSION FLOW                 │
└─────────────────────────────────────────────────────────────┘

    ┌─────────┐
    │  GUEST  │
    │(Browser)│
    └────┬────┘
         │ 1. Browse apartments
         ▼
    ┌─────────────┐
    │ Public API  │ GET /apartments
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ Guest Submit│ POST /contact-requests
    │   Inquiry   │ {name, email, phone, apartment_id}
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐                    ┌──────────┐
    │ContactRequest│◀─────receives────│ Operator │
    │   (new)     │                    └────┬─────┘
    └─────────────┘                          │ 2. Reviews & assigns
                                             ▼
    ┌─────────────┐                    ┌──────────┐
    │    Task     │◀─────creates──────│ Operator │
    │ (followup)  │                    └──────────┘
    └──────┬──────┘
           │ assigned_to
           ▼
    ┌─────────────┐
    │    Staff    │ 3. Schedules viewing
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ Appointment │ POST /appointments
    │(scheduled)  │ {guest_id, apartment_id, date, time}
    └──────┬──────┘
           │ 4. Viewing completed
           ▼
    ┌─────────────┐
    │BookingRequest│ POST /booking-requests
    │  (created)  │ {guest_id, apartment_id, documents}
    └──────┬──────┘
           │ 5. Approved by Operator
           ▼
    ┌─────────────────────────────────────────────┐
    │              Transaction Block              │
    │  1. Create RentalContract (active)          │
    │  2. Update Apartment (occupied)             │
    │  3. Create User account (Staff authorized)  │
    │  4. Create UserContractMember (primary)     │
    │  5. Send welcome email + app credentials    │
    └──────────────────┬──────────────────────────┘
                       │
                       ▼
    ┌─────────────┐
    │    USER     │ 🎉 Now has mobile app access
    │  (tenant)   │
    └─────────────┘
```

---

## 📊 Database Entity Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                   ENTITY RELATIONSHIP DIAGRAM               │
└─────────────────────────────────────────────────────────────┘

                    ACTORS
    ┌───────────────────────────────────────┐
    │                                       │
    │  ┌─────────┐         ┌─────────┐     │
    │  │  Guest  │         │  Admin  │     │
    │  └────┬────┘         └────┬────┘     │
    │       │                   │          │
    │       │ creates           │ manages  │
    │       ▼                   ▼          │
    │  ┌─────────┐         ┌─────────┐     │
    │  │Contact  │         │ Policy  │     │
    │  │Request  │         │         │     │
    │  └────┬────┘         └─────────┘     │
    │       │                              │
    │       │ leads_to                     │
    │       ▼                              │
    │  ┌─────────┐         ┌─────────┐     │
    │  │Booking  │         │  Staff  │     │
    │  │Request  │────────▶│         │     │
    │  └────┬────┘ assigned└────┬────┘     │
    │       │                   │          │
    │       │ creates           │ creates  │
    │       ▼                   ▼          │
    │  ┌─────────┐         ┌─────────┐     │
    │  │Rental   │◀────────│  User   │     │
    │  │Contract │ member  │(Tenant) │     │
    │  └────┬────┘         └────┬────┘     │
    │       │                   │          │
    │       │ belongs_to        │ owns     │
    │       ▼                   ▼          │
    │  ┌─────────┐         ┌─────────┐     │
    │  │Apartment│◀────────│ Partner │     │
    │  │         │ owned   │         │     │
    │  └────┬────┘         └─────────┘     │
    │       │                              │
    │       │ has                          │
    │       ▼                              │
    │  ┌─────────┐  ┌─────────┐ ┌────────┐│
    │  │  Room   │  │IoTDevice│ │Utility ││
    │  │         │  │         │ │Meter   ││
    │  └─────────┘  └─────────┘ └────────┘│
    └───────────────────────────────────────┘

                   OPERATIONS
    ┌───────────────────────────────────────┐
    │                                       │
    │  User ─────▶ MaintenanceRequest       │
    │       │                  │            │
    │       │                  ▼            │
    │       │              Task ◀── Operator│
    │       │                  │            │
    │       │                  ▼            │
    │       │              Staff            │
    │       │                               │
    │       └────▶ Ticket ────▶ Staff       │
    │                                       │
    └───────────────────────────────────────┘

                   FINANCIAL
    ┌───────────────────────────────────────┐
    │                                       │
    │  RentalContract                       │
    │       │                               │
    │       ▼                               │
    │   Invoice (monthly)                   │
    │       │                               │
    │       ▼                               │
    │   Payment ◀───── User                 │
    │                                       │
    └───────────────────────────────────────┘
```

---

## 🔒 Security Considerations

### 1. Authentication Security
- **Password hashing:** bcrypt with cost factor 12
- **JWT secret:** Minimum 256-bit key from environment
- **Token storage:** httpOnly cookies for web, secure storage for mobile
- **Refresh token rotation:** New refresh token on each use

### 2. Authorization Security
- **Role validation:** Server-side only, never trust client
- **Resource ownership:** Always verify ownership in service layer
- **Principle of least privilege:** Default deny, explicit allow

### 3. Data Protection
- **Sensitive fields encrypted:** national_id, passport_number, bank_account
- **PII masking in logs:** Never log passwords, tokens, or PII
- **Audit trail:** All mutations logged in ActivityLog

### 4. API Security
- **Rate limiting:** Redis-based rate limiter per IP/user
- **Input validation:** class-validator on all DTOs
- **CORS:** Whitelist allowed origins
- **Helmet:** Security headers enabled

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION STACK                          │
└─────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │  CloudFlare │ CDN + WAF
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Nginx     │ Load Balancer
                    │   (HTTPS)   │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐
    │ NestJS  │      │ NestJS  │      │ NestJS  │
    │  App 1  │      │  App 2  │      │  App 3  │
    └────┬────┘      └────┬────┘      └────┬────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
         ┌─────────────────┼────────────────┐
         │                 │                │
    ┌────▼────┐      ┌────▼────┐     ┌─────▼─────┐
    │PostgreSQL│      │  Redis  │     │  BullMQ   │
    │(Primary) │      │ Cluster │     │  Workers  │
    └─────────┘      └─────────┘     └───────────┘
         │
    ┌────▼────┐
    │PostgreSQL│
    │(Replica) │
    └─────────┘
```

---

## 📋 Implementation Checklist

### Phase 1: Core Setup ✅
- [x] NestJS project initialization
- [x] Prisma configuration
- [x] JWT + Passport setup
- [x] RBAC guards and decorators
- [x] Redis and BullMQ modules

### Phase 2: Entities
- [ ] All enums in Prisma
- [ ] All 26 entity models
- [ ] Relations and indexes
- [ ] Initial migration

### Phase 3: Core Modules
- [ ] Enhanced Auth module
- [ ] Users module
- [ ] Apartments module
- [ ] Contracts module

### Phase 4: Business Modules
- [ ] Financial modules
- [ ] Operations modules
- [ ] IoT module

### Phase 5: Advanced
- [ ] Notification system
- [ ] Analytics dashboard
- [ ] API rate limiting
- [ ] Full audit logging

---

*Tài liệu này mô tả kiến trúc tổng thể của IntelliRentOps. Xem thêm chi tiết implementation trong task-plan.md.*
