import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PolicyType } from '@prisma/client';

export class CreatePolicyDto {
  @ApiProperty({ enum: PolicyType })
  @IsEnum(PolicyType)
  policyType: PolicyType;

  @ApiProperty({ example: 'Chính sách bảo mật thông tin' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ example: 'Nội dung chính sách bảo mật...' })
  @IsString()
  content: string;

  @ApiProperty({ example: '1.0' })
  @IsString()
  @MaxLength(50)
  version: string;

  @ApiPropertyOptional({ example: 'vi', default: 'vi' })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({ example: '2026-03-01', description: 'Effective date' })
  @IsDateString()
  effectiveDate: string;

  @ApiPropertyOptional({ example: '2027-03-01' })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  requiresAcceptance?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @IsOptional()
  @Min(0)
  displayOrder?: number;
}
