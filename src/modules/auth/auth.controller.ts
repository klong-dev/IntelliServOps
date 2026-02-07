import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService, AuthResponse, TokenPair } from './auth.service';
import {
  LoginDto,
  RefreshTokenDto,
  SubmitGuestInfoDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from './auth.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login',
    description:
      'Authenticate any actor type (User, Staff, Operator, Admin, Partner)',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns user info and tokens',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or account deactivated',
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh Token',
    description: 'Get new access token using refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns new access and refresh tokens',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
  })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<TokenPair> {
    return this.authService.refresh(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout',
    description: 'Revoke refresh token',
  })
  @ApiResponse({
    status: 204,
    description: 'Logout successful',
  })
  async logout(@Body() refreshTokenDto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(refreshTokenDto.refreshToken);
  }

  // ============================================================================
  // Guest Registration Flow Endpoints
  // ============================================================================

  @Post('submit-guest')
  @ApiBearerAuth()
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit Guest Information (Staff only)',
    description:
      'Staff submits guest information after rental agreement. Creates a pending registration.',
  })
  @ApiResponse({
    status: 201,
    description: 'Guest information submitted successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Phone number or email already registered',
  })
  async submitGuestInfo(
    @Body() submitGuestInfoDto: SubmitGuestInfoDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.authService.submitGuestInfo(
      submitGuestInfoDto,
      currentUser.sub,
    );
  }

  @Post('request-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request OTP',
    description:
      'Guest requests OTP via mobile app. Phone must match a pending registration.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'No pending registration found for this phone',
  })
  @ApiResponse({
    status: 400,
    description: 'Rate limit exceeded or registration expired',
  })
  async requestOtp(@Body() requestOtpDto: RequestOtpDto) {
    return this.authService.requestOtp(requestOtpDto);
  }

  @Post('verify-otp')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Verify OTP and Complete Registration',
    description:
      'Guest verifies OTP and creates account. After success, Guest becomes User.',
  })
  @ApiResponse({
    status: 201,
    description: 'Registration successful, returns user info and tokens',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid OTP, expired, or too many attempts',
  })
  @ApiResponse({
    status: 404,
    description: 'No pending registration found',
  })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto): Promise<AuthResponse> {
    return this.authService.verifyOtpAndRegister(verifyOtpDto);
  }

  @Post('resend-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend OTP',
    description: 'Invalidate old OTP and send a new one',
  })
  @ApiResponse({
    status: 200,
    description: 'New OTP sent successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Rate limit exceeded',
  })
  async resendOtp(@Body() requestOtpDto: RequestOtpDto) {
    return this.authService.resendOtp(requestOtpDto.phone);
  }
}
