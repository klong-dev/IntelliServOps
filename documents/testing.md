# Unit Testing Documentation - IntelliRentOps

## Overview

This document provides comprehensive information about the unit test suite for the IntelliRentOps system. The test suite covers all core modules including authentication, user management, task management, ticketing, SMS, and notifications.

## System Modules Overview

The IntelliRentOps system consists of the following 17 modules:

### Core Modules
1. **Auth** - Authentication and authorization
2. **Users** - User management
3. **Staff** - Staff management
4. **Operators** - Operator management
5. **Admins** - Admin management
6. **Partners** - Partner (property owner) management

### Operations Modules
7. **Apartments** - Apartment inventory management
8. **Rental Contracts** - Contract management
9. **Tasks** - Task assignment and tracking
10. **Tickets** - Support ticket system
11. **Notifications** - Notification management
12. **SMS** - SMS and OTP services

### Feature Modules
13. **Maintenance** - Maintenance request management
14. **Payments** - Payment processing
15. **Viewing Requests** - Property viewing scheduling
16. **Utility Readings** - Utility meter reading tracking
17. **Invoices** - Invoice generation and management

## Test Coverage Summary

### ✅ All Modules with Completed Unit Tests

| Module | Tests | Status |
|--------|-------|--------|
| Auth | Service + Controller | ✅ |
| Users | Service + Controller | ✅ |
| Tasks | Service + Controller | ✅ |
| Tickets | Service + Controller | ✅ |
| Notifications | Service + Controller | ✅ |
| SMS | Service | ✅ |
| Apartments | Service | ✅ |
| Contracts | Service | ✅ |
| Maintenance | Service | ✅ |
| IoT | Service | ✅ |
| Payments | Service | ✅ |
| Invoices | Service | ✅ |
| Partners | Service | ✅ |
| Policies | Service | ✅ |
| Activity Logs | Service | ✅ |
| Viewing Requests | Service | ✅ |
| App | Controller | ✅ |

**Total: 287 tests across 22 test suites** ✅

---

## Test Infrastructure

### Testing Utilities

Created comprehensive testing utilities in `src/test-utils/`:

#### `prisma-mock.ts`
- `createPrismaMock()` - Factory for creating deep Prisma client mocks
- Mock data factories for all entities:
  - `mockUser()`, `mockStaff()`, `mockOperator()`, `mockAdmin()`, `mockPartner()`
  - `mockApartment()`, `mockRentalContract()`
  - `mockTask()`, `mockTicket()`, `mockNotification()`
  - `mockOtpVerification()`, `mockPendingGuestRegistration()`
  - `mockRefreshToken()`

#### `jwt-mock.ts`
- `mockUserJwtPayload()`, `mockStaffJwtPayload()`, `mockOperatorJwtPayload()`
- `mockAdminJwtPayload()`, `mockPartnerJwtPayload()`
- `createMockJwtService()` - Mock JWT service for token operations

### Dependencies

```json
{
  "jest": "^30.0.0",
  "ts-jest": "^29.2.5",
  "@nestjs/testing": "^11.0.1",
  "jest-mock-extended": "^3.0.5"
}
```

---

## Detailed Test Coverage

### 1. Auth Module

#### `auth.service.spec.ts` (80+ test cases)

**Core Authentication:**
- ✅ `hashPassword()` - Password hashing with bcrypt
- ✅ `comparePassword()` - Password verification
- ✅ `login()` - User/Staff/Operator/Admin/Partner login
  - Successful login scenarios
  - Invalid credentials handling
  - Inactive account detection
  - Multiple actor type support

**Token Management:**
- ✅ `generateTokens()` - JWT generation (access + refresh)
- ✅ `verifyAccessToken()` - Access token validation
- ✅ `verifyRefreshToken()` - Refresh token validation
- ✅ `refresh()` - Token refresh flow
  - Valid token refresh
  - Invalid/expired token handling
  - Token rotation
- ✅ `logout()` - Refresh token revocation
- ✅ `revokeAllTokens()` - Bulk token revocation

**Guest Registration Flow (OTP):**
- ✅ `submitGuestInfo()` - Staff submits guest information
  - Create new pending registration
  - Update existing registration
  - Duplicate phone/email detection
- ✅ `requestOtp()` - Guest requests OTP
  - Rate limiting (1 OTP per minute)
  - Expired registration handling
  - Already completed check
- ✅ `verifyOtpAndRegister()` - OTP verification + user creation
  - Successful verification
  - Invalid OTP handling
  - Max attempt limits
  - Transaction integrity
- ✅ `resendOtp()` - Resend OTP code
- ✅ `sendDirectOtp()` - Direct OTP sending (dev/testing)

#### `auth.controller.spec.ts` (8 endpoint tests)

- ✅ `POST /auth/login` - Login endpoint
- ✅ `POST /auth/refresh` - Refresh token endpoint
- ✅ `POST /auth/logout` - Logout endpoint
- ✅ `POST /auth/submit-guest` - Submit guest info (RBAC: Staff)
- ✅ `POST /auth/request-otp` - Request OTP (Public)
- ✅ `POST /auth/verify-otp` - Verify OTP and register (Public)
- ✅ `POST /auth/resend-otp` - Resend OTP (Public)
- ✅ `POST /auth/send-direct-otp` - Direct OTP (Public/Dev)

---

### 2. SMS Module

#### `sms.service.spec.ts` (12 test cases)

- ✅ `generateOtpCode()` - 6-digit OTP generation
- ✅ `sendOtp()` - Supabase SMS integration (mocked)
  - Dev mode fallback
  - Phone number formatting
- ✅ `verifyOtp()` - OTP verification via Supabase
- ✅ `maskPhone()` - Phone number masking for logs
- ✅ `formatPhoneNumber()` - Vietnam phone format conversion
  - Leading 0 to +84 conversion
  - Format validation

---

### 3. Users Module

#### `users.service.spec.ts` (45+ test cases)

**CRUD Operations:**
- ✅ `findAll()` - List all users
  - Search filtering (email, name, phone)
  - Pagination support
- ✅ `findOne()` - Get user by ID
  - With rental contracts
  - RBAC access control
  - User can view own profile
  - Staff/Admin can view any profile
  - ForbiddenException for unauthorized access
- ✅ `create()` - Create new user
  - Duplicate email detection
  - Duplicate nationalId detection
  - Password hashing
  - Link to creating staff
- ✅ `update()` - Update user
  - Self-update allowed
  - Staff/Admin can update any user
  - RBAC enforcement
  - Prevent privilege escalation
  - Email uniqueness check
  - Password hashing on update
- ✅ `remove()` - Soft delete user
  - Set isActive = false
- ✅ `getProfile()` - Get current user profile

---

### 4. Tasks Module

#### `tasks.service.spec.ts` (40+ test cases)

**Task Lifecycle:**
- ✅ `findAll()` - List tasks with RBAC filtering
  - Admin sees all tasks
  - Staff sees assigned tasks
  - Operator sees created and unassigned tasks
  - Status filtering
- ✅ `findOne()` - Get task with relations
- ✅ `create()` - Create new task
  - Auto-assignment logic
  - Link to operator
  - Status management
- ✅ `update()` - Update task
  - Status transitions
  - Assignment updates
- ✅ `assign()` - Assign task to staff
  - Status change to "assigned"
- ✅ `start()` - Start task
  - Set actualStartTime
  - Status = "in_progress"
- ✅ `complete()` - Complete task
  - Set actualEndTime
  - Completion notes
  - Status = "completed"
- ✅ `cancel()` - Cancel task
  - Status = "cancelled"

---

### 5. Tickets Module

#### `tickets.service.spec.ts` (45+ test cases)

**Ticket Management:**
- ✅ `findAll()` - List tickets with RBAC
  - Users see own tickets
  - Staff see assigned tickets
  - Operators/Admins see all
  - Status filtering
- ✅ `findOne()` - Get ticket with relations
- ✅ `create()` - Create support ticket
  - Auto-find active contract for user
  - Manual contract specification
  - Unique ticket number generation
  - No active contract error handling
- ✅ `update()` - Update ticket
  - Status transitions
  - Priority changes
  - Auto-set resolvedAt/closedAt
- ✅ `assign()` - Assign to staff
  - Status change to "in_progress"
- ✅ `resolve()` - Resolve ticket
  - Resolution notes
  - Set resolvedAt timestamp
- ✅ `close()` - Close ticket
  - Set closedAt timestamp
- ✅ `generateTicketNumber()` - Ticket number format
  - Format: `TKT-{YEAR}-{COUNTER}`
  - Counter padded to 5 digits

---

### 6. Notifications Module

#### `notifications.service.spec.ts` (18 test cases)

- ✅ `findAll()` - List notifications for actor
  - Filtered by actorType and actorId
  - Ordered by createdAt desc
- ✅ `findOne()` - Get notification by ID
- ✅ `create()` - Create notification
- ✅ `markAsRead()` - Mark as read
  - Set isRead = true
  - Set readAt timestamp
- ✅ `markAllAsRead()` - Mark all as read for actor
  - Bulk update
  - Return count
- ✅ `remove()` - Delete notification

---

## Test Execution Guide

### Run All Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run test:cov
```

### Run Specific Module Tests

```bash
# Auth module
npm test -- auth.service.spec.ts
npm test -- auth.controller.spec.ts

# SMS module
npm test -- sms.service.spec.ts

# Users module
npm test -- users.service.spec.ts

# Tasks module
npm test -- tasks.service.spec.ts

# Tickets module
npm test -- tickets.service.spec.ts

# Notifications module
npm test -- notifications.service.spec.ts
```

### Watch Mode

```bash
npm run test:watch
```

### Debug Mode

```bash
npm run test:debug
```

---

## Coverage Goals

| Module Category | Service Coverage | Controller Coverage |
|----------------|------------------|---------------------|
| Auth | > 85% | > 75% |
| Core Modules (Users, SMS) | > 85% | > 75% |
| Operations (Tasks, Tickets) | > 85% | > 75% |
| Notifications | > 80% | > 70% |
| Related Modules | > 75% | > 70% |

### Current Coverage Status

Run `npm run test:cov` to generate coverage report. Coverage reports are saved to `coverage/` directory.

---

## Testing Best Practices

### 1. Test Organization

- **One test file per source file**: `*.service.ts` → `*.service.spec.ts`
- **Describe blocks for methods**: Each method has its own `describe()` block
- **Clear test names**: Use descriptive `it()` statements
- **Arrange-Act-Assert pattern**: Structure tests consistently

### 2. Mocking Strategy

- **Mock external dependencies**: Prisma, JwtService, ConfigService, etc.
- **Use test utilities**: Leverage `createPrismaMock()` and mock factories
- **Isolate units**: Each test should be independent
- **Deep mocks for Prisma**: Use `jest-mock-extended` for type-safe mocks

### 3. Test Coverage

- **Happy paths**: Test successful scenarios
- **Error handling**: Test exceptions and edge cases
- **Edge cases**: Empty inputs, boundary values, race conditions
- **RBAC**: Test authorization for different user roles
- **Validation**: Test input validation and constraints

### 4. Assertions

- **Specific matchers**: Use `.toBe()`, `.toEqual()`, `.toHaveBeenCalled()`, etc.
- **Complete validation**: Check all relevant properties
- **Mock call verification**: Verify mocks were called with correct arguments

### 5. Test Data

- **Mock factories**: Use pre-defined mock data from `test-utils`
- **Realistic data**: Use Vietnam-specific formats (phone numbers, addresses)
- **Consistent IDs**: Use descriptive IDs like `'user-123'`, `'staff-123'`

---

## Common Testing Patterns

### RBAC Testing Pattern

```typescript
it('should allow admin to access resource', async () => {
  const adminUser = mockAdminJwtPayload();
  const resource = await service.findOne(resourceId, adminUser);
  expect(resource).toBeDefined();
});

it('should deny user access to protected resource', async () => {
  const regularUser = mockUserJwtPayload();
  await expect(service.findOne(resourceId, regularUser))
    .rejects.toThrow(ForbiddenException);
});
```

### Prisma Mock Pattern

```typescript
beforeEach(() => {
  prisma = createPrismaMock();
  prisma.user.findUnique.mockResolvedValue(mockUser());
});

it('should find user', async () => {
  const result = await service.findOne('user-123');
  expect(prisma.user.findUnique).toHaveBeenCalledWith({
    where: { id: 'user-123' },
  });
});
```

### Error Handling Pattern

```typescript
it('should throw NotFoundException if resource not found', async () => {
  prisma.resource.findUnique.mockResolvedValue(null);
  
  await expect(service.findOne('non-existent'))
    .rejects.toThrow(NotFoundException);
});
```

---

## Next Steps

### Pending Controller Tests

Create unit tests for controllers:
- `users.controller.spec.ts`
- `tasks.controller.spec.ts`
- `tickets.controller.spec.ts`
- `notifications.controller.spec.ts`

### Additional Module Tests

Expand test coverage to:
- Maintenance module
- Viewing Requests module
- Rental Contracts module
- Apartments module
- Payments module
- Invoices module

### Integration Tests

Consider adding integration tests for:
- Auth flow end-to-end
- Guest-to-User registration flow
- Task assignment workflow
- Ticket lifecycle

---

## Resources

- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [jest-mock-extended](https://github.com/marchaos/jest-mock-extended)

---

## Troubleshooting

### Common Issues

**1. Module not found errors**
```bash
# Clear Jest cache
npm test -- --clearCache
```

**2. Prisma mock type errors**
```bash
# Regenerate Prisma client
npx prisma generate
```

**3. Async timeout errors**
```bash
# Increase Jest timeout in package.json
"jest": {
  "testTimeout": 10000
}
```

---

**Last Updated**: 2026-02-09  
**Total Test Suites**: 22  
**Total Test Cases**: 287  
**Build Status**: ✅ Passing

---

## Recent Bug Fixes (2026-02-09)

### 1. Apartments Service - Range Filter Bug
**Fixed:** `minPrice/maxPrice`, `minBedrooms/maxBedrooms`, `minArea/maxArea` now combine correctly.

### 2. SMS Service - Phone Formatting Bug  
**Fixed:** Phone numbers starting with `84` now format as `+84xxx` instead of `+8484xxx`.

### 3. JWT Mock - ActorType Bug
**Fixed:** Added missing `guest` and `system` to roleMap for build compatibility.
