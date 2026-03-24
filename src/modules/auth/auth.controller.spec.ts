import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService, AuthResponse } from './auth.service';
import { mockUserJwtPayload, mockUser } from '../../test-utils';
import { ActorType } from '@prisma/client';
import {
  LoginDto,
  RefreshTokenDto,
  SubmitGuestInfoDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    submitGuestInfo: jest.fn(),
    requestOtp: jest.fn(),
    verifyOtpAndRegister: jest.fn(),
    resendOtp: jest.fn(),
    sendDirectOtp: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully login and return user with tokens', async () => {
      const loginDto: LoginDto = {
        email: 'user@example.com',
        password: 'password123',
      };

      const expectedResponse: AuthResponse = {
        user: {
          id: 'user-123',
          email: loginDto.email,
          fullName: 'Test User',
          role: 'user',
          actorType: ActorType.user,
        },
        tokens: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
        },
      };

      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(expectedResponse);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(authService.login).toHaveBeenCalledTimes(1);
    });

    it('should handle login with actor type specification', async () => {
      const loginDto: LoginDto = {
        email: 'staff@example.com',
        password: 'password123',
        actorType: 'staff' as any,
      };

      const expectedResponse: AuthResponse = {
        user: {
          id: 'staff-123',
          email: loginDto.email,
          fullName: 'Test Staff',
          role: 'staff',
          actorType: ActorType.staff,
        },
        tokens: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
        },
      };

      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(loginDto);

      expect(result).toEqual(expectedResponse);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('refresh', () => {
    it('should successfully refresh tokens', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'valid-refresh-token',
      };

      const expectedTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.refresh.mockResolvedValue(expectedTokens);

      const result = await controller.refresh(refreshTokenDto);

      expect(result).toEqual(expectedTokens);
      expect(authService.refresh).toHaveBeenCalledWith(
        refreshTokenDto.refreshToken,
      );
      expect(authService.refresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('logout', () => {
    it('should successfully logout', async () => {
      const refreshTokenDto: RefreshTokenDto = {
        refreshToken: 'token-to-revoke',
      };

      mockAuthService.logout.mockResolvedValue(undefined);

      await controller.logout(refreshTokenDto);

      expect(authService.logout).toHaveBeenCalledWith(
        refreshTokenDto.refreshToken,
      );
      expect(authService.logout).toHaveBeenCalledTimes(1);
    });
  });

  describe('submitGuestInfo', () => {
    it('should submit guest information successfully', async () => {
      const submitDto: SubmitGuestInfoDto = {
        phone: '+84901234567',
        email: 'guest@example.com',
        fullName: 'Test Guest',
        dateOfBirth: '1995-01-01',
        nationalId: '123456789',
      };

      const currentUser = mockUserJwtPayload({
        sub: 'staff-123',
        actorType: ActorType.staff,
      });

      const expectedResponse = {
        message: 'Guest information submitted',
        pendingRegistrationId: 'pending-123',
      };

      mockAuthService.submitGuestInfo.mockResolvedValue(expectedResponse);

      const result = await controller.submitGuestInfo(submitDto, currentUser);

      expect(result).toEqual(expectedResponse);
      expect(authService.submitGuestInfo).toHaveBeenCalledWith(
        submitDto,
        currentUser.sub,
      );
      expect(authService.submitGuestInfo).toHaveBeenCalledTimes(1);
    });
  });

  describe('requestOtp', () => {
    it('should request OTP successfully', async () => {
      const requestOtpDto: RequestOtpDto = {
        phone: '+84901234567',
      };

      const expectedResponse = {
        message: 'OTP has been sent',
        expiresIn: 300,
        devOtpCode: '123456',
      };

      mockAuthService.requestOtp.mockResolvedValue(expectedResponse);

      const result = await controller.requestOtp(requestOtpDto);

      expect(result).toEqual(expectedResponse);
      expect(authService.requestOtp).toHaveBeenCalledWith(requestOtpDto);
      expect(authService.requestOtp).toHaveBeenCalledTimes(1);
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP and complete registration', async () => {
      const verifyDto: VerifyOtpDto = {
        phone: '+84901234567',
        otpCode: '123456',
        password: 'newpassword123',
      };

      const expectedResponse: AuthResponse = {
        user: {
          id: 'user-123',
          email: 'guest@example.com',
          fullName: 'Test Guest',
          role: 'user',
          actorType: ActorType.user,
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      };

      mockAuthService.verifyOtpAndRegister.mockResolvedValue(expectedResponse);

      const result = await controller.verifyOtp(verifyDto);

      expect(result).toEqual(expectedResponse);
      expect(authService.verifyOtpAndRegister).toHaveBeenCalledWith(verifyDto);
      expect(authService.verifyOtpAndRegister).toHaveBeenCalledTimes(1);
    });
  });

  describe('resendOtp', () => {
    it('should resend OTP successfully', async () => {
      const requestOtpDto: RequestOtpDto = {
        phone: '+84901234567',
      };

      const expectedResponse = {
        message: 'New OTP has been sent',
        expiresIn: 300,
      };

      mockAuthService.resendOtp.mockResolvedValue(expectedResponse);

      const result = await controller.resendOtp(requestOtpDto);

      expect(result).toEqual(expectedResponse);
      expect(authService.resendOtp).toHaveBeenCalledWith(requestOtpDto.phone);
      expect(authService.resendOtp).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendDirectOtp', () => {
    it('should send direct OTP successfully', async () => {
      const requestOtpDto: RequestOtpDto = {
        phone: '+84901234567',
      };

      const expectedResponse = {
        message: 'OTP has been sent',
        expiresIn: 300,
        devOtpCode: '654321',
      };

      mockAuthService.sendDirectOtp.mockResolvedValue(expectedResponse);

      const result = await controller.sendDirectOtp(requestOtpDto);

      expect(result).toEqual(expectedResponse);
      expect(authService.sendDirectOtp).toHaveBeenCalledWith(
        requestOtpDto.phone,
      );
      expect(authService.sendDirectOtp).toHaveBeenCalledTimes(1);
    });
  });
});
