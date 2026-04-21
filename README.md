# IntelliRentOps

> Hệ thống quản lý cho thuê căn hộ thông minh với tích hợp IoT và thanh toán trực tuyến.

## 🚀 Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | NestJS (TypeScript) |
| **Database** | PostgreSQL + Prisma ORM |
| **Auth** | JWT (Access + Refresh Token) |
| **Queue** | BullMQ + Redis |
| **IoT** | MQTT board/device integration + IoT service layer |
| **Payments** | PayOS |
| **SMS** | Twilio integration (module present, not active in `AppModule`) |
| **Storage** | Supabase |
| **Docs** | Swagger/OpenAPI |

---

## 📦 Active Modules

The list below reflects modules currently imported by `src/app.module.ts`.

| Module | Description |
|--------|-------------|
| `auth` | JWT authentication, OTP verification, multi-actor login |
| `users` | User management and profiles |
| `apartments` | Apartment listings, partner cooperation flow, search, filters |
| `amenities` | Amenity catalog management |
| `apartment-policies` | Apartment-level policy assignment and retrieval |
| `user-apartments` | Occupancy assignments between users and apartments |
| `viewing-requests` | Guest/contact to viewing appointment flow |
| `reservations` | Reservation lifecycle before contract conversion |
| `contracts` | Rental contract lifecycle and PDF generation |
| `invoices` | Invoice generation and billing |
| `payments` | Payment processing and reconciliation |
| `revenue` | Revenue reporting and partner payout views |
| `maintenance` | Maintenance request tracking and task handling |
| `iot` | Smart board/device management and utility meter readings |
| `notifications` | In-app and push notification orchestration |
| `activity-logs` | Audit logging |
| `chat` | Conversation and message history |

Notes:

- `src/modules/sms` exists in the repository but is not currently imported into `AppModule`.
- Class diagram sources are documented in `documents/class-diagram-index.md`.

---

## ⚡ Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database and API keys

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development server
npm run start:dev
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov
```

**Test Stats:** 287 tests across 22 suites ✅

---

## 📝 API Documentation

Swagger UI available at: `http://localhost:3000/api/docs`

---

## 🔐 Authentication

Multi-actor JWT authentication với 6 actor types:
- `user` - Tenants
- `staff` - Field staff
- `operator` - Customer service
- `admin` - System administrators
- `partner` - Property owners
- `guest` - Unauthenticated visitors

**Token Flow:**
1. Login → Access Token (15min) + Refresh Token (7d)
2. Access Token expired → Use Refresh Token to get new pair
3. Refresh Token expired → Re-login required

---

## 📁 Project Structure

```
src/
├── common/           # Guards, decorators, enums, filters
├── config/           # App configuration
├── modules/          # Feature modules
│   ├── auth/
│   ├── users/
│   ├── apartments/
│   ├── contracts/
│   ├── invoices/
│   ├── payments/
│   ├── maintenance/
│   ├── tickets/
│   ├── tasks/
│   ├── iot/
│   ├── notifications/
│   ├── viewing-requests/
│   ├── partners/
│   ├── policies/
│   ├── activity-logs/
│   └── sms/
├── prisma/           # Database service
└── test-utils/       # Testing utilities
```

---

## 🛠 Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Development với hot reload |
| `npm run build` | Production build |
| `npm run start:prod` | Run production |
| `npm test` | Run unit tests |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |

---

## 📄 Documentation

Xem thêm tài liệu chi tiết trong thư mục `/documents`:
- `dev-note.md` - Developer guidelines
- `flows.md` - Business flows
- `main-flow.md` - Core user journeys
- `testing.md` - Testing guidelines

---

## License

MIT
