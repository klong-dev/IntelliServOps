import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApartmentPolicyDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'Apartment ID',
  })
  @IsUUID()
  apartmentId: string;

  @ApiProperty({
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    description: 'Policy ID',
  })
  @IsUUID()
  policyId: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Whether this policy is required for the apartment',
  })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional({
    example: '2026-03-01',
    description: 'Effective date for the policy in this apartment',
  })
  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @ApiPropertyOptional({
    example: '2027-03-01',
    description: 'Expiry date for the policy in this apartment',
  })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({
    example: 'Special noise policy for this building',
    description: 'Additional notes',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
