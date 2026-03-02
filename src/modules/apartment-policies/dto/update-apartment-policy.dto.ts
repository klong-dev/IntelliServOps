import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateApartmentPolicyDto {
  @ApiPropertyOptional({
    default: true,
    description: 'Whether this policy is required for the apartment',
  })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @ApiPropertyOptional({ example: '2026-03-01', description: 'Effective date' })
  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @ApiPropertyOptional({ example: '2027-03-01', description: 'Expiry date' })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({
    example: 'Updated notes',
    description: 'Additional notes',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
