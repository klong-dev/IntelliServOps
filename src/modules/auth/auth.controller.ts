import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  GoogleAuthDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  AuthResponseDto,
  TokenPairDto,
  MessageResponseDto,
} from './dto';
import { CurrentUser, Public } from '../../common/decorators';
import type { RequestUser } from '../../common/types';
import { ActorType } from '@prisma/client';
import { ApiJsonResponse } from '../../common/dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Public Endpoints ─────────────────────────────────────────────

  @Post('register')
  @Public()
  @ApiOperation({
    summary: 'Register',
    description:
      'Register a new user account with email, phone, fullName and password. Phone number can start with 0 or +84. Default role is user.',
  })
  @ApiJsonResponse(AuthResponseDto, {
    status: 201,
    description: 'Registration successful',
  })
  @ApiResponse({
    status: 409,
    description: 'Email or phone already registered',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login',
    description:
      'Login with email or phone number and password. Supports User, Staff, Operator, Admin, Partner. ' +
      'Phone number can start with 0 or +84. ' +
      'Optional actorType to select role (default: user if available). ' +
      'Response includes list of all available roles for the account.',
  })
  @ApiJsonResponse(AuthResponseDto, { description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('google')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Google OAuth',
    description:
      'Login or register via Google OAuth using Supabase access token.',
  })
  @ApiJsonResponse(AuthResponseDto, { description: 'Google OAuth successful' })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired Google OAuth token',
  })
  async googleAuth(@Body() googleAuthDto: GoogleAuthDto) {
    return this.authService.googleAuth(googleAuthDto);
  }

  @Get('supabaseUrl')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Google OAuth login URL',
    description:
      'Returns the full Supabase Google OAuth URL for frontend to open login popup/redirect.',
  })
  @ApiResponse({ status: 200, description: 'Google OAuth URL returned' })
  @ApiResponse({ status: 400, description: 'Supabase is not configured' })
  getSupabaseUrl(@Query('returnUrl') returnUrl?: string) {
    return this.authService.getSupabaseUrl(returnUrl);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh token',
    description: 'Get new access token using refresh token',
  })
  @ApiJsonResponse(TokenPairDto, { description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout',
    description: 'Revoke refresh token',
  })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@Body() refreshTokenDto: RefreshTokenDto) {
    await this.authService.logout(refreshTokenDto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  // ─── Password Management ──────────────────────────────────────────

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Forgot password',
    description: 'Request a password reset link sent to email.',
  })
  @ApiJsonResponse(MessageResponseDto, {
    description: 'Reset link sent (if account exists)',
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password',
    description: 'Reset password using the token received via email.',
  })
  @ApiJsonResponse(MessageResponseDto, {
    description: 'Password reset successful',
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('change-password')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change password',
    description: 'Change password for the currently authenticated user.',
  })
  @ApiJsonResponse(MessageResponseDto, { description: 'Password changed' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.authService.changePassword(
      currentUser.id,
      currentUser.actorType as ActorType,
      changePasswordDto,
    );
  }
}
