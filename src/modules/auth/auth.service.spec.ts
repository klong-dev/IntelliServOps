import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActorType } from '@prisma/client';
import { LoginActorType } from './dto';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock crypto
jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mock-uuid-token'),
}));

// Mock global fetch for Google OAuth
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = {
    id: 'user-id-1',
    email: 'test@example.com',
    fullName: 'Test User',
    passwordHash: 'hashed_password',
    isActive: true,
    phone: '0901234567',
    supabaseId: null,
    isVerified: false,
    lastLoginAt: null,
  };

  const mockStaff = {
    id: 'staff-id-1',
    email: 'test@example.com',
    fullName: 'Test Staff',
    passwordHash: 'hashed_password',
    isActive: true,
    role: 'staff',
  };

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    staff: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    operator: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    admin: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    partner: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'jwt.secret': 'test-secret',
        'jwt.refreshSecret': 'test-refresh-secret',
        'jwt.expiresIn': '1h',
        'jwt.refreshExpiresIn': '30d',
        'supabase.url': 'https://test.supabase.co',
        'supabase.anonKey': 'test-anon-key',
        'supabase.redirectUrl': 'http://localhost:3000/auth/callback',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default: jwtService.sign returns mock tokens
    mockJwtService.sign
      .mockReturnValueOnce('mock-access-token')
      .mockReturnValueOnce('mock-refresh-token');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==========================================================================
  // Login
  // ==========================================================================
  describe('login', () => {
    it('should login a user with valid credentials', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: true }) // findAllRolesForEmail
        .mockResolvedValueOnce(mockUser); // findActorByType
      mockPrisma.staff.findUnique.mockResolvedValueOnce(null);
      mockPrisma.operator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admin.findUnique.mockResolvedValueOnce(null);
      mockPrisma.partner.findUnique.mockResolvedValueOnce(null);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});
      mockPrisma.user.update.mockResolvedValueOnce({});

      const result = await service.login({
        identifier: 'test@example.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.actorType).toBe(ActorType.user);
      expect(result.user.availableRoles).toContain(ActorType.user);
      expect(result.tokens).toBeDefined();
    });

    it('should throw UnauthorizedException for non-existent email', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.staff.findUnique.mockResolvedValueOnce(null);
      mockPrisma.operator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admin.findUnique.mockResolvedValueOnce(null);
      mockPrisma.partner.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({ identifier: 'nonexistent@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: true })
        .mockResolvedValueOnce(mockUser);
      mockPrisma.staff.findUnique.mockResolvedValueOnce(null);
      mockPrisma.operator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admin.findUnique.mockResolvedValueOnce(null);
      mockPrisma.partner.findUnique.mockResolvedValueOnce(null);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.login({ identifier: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should login with a specific actorType', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.staff.findUnique
        .mockResolvedValueOnce({ id: true })
        .mockResolvedValueOnce(mockStaff);
      mockPrisma.operator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admin.findUnique.mockResolvedValueOnce(null);
      mockPrisma.partner.findUnique.mockResolvedValueOnce(null);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});

      const result = await service.login({
        identifier: 'test@example.com',
        password: 'password123',
        actorType: LoginActorType.STAFF,
      });

      expect(result.user.actorType).toBe(ActorType.staff);
      expect(result.user.availableRoles).toContain(ActorType.staff);
    });

    it('should throw when requested actorType is not available', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: true });
      mockPrisma.staff.findUnique.mockResolvedValueOnce(null);
      mockPrisma.operator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admin.findUnique.mockResolvedValueOnce(null);
      mockPrisma.partner.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({
          identifier: 'test@example.com',
          password: 'password123',
          actorType: LoginActorType.ADMIN,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return multiple availableRoles for multi-role account', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: true })
        .mockResolvedValueOnce(mockUser);
      mockPrisma.staff.findUnique.mockResolvedValueOnce({ id: true });
      mockPrisma.operator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admin.findUnique.mockResolvedValueOnce(null);
      mockPrisma.partner.findUnique.mockResolvedValueOnce(null);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});
      mockPrisma.user.update.mockResolvedValueOnce({});

      const result = await service.login({
        identifier: 'test@example.com',
        password: 'password123',
      });

      expect(result.user.availableRoles).toContain(ActorType.user);
      expect(result.user.availableRoles).toContain(ActorType.staff);
      expect(result.user.availableRoles).toHaveLength(2);
    });

    it('should throw for social-login-only account (no password)', async () => {
      const oauthUser = { ...mockUser, passwordHash: null };
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: true })
        .mockResolvedValueOnce(oauthUser);
      mockPrisma.staff.findUnique.mockResolvedValueOnce(null);
      mockPrisma.operator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admin.findUnique.mockResolvedValueOnce(null);
      mockPrisma.partner.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({ identifier: 'test@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for deactivated account', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: true })
        .mockResolvedValueOnce(inactiveUser);
      mockPrisma.staff.findUnique.mockResolvedValueOnce(null);
      mockPrisma.operator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admin.findUnique.mockResolvedValueOnce(null);
      mockPrisma.partner.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({ identifier: 'test@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should login with phone number (0xx format)', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce({ id: true }) // findAllRolesForPhone
        .mockResolvedValueOnce(mockUser); // findActorByTypeAndPhone
      mockPrisma.staff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.operator.findFirst.mockResolvedValueOnce(null);
      mockPrisma.admin.findFirst.mockResolvedValueOnce(null);
      mockPrisma.partner.findFirst.mockResolvedValueOnce(null);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});
      mockPrisma.user.update.mockResolvedValueOnce({});

      const result = await service.login({
        identifier: '0901234567',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.actorType).toBe(ActorType.user);
    });

    it('should login with phone number (+84 format)', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce({ id: true })
        .mockResolvedValueOnce(mockUser);
      mockPrisma.staff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.operator.findFirst.mockResolvedValueOnce(null);
      mockPrisma.admin.findFirst.mockResolvedValueOnce(null);
      mockPrisma.partner.findFirst.mockResolvedValueOnce(null);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});
      mockPrisma.user.update.mockResolvedValueOnce({});

      const result = await service.login({
        identifier: '+84901234567',
        password: 'password123',
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.actorType).toBe(ActorType.user);
    });

    it('should throw for non-existent phone number', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      mockPrisma.staff.findFirst.mockResolvedValueOnce(null);
      mockPrisma.operator.findFirst.mockResolvedValueOnce(null);
      mockPrisma.admin.findFirst.mockResolvedValueOnce(null);
      mockPrisma.partner.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.login({ identifier: '0999999999', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ==========================================================================
  // Register
  // ==========================================================================
  describe('register', () => {
    it('should register a new user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});

      const result = await service.register({
        email: 'new@example.com',
        fullName: 'New User',
        password: 'password123',
      });

      expect(result.user.role).toBe('user');
      expect(result.user.actorType).toBe(ActorType.user);
      expect(result.user.availableRoles).toEqual([ActorType.user]);
      expect(result.tokens).toBeDefined();
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'new@example.com',
          fullName: 'New User',
          passwordHash: 'hashed_password',
        }),
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          fullName: 'Test',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if phone already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUser);

      await expect(
        service.register({
          email: 'new@example.com',
          fullName: 'Test',
          password: 'password123',
          phone: '0901234567',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should register without phone (optional)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce({
        ...mockUser,
        phone: null,
      });
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});

      const result = await service.register({
        email: 'new@example.com',
        fullName: 'New User',
        password: 'password123',
      });

      expect(result.user).toBeDefined();
    });
  });

  // ==========================================================================
  // Google OAuth
  // ==========================================================================
  describe('googleAuth', () => {
    const supabaseUser = {
      id: 'supabase-id',
      email: 'google@example.com',
      user_metadata: {
        full_name: 'Google User',
        avatar_url: 'https://avatar.example.com/pic.jpg',
      },
    };

    it('should create a new user via Google OAuth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(supabaseUser),
      });

      const createdUser = {
        id: 'new-user-id',
        email: 'google@example.com',
        fullName: 'Google User',
        supabaseId: 'supabase-id',
        isActive: true,
        isVerified: true,
      };
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // user doesn't exist
        .mockResolvedValueOnce({ id: true }); // findAllRolesForEmail
      mockPrisma.user.create.mockResolvedValueOnce(createdUser);
      mockPrisma.staff.findUnique.mockResolvedValueOnce(null);
      mockPrisma.operator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admin.findUnique.mockResolvedValueOnce(null);
      mockPrisma.partner.findUnique.mockResolvedValueOnce(null);
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});
      mockPrisma.user.update.mockResolvedValueOnce({});

      const result = await service.googleAuth({
        accessToken: 'valid-google-token',
      });

      expect(result.user.email).toBe('google@example.com');
      expect(result.user.actorType).toBe(ActorType.user);
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should login existing user via Google OAuth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(supabaseUser),
      });

      const existingUser = {
        ...mockUser,
        email: 'google@example.com',
        supabaseId: 'supabase-id',
      };
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(existingUser) // user exists
        .mockResolvedValueOnce({ id: true }); // findAllRolesForEmail
      mockPrisma.staff.findUnique.mockResolvedValueOnce(null);
      mockPrisma.operator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admin.findUnique.mockResolvedValueOnce(null);
      mockPrisma.partner.findUnique.mockResolvedValueOnce(null);
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});
      mockPrisma.user.update.mockResolvedValueOnce({});

      const result = await service.googleAuth({
        accessToken: 'valid-google-token',
      });

      expect(result.user.email).toBe('google@example.com');
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should link supabaseId if user exists without it', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(supabaseUser),
      });

      const existingUserNoSupabase = {
        ...mockUser,
        email: 'google@example.com',
        supabaseId: null,
      };
      const updatedUser = {
        ...existingUserNoSupabase,
        supabaseId: 'supabase-id',
      };
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(existingUserNoSupabase)
        .mockResolvedValueOnce({ id: true });
      mockPrisma.user.update
        .mockResolvedValueOnce(updatedUser) // supabaseId link
        .mockResolvedValueOnce({}); // lastLogin
      mockPrisma.staff.findUnique.mockResolvedValueOnce(null);
      mockPrisma.operator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admin.findUnique.mockResolvedValueOnce(null);
      mockPrisma.partner.findUnique.mockResolvedValueOnce(null);
      mockPrisma.refreshToken.create.mockResolvedValueOnce({});

      await service.googleAuth({ accessToken: 'valid-google-token' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: existingUserNoSupabase.id },
        data: { supabaseId: 'supabase-id' },
      });
    });

    it('should throw UnauthorizedException for invalid Supabase token', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(
        service.googleAuth({ accessToken: 'invalid-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException if Supabase not configured', async () => {
      const originalGet = mockConfigService.get;
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'supabase.url' || key === 'supabase.anonKey') return null;
        return originalGet(key);
      });

      await expect(
        service.googleAuth({ accessToken: 'any-token' }),
      ).rejects.toThrow(BadRequestException);

      mockConfigService.get = originalGet;
    });
  });

  // ==========================================================================
  // Forgot Password
  // ==========================================================================
  describe('forgotPassword', () => {
    it('should return a message even for non-existent email', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.staff.findUnique.mockResolvedValueOnce(null);
      mockPrisma.operator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admin.findUnique.mockResolvedValueOnce(null);
      mockPrisma.partner.findUnique.mockResolvedValueOnce(null);

      const result = await service.forgotPassword({
        email: 'nonexistent@example.com',
      });

      expect(result.message).toContain('password reset link');
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('should create a reset token for existing email', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: true });
      mockPrisma.staff.findUnique.mockResolvedValueOnce(null);
      mockPrisma.operator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admin.findUnique.mockResolvedValueOnce(null);
      mockPrisma.partner.findUnique.mockResolvedValueOnce(null);
      mockPrisma.passwordResetToken.updateMany.mockResolvedValueOnce({});
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce({});

      const result = await service.forgotPassword({
        email: 'test@example.com',
      });

      expect(result.message).toContain('password reset link');
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          token: 'mock-uuid-token',
        }),
      });
    });

    it('should invalidate previous reset tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: true });
      mockPrisma.staff.findUnique.mockResolvedValueOnce(null);
      mockPrisma.operator.findUnique.mockResolvedValueOnce(null);
      mockPrisma.admin.findUnique.mockResolvedValueOnce(null);
      mockPrisma.partner.findUnique.mockResolvedValueOnce(null);
      mockPrisma.passwordResetToken.updateMany.mockResolvedValueOnce({});
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce({});

      await service.forgotPassword({ email: 'test@example.com' });

      expect(mockPrisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com', isUsed: false },
        data: { isUsed: true },
      });
    });
  });

  // ==========================================================================
  // Reset Password
  // ==========================================================================
  describe('resetPassword', () => {
    const validResetToken = {
      id: 'token-id-1',
      email: 'test@example.com',
      token: 'valid-token',
      isUsed: false,
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
    };

    it('should reset password with a valid token', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce(
        validResetToken,
      );

      mockPrisma.$transaction.mockImplementationOnce(
        async (cb: (tx: any) => Promise<any>) => {
          const tx = {
            passwordResetToken: { update: jest.fn() },
            user: {
              findUnique: jest.fn().mockResolvedValue(mockUser),
              update: jest.fn(),
            },
            staff: { findUnique: jest.fn().mockResolvedValue(null) },
            operator: { findUnique: jest.fn().mockResolvedValue(null) },
            admin: { findUnique: jest.fn().mockResolvedValue(null) },
            partner: { findUnique: jest.fn().mockResolvedValue(null) },
          };
          return cb(tx);
        },
      );

      const result = await service.resetPassword({
        token: 'valid-token',
        newPassword: 'newpassword123',
      });

      expect(result.message).toContain('reset successfully');
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.resetPassword({
          token: 'invalid-token',
          newPassword: 'newpassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for already used token', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce({
        ...validResetToken,
        isUsed: true,
      });

      await expect(
        service.resetPassword({
          token: 'used-token',
          newPassword: 'newpassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired token', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValueOnce({
        ...validResetToken,
        expiresAt: new Date(Date.now() - 3600000),
      });

      await expect(
        service.resetPassword({
          token: 'expired-token',
          newPassword: 'newpassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // Change Password
  // ==========================================================================
  describe('changePassword', () => {
    it('should change password for a user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockPrisma.user.update.mockResolvedValueOnce({});
      mockPrisma.refreshToken.updateMany.mockResolvedValueOnce({});

      const result = await service.changePassword(
        'user-id-1',
        ActorType.user,
        { currentPassword: 'oldpass', newPassword: 'newpass123' },
      );

      expect(result.message).toContain('Password changed');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id-1' },
        data: { passwordHash: 'hashed_password' },
      });
    });

    it('should throw NotFoundException for non-existent actor', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.changePassword('nonexistent', ActorType.user, {
          currentPassword: 'old',
          newPassword: 'new123456',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException for wrong current password', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.changePassword('user-id-1', ActorType.user, {
          currentPassword: 'wrongpass',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException for social login accounts', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        passwordHash: null,
      });

      await expect(
        service.changePassword('user-id-1', ActorType.user, {
          currentPassword: 'anything',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should revoke all tokens after password change', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockPrisma.user.update.mockResolvedValueOnce({});
      mockPrisma.refreshToken.updateMany.mockResolvedValueOnce({});

      await service.changePassword('user-id-1', ActorType.user, {
        currentPassword: 'oldpass',
        newPassword: 'newpass123',
      });

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          actorId: 'user-id-1',
          actorType: ActorType.user,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should change password for staff actor type', async () => {
      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockPrisma.staff.update.mockResolvedValueOnce({});
      mockPrisma.refreshToken.updateMany.mockResolvedValueOnce({});

      const result = await service.changePassword(
        'staff-id-1',
        ActorType.staff,
        { currentPassword: 'oldpass', newPassword: 'newpass123' },
      );

      expect(result.message).toContain('Password changed');
      expect(mockPrisma.staff.update).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Refresh Token
  // ==========================================================================
  describe('refresh', () => {
    it('should refresh tokens with a valid refresh token', async () => {
      mockJwtService.verify.mockReturnValueOnce({
        sub: 'user-id-1',
        email: 'test@example.com',
        role: 'user',
        actorType: ActorType.user,
        type: 'refresh',
      });

      mockPrisma.refreshToken.findFirst.mockResolvedValueOnce({
        id: 'token-id',
        token: 'valid-refresh-token',
      });

      mockPrisma.$transaction.mockResolvedValueOnce([]);

      const result = await service.refresh('valid-refresh-token');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockJwtService.verify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refresh('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ==========================================================================
  // Logout
  // ==========================================================================
  describe('logout', () => {
    it('should revoke the refresh token', async () => {
      mockJwtService.verify.mockReturnValueOnce({
        sub: 'user-id-1',
        type: 'refresh',
      });
      mockPrisma.refreshToken.updateMany.mockResolvedValueOnce({});

      await service.logout('valid-refresh-token');

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('should not throw for invalid token during logout', async () => {
      mockJwtService.verify.mockImplementationOnce(() => {
        throw new Error('Invalid');
      });

      await expect(service.logout('invalid-token')).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // Token Generation
  // ==========================================================================
  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      const tokens = service.generateTokens({
        sub: 'user-id-1',
        email: 'test@example.com',
        role: 'user',
        actorType: ActorType.user,
      });

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // Revoke All Tokens
  // ==========================================================================
  describe('revokeAllTokens', () => {
    it('should revoke all tokens for an actor', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 3 });

      await service.revokeAllTokens('user-id-1', ActorType.user);

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          actorId: 'user-id-1',
          actorType: ActorType.user,
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  // ==========================================================================
  // Supabase Config
  // ==========================================================================
  describe('getSupabaseUrl', () => {
    it('should return full Google OAuth URL', () => {
      const result = service.getSupabaseUrl();

      expect(result.url).toContain('https://test.supabase.co/auth/v1/authorize');
      expect(result.url).toContain('provider=google');
      expect(result.url).toContain('redirect_to=');
    });

    it('should throw BadRequestException when supabase is not configured', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'supabase.url') return '';
        return null;
      });

      expect(() => service.getSupabaseUrl()).toThrow(BadRequestException);
    });
  });
});
