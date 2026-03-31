import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class SearchUserIdentityByNationalIdDto {
  @ApiProperty({ example: '079203001234' })
  nationalId: string;

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiPropertyOptional({ example: '2026-03-10T10:30:00.000Z', nullable: true })
  verifiedAt: Date | null;
}

export class SearchUserByNationalIdResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiPropertyOptional({ example: '0901234567', nullable: true })
  phone: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiProperty({ type: SearchUserIdentityByNationalIdDto })
  identity: SearchUserIdentityByNationalIdDto;
}
