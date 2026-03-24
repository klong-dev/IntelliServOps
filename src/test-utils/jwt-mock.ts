import { ActorType } from '@prisma/client';
import { JwtPayload } from '../modules/auth/auth.service';

// Mock JWT payloads for different actor types
export const mockJwtPayload = (
  actorType: ActorType,
  actorId: string,
  email: string,
): JwtPayload => ({
  sub: actorId,
  email,
  role: determineRoleFromActorType(actorType),
  actorType,
  type: 'access',
});

export const mockUserJwtPayload = (
  overrides: Partial<JwtPayload> = {},
): JwtPayload => ({
  sub: 'user-123',
  email: 'user@example.com',
  role: 'user',
  actorType: 'user',
  type: 'access',
  ...overrides,
});

export const mockStaffJwtPayload = (
  overrides: Partial<JwtPayload> = {},
): JwtPayload => ({
  sub: 'staff-123',
  email: 'staff@example.com',
  role: 'staff',
  actorType: 'staff',
  type: 'access',
  ...overrides,
});

export const mockOperatorJwtPayload = (
  overrides: Partial<JwtPayload> = {},
): JwtPayload => ({
  sub: 'operator-123',
  email: 'operator@example.com',
  role: 'operator',
  actorType: 'operator',
  type: 'access',
  ...overrides,
});

export const mockAdminJwtPayload = (
  overrides: Partial<JwtPayload> = {},
): JwtPayload => ({
  sub: 'admin-123',
  email: 'admin@example.com',
  role: 'admin',
  actorType: 'admin',
  type: 'access',
  ...overrides,
});

export const mockRefreshJwtPayload = (
  actorType: ActorType,
  actorId: string,
  email: string,
): JwtPayload => ({
  sub: actorId,
  email,
  role: determineRoleFromActorType(actorType),
  actorType,
  type: 'refresh',
});

// Helper function to determine role from actor type
function determineRoleFromActorType(actorType: ActorType): string {
  const roleMap: Record<ActorType, string> = {
    guest: 'guest',
    user: 'user',
    staff: 'staff',
    operator: 'operator',
    admin: 'admin',
    system: 'system',
  };
  return roleMap[actorType] || 'user';
}

// Mock JWT service methods
export const createMockJwtService = () => ({
  sign: jest.fn((payload) => `mock_token_${payload.sub}`),
  verify: jest.fn((token: string) => {
    if (token.startsWith('mock_token_')) {
      const sub = token.replace('mock_token_', '');
      return mockUserJwtPayload({ sub });
    }
    throw new Error('Invalid token');
  }),
  signAsync: jest.fn((payload) => Promise.resolve(`mock_token_${payload.sub}`)),
  verifyAsync: jest.fn((token: string) => {
    if (token.startsWith('mock_token_')) {
      const sub = token.replace('mock_token_', '');
      return Promise.resolve(mockUserJwtPayload({ sub }));
    }
    return Promise.reject(new Error('Invalid token'));
  }),
});
