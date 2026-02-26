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
import { ApiJsonResponse } from '../../common/dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login',
    description: 'Login with email and password. Supports User, Staff, Operator, Admin, Partner.',
  })
  @ApiJsonResponse(AuthResponseDto, { description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
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

  // ─── Guest Registration Flow ──────────────────────────────────────

  @Post('guest/submit-info')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Submit guest information',
    description: 'Staff submits guest info after rental agreement. Creates a pending registration.',
  })
  @ApiJsonResponse(SubmitGuestResponseDto, { status: 201, description: 'Guest info submitted' })
  @ApiResponse({ status: 409, description: 'Phone/email already registered' })
  async submitGuestInfo(
    @Body() submitGuestInfoDto: SubmitGuestInfoDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.authService.submitGuestInfo(submitGuestInfoDto, currentUser.sub);
  }

  @Post('guest/request-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request OTP',
    description: 'Guest requests OTP for registration. Phone must match a pending registration.',
  })
  @ApiJsonResponse(OtpResponseDto, { description: 'OTP sent' })
  @ApiResponse({ status: 404, description: 'No pending registration' })
  async requestOtp(@Body() requestOtpDto: RequestOtpDto) {
    return this.authService.requestOtp(requestOtpDto);
  }

  @Post('guest/verify-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP',
    description: 'Guest verifies OTP and completes registration. Returns auth tokens.',
  })
  @ApiJsonResponse(AuthResponseDto, { description: 'OTP verified, registration complete' })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtpAndRegister(verifyOtpDto);
  }

  @Post('send-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send OTP directly',
    description: 'Send OTP to any phone number. For testing or simplified flow.',
  })
  @ApiJsonResponse(OtpResponseDto, { description: 'OTP sent' })
  async sendDirectOtp(@Body() body: { phone: string }) {
    return this.authService.sendDirectOtp(body.phone);
  }

  @Post('guest/resend-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend OTP',
    description: 'Resend OTP for guest registration',
  })
  @ApiJsonResponse(OtpResponseDto, { description: 'OTP resent' })
  async resendOtp(@Body() body: { phone: string }) {
    return this.authService.resendOtp(body.phone);
  }
}
