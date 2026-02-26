import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Auth User DTO (nested in AuthResponseDto) ─────────────────────

export class AuthUserDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'Nguyen Van A', nullable: true })
  fullName: string | null;

  @ApiProperty({ example: 'user' })
  role: string;

  @ApiProperty({ example: 'user', enum: ['user', 'staff', 'operator', 'admin', 'partner', 'guest'] })
  actorType: string;
}

// ─── Token Pair DTO ─────────────────────────────────────────────────

export class TokenPairDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  refreshToken: string;
}

// ─── Auth Response DTO (login / verify OTP) ─────────────────────────

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: TokenPairDto })
  tokens: TokenPairDto;
}

// ─── OTP Response DTO ───────────────────────────────────────────────

export class OtpResponseDto {
  @ApiProperty({ example: 'OTP has been sent to your phone number.' })
  message: string;

  @ApiProperty({ example: 300, description: 'Expiry in seconds' })
  expiresIn: number;

  @ApiPropertyOptional({ example: '123456', description: 'Only in dev mode' })
  devOtpCode?: string;
}

// ─── Submit Guest Info Response DTO ─────────────────────────────────

export class SubmitGuestResponseDto {
  @ApiProperty({ example: 'Guest information submitted. Guest can now register via mobile app.' })
  message: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  pendingRegistrationId: string;
}
