import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import {
  createPrismaMock,
  mockUser,
  mockStaff,
  mockOperator,
  mockAdmin,
  mockPartner,
  mockRefreshToken,
  mockOtpVerification,
  mockPendingGuestRegistration,
  MockPrisma,
  mockUserJwtPayload,
  createMockJwtService,
} from '../../test-utils';
import { ActorType, PendingRegistrationStatus } from '@prisma/client';
import { LoginDto, LoginActorType } from './dto';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrisma;
  let jwtService: ReturnType<typeof createMockJwtService>;
  let configService: ConfigService;
  let smsService: SmsService;

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwtService = createMockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'jwt.secret': 'test-secret',
                'jwt.expiresIn': '7d',
                'jwt.refreshSecret': 'test-refresh-secret',
                'jwt.refreshExpiresIn': '30d',
              };
              return config[key];
            }),
          },
        },
        {
          provide: SmsService,
          useValue: {
            sendOtp: jest.fn(),
            verifyOtp: jest.fn(),
            formatPhoneNumber: jest.fn((phone) => phone.startsWith('+') ? phone : `+84${phone.substring(1)}`),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
    smsService = module.get<SmsService>(SmsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password using bcrypt', async () => {
      const password = 'test-password';
      const hashed = await service.hashPassword(password);
      
      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(await bcrypt.compare(password, hashed)).toBe(true);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const password = 'test-password';
      const hash = await bcrypt.hash(password, 12);
      
      const result = await service.comparePassword(password, hash);
      
      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = 'test-password';
      const wrongPassword = 'wrong-password';
      const hash = await bcrypt.hash(password, 12);
      
      const result = await service.comparePassword(wrongPassword, hash);
      
      expect(result).toBe(false);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'user@example.com',
      password: 'password123',
    };

    it('should successfully login a user', async () => {
      const user = mockUser({
        email: loginDto.email,
        passwordHash: await bcrypt.hash(loginDto.password, 12),
      });

      prisma.user.findUnique.mockResolvedValue(user);
      prisma.refreshToken.create.mockResolvedValue(mockRefreshToken());
      prisma.user.update.mockResolvedValue(user);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.id).toBe(user.id);
      expect(result.user.email).toBe(user.email);
      expect(result.user.actorType).toBe(ActorType.user);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should successfully login staff with specified actorType', async () => {
      const staff = mockStaff({
        email: loginDto.email,
        passwordHash: await bcrypt.hash(loginDto.password, 12),
      });

      const staffLoginDto = { ...loginDto, actorType: LoginActorType.STAFF };

      prisma.staff.findUnique.mockResolvedValue(staff);
      prisma.refreshToken.create.mockResolvedValue(mockRefreshToken());

      const result = await service.login(staffLoginDto);

      expect(result.user.actorType).toBe(ActorType.staff);
      expect(result.user.role).toBe('staff');
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.staff.findUnique.mockResolvedValue(null);
      prisma.operator.findUnique.mockResolvedValue(null);
      prisma.admin.findUnique.mockResolvedValue(null);
      prisma.partner.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for incorrect password', async () => {
      const user = mockUser({
        email: loginDto.email,
        passwordHash: await bcrypt.hash('different-password', 12),
      });

      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const inactiveUser = mockUser({
        email: loginDto.email,
        passwordHash: await bcrypt.hash(loginDto.password, 12),
        isActive: false,
      });

      prisma.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(loginDto)).rejects.toThrow('Account is deactivated');
    });
  });

  describe('refresh', () => {
    it('should successfully refresh tokens', async () => {
      const payload = mockUserJwtPayload({ type: 'refresh' });
      const refreshToken = 'valid-refresh-token';
      const storedToken = mockRefreshToken({ token: refreshToken });

      jwtService.verify.mockReturnValue(payload);
      prisma.refreshToken.findFirst.mockResolvedValue(storedToken);
      // Service uses $transaction([...]) array syntax, not callback
      prisma.$transaction.mockResolvedValue([
        { ...storedToken, revokedAt: new Date() },
        mockRefreshToken(),
      ]);

      const result = await service.refresh(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refresh('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong token type', async () => {
      const payload = mockUserJwtPayload({ type: 'access' });
      jwtService.verify.mockReturnValue(payload);

      await expect(service.refresh('access-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for revoked token', async () => {
      const payload = mockUserJwtPayload({ type: 'refresh' });
      jwtService.verify.mockReturnValue(payload);
      prisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refresh('revoked-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should successfully revoke refresh token', async () => {
      const refreshToken = 'token-to-revoke';
      const payload = mockUserJwtPayload({ type: 'refresh' });

      jwtService.verify.mockReturnValue(payload);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout(refreshToken);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { token: refreshToken, actorId: payload.sub },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should silently ignore invalid token during logout', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.logout('invalid-token')).resolves.not.toThrow();
    });
  });

  describe('revokeAllTokens', () => {
    it('should revoke all tokens for an actor', async () => {
      const actorId = 'user-123';
      const actorType = ActorType.user;

      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.revokeAllTokens(actorId, actorType);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { actorId, actorType, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      const payload = {
        sub: 'user-123',
        email: 'user@example.com',
        role: 'user',
        actorType: ActorType.user,
      };

      const tokens = service.generateTokens(payload);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const token = 'valid-access-token';
      const payload = mockUserJwtPayload();

      jwtService.verify.mockReturnValue(payload);

      const result = service.verifyAccessToken(token);

      expect(result).toEqual(payload);
      expect(jwtService.verify).toHaveBeenCalledWith(token, expect.any(Object));
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const token = 'valid-refresh-token';
      const payload = mockUserJwtPayload({ type: 'refresh' });

      jwtService.verify.mockReturnValue(payload);

      const result = service.verifyRefreshToken(token);

      expect(result).toEqual(payload);
    });
  });

  describe('submitGuestInfo', () => {
    const submitDto = {
      phone: '+84901234567',
      email: 'guest@example.com',
      fullName: 'Test Guest',
      dateOfBirth: '1995-01-01',
      nationalId: '123456789',
    };
    const staffId = 'staff-123';

    it('should successfully create pending registration', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.pendingGuestRegistration.findUnique.mockResolvedValue(null);
      const pending = mockPendingGuestRegistration(submitDto);
      prisma.pendingGuestRegistration.create.mockResolvedValue(pending);

      const result = await service.submitGuestInfo(submitDto, staffId);

      expect(result.message).toContain('submitted');
      expect(result.pendingRegistrationId).toBeDefined();
      expect(prisma.pendingGuestRegistration.create).toHaveBeenCalled();
    });

    it('should update existing pending registration', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      const existingPending = mockPendingGuestRegistration({ phone: submitDto.phone });
      prisma.pendingGuestRegistration.findUnique.mockResolvedValue(existingPending);
      prisma.pendingGuestRegistration.update.mockResolvedValue({ ...existingPending, ...submitDto });

      const result = await service.submitGuestInfo(submitDto, staffId);

      expect(result.message).toContain('updated');
      expect(prisma.pendingGuestRegistration.update).toHaveBeenCalled();
    });

    it('should throw ConflictException if phone already registered', async () => {
      const existingUser = mockUser({ phone: submitDto.phone });
      prisma.user.findFirst.mockResolvedValue(existingUser);

      await expect(service.submitGuestInfo(submitDto, staffId)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if email already registered', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const existingUser = mockUser({ email: submitDto.email });
      prisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(service.submitGuestInfo(submitDto, staffId)).rejects.toThrow(ConflictException);
    });
  });

  describe('requestOtp', () => {
    const requestDto = { phone: '+84901234567' };

    it('should successfully send OTP', async () => {
      const pending = mockPendingGuestRegistration({ phone: requestDto.phone });
      prisma.pendingGuestRegistration.findUnique.mockResolvedValue(pending);
      prisma.otpVerification.findFirst.mockResolvedValue(null);
      (smsService.sendOtp as jest.Mock).mockResolvedValue({ success: true, devOtpCode: '123456' });
      prisma.otpVerification.create.mockResolvedValue(mockOtpVerification());
      prisma.pendingGuestRegistration.update.mockResolvedValue(pending);

      const result = await service.requestOtp(requestDto);

      expect(result.message).toContain('sent');
      expect(result.expiresIn).toBe(300);
      expect(result.devOtpCode).toBe('123456');
      expect(smsService.sendOtp).toHaveBeenCalled();
    });

    it('should throw NotFoundException if no pending registration', async () => {
      prisma.pendingGuestRegistration.findUnique.mockResolvedValue(null);

      await expect(service.requestOtp(requestDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if registration expired', async () => {
      const expiredPending = mockPendingGuestRegistration({
        phone: requestDto.phone,
        expiresAt: new Date(Date.now() - 1000),
      });
      prisma.pendingGuestRegistration.findUnique.mockResolvedValue(expiredPending);

      await expect(service.requestOtp(requestDto)).rejects.toThrow(BadRequestException);
      await expect(service.requestOtp(requestDto)).rejects.toThrow('expired');
    });

    it('should throw BadRequestException if already completed', async () => {
      const completedPending = mockPendingGuestRegistration({
        phone: requestDto.phone,
        status: PendingRegistrationStatus.completed,
      });
      prisma.pendingGuestRegistration.findUnique.mockResolvedValue(completedPending);

      await expect(service.requestOtp(requestDto)).rejects.toThrow(BadRequestException);
      await expect(service.requestOtp(requestDto)).rejects.toThrow('already completed');
    });

    it('should enforce rate limiting', async () => {
      const pending = mockPendingGuestRegistration({ phone: requestDto.phone });
      prisma.pendingGuestRegistration.findUnique.mockResolvedValue(pending);
      const recentOtp = mockOtpVerification({ phone: requestDto.phone, createdAt: new Date() });
      prisma.otpVerification.findFirst.mockResolvedValue(recentOtp);

      await expect(service.requestOtp(requestDto)).rejects.toThrow(BadRequestException);
      await expect(service.requestOtp(requestDto)).rejects.toThrow('wait 1 minute');
    });
  });

  describe('verifyOtpAndRegister', () => {
    const verifyDto = {
      phone: '+84901234567',
      otpCode: '123456',
      password: 'password123',
    };

    it('should successfully verify OTP and create user', async () => {
      const pending = mockPendingGuestRegistration({ phone: verifyDto.phone });
      prisma.pendingGuestRegistration.findUnique.mockResolvedValue(pending);
      (smsService.verifyOtp as jest.Mock).mockResolvedValue({ success: true });
      
      const newUser = mockUser({ phone: verifyDto.phone, email: pending.email });
      prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
      prisma.otpVerification.findFirst.mockResolvedValue(mockOtpVerification());
      prisma.otpVerification.update.mockResolvedValue(mockOtpVerification({ isUsed: true }));
      prisma.pendingGuestRegistration.update.mockResolvedValue(pending);
      prisma.user.create.mockResolvedValue(newUser);
      prisma.refreshToken.create.mockResolvedValue(mockRefreshToken());

      const result = await service.verifyOtpAndRegister(verifyDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tokens');
      expect(result.user.email).toBe(pending.email);
      expect(smsService.verifyOtp).toHaveBeenCalledWith(verifyDto.phone, verifyDto.otpCode);
    });

    it('should throw NotFoundException if no pending registration', async () => {
      prisma.pendingGuestRegistration.findUnique.mockResolvedValue(null);

      await expect(service.verifyOtpAndRegister(verifyDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      const pending = mockPendingGuestRegistration({ phone: verifyDto.phone });
      prisma.pendingGuestRegistration.findUnique.mockResolvedValue(pending);
      (smsService.verifyOtp as jest.Mock).mockRejectedValue(new Error('Invalid OTP'));
      prisma.otpVerification.findFirst.mockResolvedValue(mockOtpVerification());
      prisma.otpVerification.update.mockResolvedValue(mockOtpVerification({ attempts: 1 }));

      await expect(service.verifyOtpAndRegister(verifyDto)).rejects.toThrow(BadRequestException);
      await expect(service.verifyOtpAndRegister(verifyDto)).rejects.toThrow('Invalid or expired OTP');
    });

    it('should throw BadRequestException after max attempts', async () => {
      const pending = mockPendingGuestRegistration({ phone: verifyDto.phone });
      prisma.pendingGuestRegistration.findUnique.mockResolvedValue(pending);
      (smsService.verifyOtp as jest.Mock).mockRejectedValue(new Error('Invalid OTP'));
      prisma.otpVerification.findFirst.mockResolvedValue(mockOtpVerification({ attempts: 4 }));
      prisma.otpVerification.update.mockResolvedValue(mockOtpVerification({ attempts: 5 }));

      await expect(service.verifyOtpAndRegister(verifyDto)).rejects.toThrow(BadRequestException);
      await expect(service.verifyOtpAndRegister(verifyDto)).rejects.toThrow('Too many failed attempts');
    });
  });

  describe('resendOtp', () => {
    it('should invalidate old OTPs and send new one', async () => {
      const phone = '+84901234567';
      const pending = mockPendingGuestRegistration({ phone });
      
      prisma.otpVerification.updateMany.mockResolvedValue({ count: 1 });
      prisma.pendingGuestRegistration.findUnique.mockResolvedValue(pending);
      prisma.otpVerification.findFirst.mockResolvedValue(null);
      (smsService.sendOtp as jest.Mock).mockResolvedValue({ success: true });
      prisma.otpVerification.create.mockResolvedValue(mockOtpVerification());
      prisma.pendingGuestRegistration.update.mockResolvedValue(pending);

      const result = await service.resendOtp(phone);

      expect(result.message).toContain('sent');
      expect(prisma.otpVerification.updateMany).toHaveBeenCalled();
    });
  });

  describe('sendDirectOtp', () => {
    it('should send OTP directly without pending registration', async () => {
      const phone = '+84901234567';
      
      prisma.otpVerification.findFirst.mockResolvedValue(null);
      prisma.otpVerification.updateMany.mockResolvedValue({ count: 0 });
      (smsService.sendOtp as jest.Mock).mockResolvedValue({ success: true, devOtpCode: '654321' });
      (smsService.formatPhoneNumber as jest.Mock).mockReturnValue(phone);
      prisma.otpVerification.create.mockResolvedValue(mockOtpVerification());

      const result = await service.sendDirectOtp(phone);

      expect(result.message).toContain('sent');
      expect(result.devOtpCode).toBe('654321');
      expect(result.expiresIn).toBe(300);
    });

    it('should enforce rate limiting', async () => {
      const phone = '+84901234567';
      (smsService.formatPhoneNumber as jest.Mock).mockReturnValue(phone);
      prisma.otpVerification.findFirst.mockResolvedValue(mockOtpVerification({ createdAt: new Date() }));

      await expect(service.sendDirectOtp(phone)).rejects.toThrow(BadRequestException);
      await expect(service.sendDirectOtp(phone)).rejects.toThrow('wait 1 minute');
    });
  });
});
