import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({
    example: 'user',
    enum: ['user', 'staff', 'operator', 'admin', 'guest'],
  })
  actorType: string;

  @ApiProperty({
    example: ['user', 'operator'],
    description: 'All available roles for this account',
    type: [String],
  })
  availableRoles: string[];
}

// ─── Token Pair DTO ─────────────────────────────────────────────────

export class TokenPairDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  refreshToken: string;
}

// ─── Auth Response DTO (login / register) ───────────────────────────

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({ type: TokenPairDto })
  tokens: TokenPairDto;
}

// ─── Message Response DTO ───────────────────────────────────────────

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation successful' })
  message: string;
}
