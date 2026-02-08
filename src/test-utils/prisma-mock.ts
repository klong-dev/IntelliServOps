import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Create a deep mock of PrismaClient
export type MockPrisma = DeepMockProxy<PrismaClient>;

export const createPrismaMock = (): MockPrisma => {
  return mockDeep<PrismaClient>();
};

export const resetPrismaMock = (prismaMock: MockPrisma): void => {
  mockReset(prismaMock);
};

// Mock data factories
export const mockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'user@example.com',
  phone: '+84901234567',
  fullName: 'Test User',
  passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz',
  dateOfBirth: new Date('1990-01-01'),
  nationalId: '123456789',
  passportNumber: null,
  profileImageUrl: null,
  emergencyContactName: 'Emergency Contact',
  emergencyContactPhone: '+84909999999',
  isActive: true,
  isVerified: true,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  createdByStaffId: null,
  ...overrides,
});

export const mockStaff = (overrides = {}) => ({
  id: 'staff-123',
  email: 'staff@example.com',
  phone: '+84901234568',
  fullName: 'Test Staff',
  passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz',
  dateOfBirth: new Date('1985-01-01'),
  nationalId: '987654321',
  position: 'Technician',
  roleLevel: 'staff',
  isActive: true,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const mockOperator = (overrides = {}) => ({
  id: 'operator-123',
  email: 'operator@example.com',
  phone: '+84901234569',
  fullName: 'Test Operator',
  passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz',
  dateOfBirth: new Date('1980-01-01'),
  roleLevel: 'operator',
  departmentOrRegion: 'Operations',
  isActive: true,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const mockAdmin = (overrides = {}) => ({
  id: 'admin-123',
  email: 'admin@example.com',
  phone: '+84901234570',
  fullName: 'Test Admin',
  passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz',
  roleLevel: 'admin',
  systemPermissions: ['all'],
  isActive: true,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const mockPartner = (overrides = {}) => ({
  id: 'partner-123',
  email: 'partner@example.com',
  phone: '+84901234571',
  fullName: 'Test Partner',
  passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz',
  companyName: 'Test Company',
  businessLicense: 'BL123456',
  taxCode: 'TAX123',
  isActive: true,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const mockApartment = (overrides = {}) => ({
  id: 'apt-123',
  apartmentNumber: 'A101',
  address: '123 Test Street',
  city: 'Ho Chi Minh',
  district: 'District 1',
  ward: 'Ward 1',
  bedrooms: 2,
  bathrooms: 1,
  area: 75.5,
  baseRentPrice: 10000000,
  status: 'available' as const,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ownedByPartnerId: 'partner-123',
  ...overrides,
});

export const mockRentalContract = (overrides = {}) => ({
  id: 'contract-123',
  contractNumber: 'CNT-2026-00001',
  apartmentId: 'apt-123',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-12-31'),
  monthlyRent: 10000000,
  depositAmount: 20000000,
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const mockTask = (overrides = {}) => ({
  id: 'task-123',
  title: 'Test Task',
  description: 'Test task description',
  taskType: 'maintenance' as const,
  priority: 'medium' as const,
  status: 'pending' as const,
  scheduledDate: new Date(),
  scheduledTime: null,
  estimatedDurationMins: 60,
  actualStartTime: null,
  actualEndTime: null,
  completionNotes: null,
  relatedEntityType: null,
  relatedEntityId: null,
  assignedToStaffId: null,
  assignedByOperatorId: null,
  apartmentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const mockTicket = (overrides = {}) => ({
  id: 'ticket-123',
  ticketNumber: 'TKT-2026-00001',
  subject: 'Test Ticket',
  description: 'Test ticket description',
  category: 'billing' as const,
  priority: 'medium' as const,
  status: 'open' as const,
  userId: 'user-123',
  rentalContractId: 'contract-123',
  assignedToStaffId: null,
  resolutionNotes: null,
  resolvedAt: null,
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const mockNotification = (overrides = {}) => ({
  id: 'notif-123',
  actorType: 'user' as const,
  actorId: 'user-123',
  title: 'Test Notification',
  message: 'Test notification message',
  type: 'info' as const,
  isRead: false,
  readAt: null,
  relatedEntityType: null,
  relatedEntityId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const mockOtpVerification = (overrides = {}) => ({
  id: 'otp-123',
  phone: '+84901234567',
  otpCode: '123456',
  purpose: 'registration' as const,
  expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  attempts: 0,
  isUsed: false,
  usedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const mockPendingGuestRegistration = (overrides = {}) => ({
  id: 'pending-123',
  email: 'guest@example.com',
  phone: '+84901234567',
  fullName: 'Test Guest',
  dateOfBirth: new Date('1995-01-01'),
  nationalId: '111222333',
  status: 'pending' as const,
  submittedByStaffId: 'staff-123',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const mockRefreshToken = (overrides = {}) => ({
  id: 'refresh-123',
  token: 'refresh_token_hash',
  actorType: 'user' as const,
  actorId: 'user-123',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  isRevoked: false,
  createdAt: new Date(),
  ...overrides,
});
