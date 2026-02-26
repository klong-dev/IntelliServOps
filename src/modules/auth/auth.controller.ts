import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
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
  SubmitGuestInfoDto,
  RequestOtpDto,
  VerifyOtpDto,
  AuthResponseDto,
  TokenPairDto,
  OtpResponseDto,
  SubmitGuestResponseDto,
} from './dto';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from './auth.service';
import { MessageResponseDto } from '../../common/dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Login for any actor type
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login',
    description: 'Login with email and password. Supports User, Staff, Operator, Admin, Partner.',
  })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * Refresh access token
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh token',
    description: 'Get new access token using refresh token',
  })
  @ApiResponse({ status: 200, description: 'Token refreshed', type: TokenPairDto })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refresh(refreshTokenDto.refreshToken);
  }

  /**
   * Logout
   */
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

  // ─── Guest Registration Flow ──────────────────────────────────────

  /**
   * Staff submits guest info for registration
   */
  @Post('guest/submit-info')
  @ApiBearerAuth()
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Submit guest information',
    description: 'Staff submits guest info after rental agreement. Creates a pending registration.',
  })
  @ApiResponse({ status: 201, description: 'Guest info submitted', type: SubmitGuestResponseDto })
  @ApiResponse({ status: 409, description: 'Phone/email already registered' })
  async submitGuestInfo(
    @Body() submitGuestInfoDto: SubmitGuestInfoDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.authService.submitGuestInfo(submitGuestInfoDto, currentUser.sub);
  }

  /**
   * Guest requests OTP via mobile app
   */
  @Post('guest/request-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request OTP',
    description: 'Guest requests OTP for registration. Phone must match a pending registration.',
  })
  @ApiResponse({ status: 200, description: 'OTP sent', type: OtpResponseDto })
  @ApiResponse({ status: 404, description: 'No pending registration' })
  async requestOtp(@Body() requestOtpDto: RequestOtpDto) {
    return this.authService.requestOtp(requestOtpDto);
  }

  /**
   * Guest verifies OTP and completes registration
   */
  @Post('guest/verify-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP',
    description: 'Guest verifies OTP and completes registration. Returns auth tokens.',
  })
  @ApiResponse({ status: 200, description: 'OTP verified, registration complete', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtpAndRegister(verifyOtpDto);
  }

  /**
   * Send OTP directly (for testing / dev)
   */
  @Post('send-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send OTP directly',
    description: 'Send OTP to any phone number. For testing or simplified flow.',
  })
  @ApiResponse({ status: 200, description: 'OTP sent', type: OtpResponseDto })
  async sendDirectOtp(@Body() body: { phone: string }) {
    return this.authService.sendDirectOtp(body.phone);
  }

  /**
   * Resend OTP
   */
  @Post('guest/resend-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend OTP',
    description: 'Resend OTP for guest registration',
  })
  @ApiResponse({ status: 200, description: 'OTP resent', type: OtpResponseDto })
  async resendOtp(@Body() body: { phone: string }) {
    return this.authService.resendOtp(body.phone);
  }
}
