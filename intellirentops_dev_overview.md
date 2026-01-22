# IntelliRentOps - Developer Overview & System Architecture

## 🎯 Executive Summary

**IntelliRentOps** is a comprehensive **property rental management platform** that bridges property owners (partners), rental operators, staff, and tenants through both web and mobile interfaces. Think of it as a combination of Airbnb's listing management + property management software + IoT smart home control + tenant service portal.

### What Problem Does It Solve?

Traditional rental management is fragmented across multiple tools:
- Property listings on separate websites
- Manual contract management in Word/PDF
- Spreadsheets for billing
- WhatsApp/phone for maintenance requests
- Physical keys and access cards

**IntelliRentOps consolidates everything into ONE platform** with automated workflows, IoT integration, and real-time tracking.

---

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     INTELLIRENTOPS PLATFORM                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   WEB APP    │  │  MOBILE APP  │  │  ADMIN PANEL │          │
│  │   (Guest)    │  │   (Tenant)   │  │ (Staff/Ops)  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
│         └──────────────────┼──────────────────┘                  │
│                            │                                      │
│                    ┌───────▼───────┐                             │
│                    │   API LAYER   │                             │
│                    │  (REST/Graph) │                             │
│                    └───────┬───────┘                             │
│                            │                                      │
│         ┌──────────────────┼──────────────────┐                 │
│         │                  │                   │                 │
│    ┌────▼────┐      ┌─────▼─────┐      ┌─────▼─────┐           │
│    │ Auth &  │      │ Business  │      │  Payment  │           │
│    │  RBAC   │      │   Logic   │      │  Gateway  │           │
│    └────┬────┘      └─────┬─────┘      └─────┬─────┘           │
│         │                  │                   │                 │
│         └──────────────────┼───────────────────┘                │
│                            │                                      │
│                    ┌───────▼───────┐                             │
│                    │   DATABASE    │                             │
│                    │  (PostgreSQL) │                             │
│                    └───────┬───────┘                             │
│                            │                                      │
│         ┌──────────────────┼──────────────────┐                 │
│         │                  │                   │                 │
│    ┌────▼────┐      ┌─────▼─────┐      ┌─────▼─────┐           │
│    │  IoT    │      │  Storage  │      │   Queue   │           │
│    │ Devices │      │  (S3/CDN) │      │  (Redis)  │           │
│    └─────────┘      └───────────┘      └───────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👥 User Personas & Their Journeys

### 1. **Guest** (Web Visitor - Pre-Rental)
**Who:** Someone looking for an apartment to rent  
**Platform:** Website  
**Journey:**
```
Browse Listings → View Details → Submit Inquiry (ContactRequest)
     ↓
Operator Contacts → Schedule Viewing (Appointment) → Staff Shows Property
     ↓
Interested? Submit BookingRequest → Background Check → Contract Signing
     ↓
🎉 Becomes "User" with Mobile App Access
```

**Key Features:**
- Browse available apartments with filters (price, location, bedrooms)
- View high-res photos, virtual tours, amenity lists
- Submit contact requests without creating an account
- Read policies and legal documents
- Schedule property viewings

---

### 2. **User** (Tenant - Post-Rental)
**Who:** Active tenant living in a rented apartment  
**Platform:** Mobile App (iOS/Android)  
**Journey:**
```
Move In → Access Mobile App → View Contract & Documents
     ↓
Daily Life: Control Smart Locks/Lights (IoT) → Pay Monthly Rent
     ↓
Issues? Submit Maintenance Request or Support Ticket
     ↓
Move Out → Contract Termination → Final Settlement
```

**Key Features:**
- **Contract Management:** View lease terms, renewal dates, co-tenants
- **Billing & Payments:** View invoices, pay via VNPay/Momo/bank transfer
- **IoT Control:** Lock/unlock smart locks, adjust thermostat, control lights
- **Maintenance:** Report issues with photos, track repair status
- **Support:** Ask questions about billing, documents, or policies
- **Utility Tracking:** View electricity/water consumption in real-time

**Important:** Multiple Users can share one apartment (co-tenants via `UserContractMember`)

---

### 3. **Staff** (Service Personnel)
**Who:** Technicians, customer service, maintenance workers  
**Platform:** Admin Panel (Web) + Mobile App  
**Journey:**
```
Receive Task Assignment from Operator → View Details & Schedule
     ↓
Visit Property for Maintenance/Inspection/Viewing
     ↓
Complete Task → Upload Photos/Notes → Close Task
     ↓
Create New Tenant Accounts (after contract signing)
```

**Key Features:**
- Task management (to-do list with priorities)
- Appointment scheduling with guests
- Maintenance request handling
- Tenant onboarding (create User accounts)
- Time tracking and completion notes

---

### 4. **Operator** (Operations Manager)
**Who:** Coordinates incoming requests and assigns work  
**Platform:** Admin Panel (Web)  
**Journey:**
```
Receive ContactRequests from Website → Review & Qualify Lead
     ↓
Assign Staff for Property Viewing → Monitor Appointment Status
     ↓
Approve BookingRequests → Generate RentalContract
     ↓
Assign Maintenance Tasks to Staff → Track Completion
     ↓
Approve Partner Property Submissions
```

**Key Features:**
- Lead management dashboard (new inquiries, follow-ups)
- Task assignment and delegation to staff
- Booking approval workflow
- Partner property review and approval
- KPI tracking (conversion rates, response times)

---

### 5. **Admin** (System Administrator)
**Who:** Platform administrators with full system access  
**Platform:** Admin Panel (Web)  
**Journey:**
```
Manage User Accounts → Configure System Settings
     ↓
Manage Staff & Operator Accounts → Set Permissions
     ↓
Oversee Apartments & Listings → Approve/Reject
     ↓
View Analytics & Reports → Export Data
     ↓
Manage Policies & Legal Documents
```

**Key Features:**
- Full CRUD on all entities
- Role-based access control (RBAC) configuration
- System-wide analytics and reporting
- Policy and document management
- Audit log viewing

---

### 6. **Partner** (Property Owner)
**Who:** Landlords who want to list their properties  
**Platform:** Partner Portal (Web)  
**Journey:**
```
Register as Partner → Submit Property Details (PartnerRequest)
     ↓
Upload Photos, Documents, Ownership Proof
     ↓
Operator Reviews → Property Inspection → Approval
     ↓
Property Listed → Rental Contract Signed → Revenue Sharing
     ↓
View Rental Income Reports → Receive Payments
```

**Key Features:**
- Property submission with photos and documents
- Revenue dashboard (rental income, commissions)
- Contract and payment history
- Property performance analytics

---

## 🔄 Core Business Workflows

### Workflow 1: Guest to Tenant Conversion
```
┌─────────┐     submit      ┌─────────────────┐
│  Guest  │────────────────▶│ ContactRequest  │
└─────────┘                 └────────┬────────┘
                                     │ receives
                                     ▼
                            ┌─────────────────┐
                            │    Operator     │
                            └────────┬────────┘
                                     │ assigns
                                     ▼
    ┌─────────┐  creates   ┌─────────────────┐
    │  Staff  │◀───────────│      Task       │
    └────┬────┘            └─────────────────┘
         │ schedules
         ▼
┌─────────────────┐   for   ┌─────────┐
│  Appointment    │────────▶│  Guest  │
└─────────────────┘         └─────────┘
         │
         │ interested?
         ▼
┌─────────────────┐  creates  ┌─────────────────┐
│ BookingRequest  │──────────▶│ RentalContract  │
└─────────────────┘           └────────┬────────┘
                                       │ activates
                                       ▼
                              ┌─────────────────┐
                              │      User       │ (NEW ACCOUNT)
                              └─────────────────┘
```

**Key Points:**
- Guest submits inquiry → Operator assigns staff → Viewing scheduled
- If interested → BookingRequest → Background check → Contract created
- Staff authorizes User account → Tenant gets mobile app access
- **Guest record persists** for historical tracking

---

### Workflow 2: Monthly Billing Cycle
```
┌─────────────────┐  generates  ┌─────────────────┐
│ RentalContract  │────────────▶│     Invoice     │
└─────────────────┘             └────────┬────────┘
                                         │
                          ┌──────────────┴──────────────┐
                          │                             │
                   reads from                      includes
                          │                             │
                          ▼                             ▼
                ┌─────────────────┐         ┌─────────────────┐
                │  UtilityMeter   │         │  Additional     │
                │   (readings)    │         │   Charges       │
                └─────────────────┘         └─────────────────┘
                                         
         ┌─────────────────┐
         │      User       │
         └────────┬────────┘
                  │ makes
                  ▼
         ┌─────────────────┐   paid_by   ┌─────────────────┐
         │     Payment     │────────────▶│     Invoice     │
         └─────────────────┘             └─────────────────┘
                                         (status: paid)
```

**Automatic Process:**
1. System generates Invoice on 1st of each month from active RentalContracts
2. Invoice includes: base rent + utility readings + parking/fees
3. User receives notification (push + email)
4. User pays via app → Payment record created
5. Invoice status → 'paid' → Receipt sent

---

### Workflow 3: Maintenance Request Handling
```
┌─────────┐   submits   ┌───────────────────────┐
│  User   │────────────▶│ MaintenanceRequest    │
└─────────┘             └──────────┬────────────┘
                                   │ converted_to
                                   ▼
                        ┌───────────────────────┐
                        │        Task           │
                        └──────────┬────────────┘
                                   │ assigned_to
                                   ▼
                        ┌───────────────────────┐
                        │       Staff           │
                        └──────────┬────────────┘
                                   │ completes
                                   ▼
                        ┌───────────────────────┐
                        │  MaintenanceRequest   │
                        │  (status: completed)  │
                        └───────────────────────┘
```

**Flow:**
1. User reports issue via mobile app (with photos)
2. System creates MaintenanceRequest → auto-creates Task
3. Operator assigns Task to appropriate Staff member
4. Staff visits property → fixes issue → uploads completion photos
5. User receives notification → can rate service

---

### Workflow 4: IoT Device Control
```
┌─────────┐                    ┌─────────────────┐
│  User   │──── has active ───▶│ RentalContract  │
└────┬────┘     contract       └────────┬────────┘
     │                                   │ binds
     │                                   ▼
     │                          ┌─────────────────┐
     │                          │    Apartment    │
     │                          └────────┬────────┘
     │                                   │ equipped_with
     │                                   ▼
     │                          ┌─────────────────┐
     └────── controls ─────────▶│   IoTDevice     │
              (if authorized)   └─────────────────┘
```

**Authorization Logic:**
- User can ONLY control IoT devices in their contracted apartment
- Access granted when RentalContract.status = 'active'
- Access revoked when contract expires/terminates
- Shared apartments: all co-tenants can control devices

---

## 🔐 Security & Access Control

### Role-Based Access Control (RBAC)

| Entity Type | Guest | User | Staff | Operator | Admin | Partner |
|------------|-------|------|-------|----------|-------|---------|
| **Apartment (public)** | Read | Read | Read | Full | Full | Read (own) |
| **Apartment (private)** | ❌ | Read (contracted) | Read | Full | Full | Read (own) |
| **RentalContract** | ❌ | Read (own) | Read (assigned) | Full | Full | ❌ |
| **Invoice** | ❌ | Read (own) | ❌ | Read | Full | ❌ |
| **Payment** | ❌ | Write (own) | Verify | Read | Full | ❌ |
| **IoTDevice** | ❌ | Control (contracted) | Read | Read | Full | ❌ |
| **MaintenanceRequest** | ❌ | Write (own) | Read (assigned) | Full | Full | ❌ |
| **Task** | ❌ | ❌ | Read/Write (assigned) | Full | Full | ❌ |
| **User Accounts** | ❌ | Read (own) | Create | Manage | Full | ❌ |

### Data Protection Measures

**Encryption:**
- All passwords: bcrypt with salt (cost factor 12)
- Sensitive PII: AES-256 encryption at rest
- API communication: TLS 1.3 only
- Payment data: PCI-DSS compliant tokenization

**Privacy:**
- User cannot see other tenants' financial data (even in shared apartments)
- Staff can only access data for assigned tasks
- All access logged in `ActivityLog` table

---

## 💾 Database Design Principles

### Entity Relationship Patterns

**1. Actor Separation (Critical)**
```
Guest ≠ User

Guest = Web visitor (no account, no contract)
User = Active tenant (has contract, mobile app access)

Why separate?
- Different authentication methods
- Different data privacy requirements
- Guest data persists for marketing analytics
- User data has GDPR implications
```

**2. Many-to-Many via Junction Tables**
```
User (N) ←→ UserContractMember (M) ←→ RentalContract (N)

Supports:
- Multiple roommates sharing one apartment
- One person having multiple contracts (over time or different properties)
- Split rent payments by percentage
```

**3. Soft Deletes**
```
Never hard-delete:
- Financial records (audit requirement)
- Contracts (legal requirement)
- Activity logs (compliance)

Soft delete (is_active flag):
- Users, Staff, Operators
- Apartments, Rooms
- IoT Devices
```

**4. Audit Everything**
```
All write operations → ActivityLog
Tracks: who, what, when, where, before/after values

Critical for:
- Debugging production issues
- Security investigations
- Compliance audits
- Dispute resolution
```

---

## 🔧 Technical Stack Recommendations

### Backend
```
Language: Node.js (TypeScript) or Python (FastAPI)
API: REST + GraphQL (for complex queries)
Database: PostgreSQL 15+ with partitioning
Caching: Redis for sessions, rate limiting
Queue: Bull/BullMQ for async tasks
Search: Elasticsearch for apartment listings
```

### Frontend
```
Web (Guest): Next.js 14+ (SSR for SEO)
Admin Panel: React + shadcn/ui
Mobile (User): React Native or Flutter
State: Redux Toolkit or Zustand
```

### Infrastructure
```
Hosting: AWS or GCP
CDN: CloudFlare for static assets
Storage: S3 for images, documents
IoT: AWS IoT Core or custom MQTT broker
Monitoring: DataDog or New Relic
```

### Third-Party Integrations
```
Payment: VNPay, Momo, ZaloPay (Vietnam)
SMS: Twilio or local provider
Email: SendGrid or AWS SES
Maps: Google Maps API
Analytics: Mixpanel or Amplitude
```

---

## 📊 Key Metrics & Analytics

### Business KPIs
- **Conversion Rate:** ContactRequest → BookingRequest → Contract
- **Occupancy Rate:** % of apartments with active contracts
- **Average Revenue per Apartment:** Monthly recurring revenue
- **Maintenance SLA:** Time to resolve issues (target: <24h for urgent)
- **Payment Collection Rate:** % of invoices paid on time

### Technical Metrics
- API response time (p95 < 200ms)
- Mobile app crash rate (<1%)
- Database query performance
- IoT device uptime (>99.5%)

---

## 🚀 Development Phases

### Phase 1: MVP (3 months)
- [ ] Guest web portal (browse + inquiry)
- [ ] Operator dashboard (lead management)
- [ ] Basic contract management
- [ ] Invoice generation
- [ ] Payment processing

### Phase 2: Tenant Mobile (2 months)
- [ ] User authentication
- [ ] Contract viewing
- [ ] Payment in-app
- [ ] Maintenance requests
- [ ] Support tickets

### Phase 3: IoT Integration (2 months)
- [ ] Smart lock integration
- [ ] Utility meter readings
- [ ] Device control UI
- [ ] Access logs

### Phase 4: Advanced Features (3 months)
- [ ] Partner portal
- [ ] Analytics dashboard
- [ ] Automated billing
- [ ] AI chatbot support
- [ ] Predictive maintenance

---

## 🐛 Common Pitfalls to Avoid

### 1. **Don't Mix Guest and User**
```typescript
// ❌ WRONG
if (user.email === guest.email) {
  // Same person?
}

// ✅ CORRECT
// Guest and User are separate entities
// Use contact_request_id to link historical data
```

### 2. **Check Contract Status Before IoT Access**
```typescript
// ❌ WRONG
async function unlockDoor(userId, deviceId) {
  return iotService.unlock(deviceId);
}

// ✅ CORRECT
async function unlockDoor(userId, deviceId) {
  const contract = await getActiveContract(userId);
  if (!contract) throw new ForbiddenError();
  
  const device = await getDevice(deviceId);
  if (device.apartment_id !== contract.apartment_id) {
    throw new ForbiddenError();
  }
  
  return iotService.unlock(deviceId);
}
```

### 3. **Handle Concurrent Apartment Bookings**
```typescript
// ❌ WRONG - Race condition
async function createContract(apartmentId) {
  const apartment = await Apartment.findById(apartmentId);
  if (apartment.status === 'available') {
    // Another request could check here!
    apartment.status = 'occupied';
    await apartment.save();
  }
}

// ✅ CORRECT - Use database transaction
async function createContract(apartmentId) {
  return db.transaction(async (trx) => {
    const apartment = await Apartment.query(trx)
      .findById(apartmentId)
      .forUpdate(); // Row-level lock
    
    if (apartment.status !== 'available') {
      throw new ConflictError('Already booked');
    }
    
    apartment.status = 'occupied';
    await apartment.save(trx);
  });
}
```

### 4. **Validate Payment Amount**
```typescript
// ❌ WRONG
async function processPayment(invoiceId, amount) {
  await Payment.create({ invoice_id: invoiceId, amount });
}

// ✅ CORRECT
async function processPayment(invoiceId, amount) {
  const invoice = await Invoice.findById(invoiceId);
  const totalPaid = await Payment.sum('amount', { invoice_id: invoiceId });
  
  if (totalPaid + amount > invoice.total_amount) {
    throw new ValidationError('Overpayment not allowed');
  }
  
  await Payment.create({ invoice_id: invoiceId, amount });
}
```

---

## 📚 API Endpoint Examples

### Guest Browsing
```http
GET /api/v1/apartments?city=Ho Chi Minh&bedrooms=2&max_price=15000000
Authorization: None (public)

Response:
{
  "data": [
    {
      "id": "apt_123",
      "address": "123 Nguyen Hue, District 1",
      "bedrooms": 2,
      "base_rent_price": 12000000,
      "images": ["url1", "url2"],
      "status": "available"
    }
  ],
  "pagination": { "page": 1, "total": 45 }
}
```

### User Pays Invoice
```http
POST /api/v1/payments
Authorization: Bearer <user_token>

Request:
{
  "invoice_id": "inv_456",
  "amount": 12500000,
  "payment_method": "vnpay",
  "payment_proof_url": "https://..."
}

Response:
{
  "payment_id": "pay_789",
  "status": "completed",
  "transaction_id": "VNP_20240115_123456"
}
```

### User Controls Smart Lock
```http
POST /api/v1/iot/devices/lock_001/unlock
Authorization: Bearer <user_token>

Request:
{
  "duration_seconds": 10
}

Response:
{
  "status": "success",
  "device_id": "lock_001",
  "action": "unlocked",
  "expires_at": "2024-01-15T10:30:10Z"
}
```

---

## 🎓 Onboarding Checklist for New Devs

- [ ] Read this document thoroughly
- [ ] Review ERD diagram (understand entity relationships)
- [ ] Set up local development environment
- [ ] Run database migrations and seed data
- [ ] Review API documentation (Swagger/OpenAPI)
- [ ] Understand authentication flow (JWT + refresh tokens)
- [ ] Review RBAC implementation
- [ ] Test payment gateway in sandbox mode
- [ ] Set up IoT device simulator
- [ ] Join team Slack channels

---

## 📞 Support & Resources

- **API Docs:** https://api.intellirentops.com/docs
- **Design System:** https://design.intellirentops.com
- **Jira Board:** https://intellirentops.atlassian.net
- **Slack:** #dev-backend, #dev-frontend, #dev-mobile
- **On-call:** PagerDuty rotation

---

**Welcome to IntelliRentOps! 🏡 Let's build amazing rental experiences together.**