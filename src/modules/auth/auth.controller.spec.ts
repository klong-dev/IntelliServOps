import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService, AuthResponse } from './auth.service';
import { ActorType } from '@prisma/client';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  GoogleAuthDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    googleAuth: jest.fn(),
    getSupabaseUrl: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should register a user', async () => {
    const registerDto: RegisterDto = {
      email: 'user@example.com',
      phone: '+84901234567',
      fullName: 'Test User',
      password: 'password123',
    };
    const response = {
      user: {
        id: 'user-123',
        email: registerDto.email,
      },
      tokens: {
        accessToken: 'access',
        refreshToken: 'refresh',
      },
    };
    mockAuthService.register.mockResolvedValue(response);

    await expect(controller.register(registerDto)).resolves.toEqual(response);
    expect(authService.register).toHaveBeenCalledWith(registerDto);
  });

  it('should login and return tokens', async () => {
    const loginDto: LoginDto = {
      email: 'user@example.com',
      password: 'password123',
    };
    const response: AuthResponse = {
      user: {
        id: 'user-123',
        email: loginDto.email,
        fullName: 'Test User',
        role: 'user',
        actorType: ActorType.user,
      },
      tokens: {
        accessToken: 'access',
        refreshToken: 'refresh',
      },
      availableRoles: ['user'],
    };
    mockAuthService.login.mockResolvedValue(response);

    await expect(controller.login(loginDto)).resolves.toEqual(response);
    expect(authService.login).toHaveBeenCalledWith(loginDto);
  });

  it('should authenticate with Google', async () => {
    const googleDto: GoogleAuthDto = {
      accessToken: 'google-token',
    };
    mockAuthService.googleAuth.mockResolvedValue({ user: { id: 'user-123' } });

    await expect(controller.googleAuth(googleDto)).resolves.toEqual({
      user: { id: 'user-123' },
    });
    expect(authService.googleAuth).toHaveBeenCalledWith(googleDto);
  });

  it('should return the Supabase OAuth URL', () => {
    mockAuthService.getSupabaseUrl.mockReturnValue({
      url: 'https://example.supabase.co/auth',
    });

    expect(controller.getSupabaseUrl()).toEqual({
      url: 'https://example.supabase.co/auth',
    });
  });

  it('should pass returnUrl to Supabase OAuth URL builder', () => {
    mockAuthService.getSupabaseUrl.mockReturnValue({
      url: 'https://example.supabase.co/auth?redirect_to=homeiq%3A%2F%2Flogin',
      redirectTo: 'homeiq://login',
    });

    expect(controller.getSupabaseUrl('homeiq://login')).toEqual({
      url: 'https://example.supabase.co/auth?redirect_to=homeiq%3A%2F%2Flogin',
      redirectTo: 'homeiq://login',
    });
    expect(authService.getSupabaseUrl).toHaveBeenCalledWith('homeiq://login');
  });

  it('should refresh tokens', async () => {
    const refreshDto: RefreshTokenDto = { refreshToken: 'refresh-token' };
    mockAuthService.refresh.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    await expect(controller.refresh(refreshDto)).resolves.toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    expect(authService.refresh).toHaveBeenCalledWith(refreshDto.refreshToken);
  });

  it('should logout and return a confirmation message', async () => {
    const refreshDto: RefreshTokenDto = { refreshToken: 'refresh-token' };
    mockAuthService.logout.mockResolvedValue(undefined);

    await expect(controller.logout(refreshDto)).resolves.toEqual({
      message: 'Logged out successfully',
    });
    expect(authService.logout).toHaveBeenCalledWith(refreshDto.refreshToken);
  });

  it('should request forgot-password flow', async () => {
    const dto: ForgotPasswordDto = { email: 'user@example.com' };
    mockAuthService.forgotPassword.mockResolvedValue({
      message: 'Reset link sent',
    });

    await expect(controller.forgotPassword(dto)).resolves.toEqual({
      message: 'Reset link sent',
    });
    expect(authService.forgotPassword).toHaveBeenCalledWith(dto);
  });

  it('should reset password', async () => {
    const dto: ResetPasswordDto = {
      token: 'reset-token',
      newPassword: 'new-password-123',
    };
    mockAuthService.resetPassword.mockResolvedValue({
      message: 'Password reset successful',
    });

    await expect(controller.resetPassword(dto)).resolves.toEqual({
      message: 'Password reset successful',
    });
    expect(authService.resetPassword).toHaveBeenCalledWith(dto);
  });

  it('should change password for the current actor', async () => {
    const dto: ChangePasswordDto = {
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
    };
    const currentUser = { id: 'user-123', actorType: ActorType.user };
    mockAuthService.changePassword.mockResolvedValue({
      message: 'Password changed',
    });

    await expect(
      controller.changePassword(dto, currentUser as any),
    ).resolves.toEqual({
      message: 'Password changed',
    });
    expect(authService.changePassword).toHaveBeenCalledWith(
      'user-123',
      ActorType.user,
      dto,
    );
  });
});
