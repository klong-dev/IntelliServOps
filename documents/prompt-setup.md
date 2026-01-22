# IntelliRentOps - Prompt Setup Context

> **Mục đích:** File này cung cấp context cho AI Assistant trước mỗi session làm việc.  
> **Cách sử dụng:** Copy nội dung file này và paste vào đầu prompt khi bắt đầu session mới.  
> **Cập nhật lần cuối:** 2026-01-22

---

## 🎯 Project Overview

**Tên dự án:** IntelliRentOps  
**Loại:** Property Rental Management Platform  
**Tech Stack:** NestJS + PostgreSQL + Prisma + Redis + BullMQ  
**Repository:** https://github.com/klong-dev/IntelliServOps

---

## 📁 Project Structure

```
IntelliRentOps/
├── src/
│   ├── common/           # Guards, Decorators, Enums, Filters, Pipes
│   ├── config/           # App, Database, JWT, Redis, PayOS, Tuya configs
│   ├── modules/          # Feature modules (auth, users, apartments, etc.)
│   ├── prisma/           # PrismaService, PrismaModule
│   ├── queue/            # BullMQ background jobs
│   ├── redis/            # Redis caching
│   ├── shared/           # SharedModule
│   ├── utils/            # Helper functions
│   └── app.module.ts     # Root module
├── prisma/
│   └── schema.prisma     # Prisma schema (TODO: add entities)
├── database/
│   ├── init.sql          # PostgreSQL initialization
│   └── erd_logical.drawio
├── documents/
│   ├── dev-note.md       # Developer guidelines
│   ├── task-note.md      # Task history
│   └── prompt-setup.md   # This file
└── docker-compose.yml
```

---

## 🔧 Current Tech Stack

| Component | Technology | Status |
|-----------|------------|--------|
| Core | NestJS + TypeScript | ✅ Setup |
| Database | PostgreSQL 15+ | ✅ Docker ready |
| ORM | Prisma | ✅ Configured (entities TODO) |
| Auth | JWT + Passport | ✅ Setup |
| RBAC | Guards + Decorators | ✅ Setup |
| Cache | Redis | ✅ Module ready |
| Queue | BullMQ | ✅ 5 queues configured |
| Payment | PayOS | ⏳ Config ready |
| IoT | Tuya API | ⏳ Config ready |
| Docs | Swagger | ✅ Available at /docs |
| Deploy | Docker | ✅ Configured |

---

## 👥 User Roles (RBAC)

```typescript
enum Role {
  GUEST = 'guest',      // Web visitors
  USER = 'user',        // Tenants
  STAFF = 'staff',      // Employees
  OPERATOR = 'operator', // Managers
  ADMIN = 'admin',      // System admins
  PARTNER = 'partner',  // Property owners
}
```

---

## 📊 Database Entities (26 tables)

**Actors:** Guest, User, Staff, Operator, Admin, Partner  
**Assets:** Apartment, Room  
**Contracts:** RentalContract, UserContractMember  
**Requests:** ContactRequest, BookingRequest, Appointment, PartnerRequest  
**Operations:** Task, MaintenanceRequest, Ticket  
**Financial:** Invoice, Payment  
**IoT:** IoTDevice, UtilityMeter, UtilityReading  
**Documents:** Policy, LegalDocument  
**Audit:** ActivityLog, Notification

---

## ✅ Completed Tasks

1. **Database Schema** - SQL init file với 26 tables, enums, indexes, triggers
2. **ERD Diagram** - draw.io logical ERD
3. **NestJS Base Setup** - Full tech stack, modules, guards, decorators
4. **Folder Restructure** - NestJS Modular Structure convention
5. **Documentation** - dev-note.md, task-note.md, prompt-setup.md

---

## 🔄 Current Phase

**Phase:** MVP Development  
**Focus:** Base infrastructure complete, ready for feature modules

---

## 📝 Next Steps (Backlog)

### Priority 1 - Prisma Entities
- [ ] Define all 26 entity models in `prisma/schema.prisma`
- [ ] Generate migration
- [ ] Seed sample data

### Priority 2 - Core Modules
- [ ] UsersModule (CRUD, profile management)
- [ ] ApartmentsModule (listings, search, filters)
- [ ] ContractsModule (create, manage, terminate)

### Priority 3 - Business Modules
- [ ] InvoicesModule (generate, send)
- [ ] PaymentsModule (PayOS integration)
- [ ] MaintenanceModule (requests, assign tasks)
- [ ] TicketsModule (support system)

### Priority 4 - Advanced
- [ ] IotModule (Tuya integration)
- [ ] NotificationsModule (email, push, SMS)
- [ ] AnalyticsModule (reports, dashboards)

---

## 🚀 Quick Commands

```bash
# Development
npm run start:dev

# Swagger
http://localhost:3000/docs

# Database
npx prisma generate
npx prisma migrate dev --name <name>

# Docker
docker-compose up -d
```

---

## ⚠️ Important Notes

1. **Convention:** NestJS Modular Structure (GeeksforGeeks)
2. **Naming:** kebab-case files, PascalCase classes, camelCase methods
3. **Auth:** JWT with access (7d) + refresh (30d) tokens
4. **Soft Delete:** Use `is_active` flag, NEVER hard delete financial records
5. **UUID:** All entities use UUID primary keys

---

## 📎 Key Files to Reference

- `documents/dev-note.md` - Full developer guidelines
- `documents/task-note.md` - Detailed task history
- `database/init.sql` - Database schema SQL
- `intellirentops_dev_overview.md` - Business requirements
- `intellirentops_db_schema.md` - Entity specifications

---

## 💬 Session Start Template

Khi bắt đầu session mới, có thể sử dụng prompt:

```
@prompt-setup.md Đọc file context này.

[Yêu cầu cụ thể của bạn ở đây]
```

---

*File này được cập nhật sau mỗi milestone quan trọng của dự án.*
