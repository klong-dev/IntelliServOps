import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentMethodType } from '@prisma/client';

export class ContractMemberDto {
  @ApiProperty({ description: 'User ID of the tenant' })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: ['primary', 'co_tenant', 'guarantor'] })
  @IsString()
  memberType: 'primary' | 'co_tenant' | 'guarantor';

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  isPrimaryContact?: boolean;

  @ApiPropertyOptional({ example: 50.0, description: 'Share percentage' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  sharePercentage?: number;
}

export class CreateContractDto {
  @ApiProperty({ description: 'Apartment ID to rent' })
  @IsUUID()
  apartmentId: string;

  @ApiProperty({ example: '2026-02-01', description: 'Contract start date' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2027-02-01', description: 'Contract end date' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 15000000, description: 'Monthly rent in VND' })
  @IsNumber()
  @Min(0)
  monthlyRent: number;

  @ApiProperty({ example: 30000000, description: 'Deposit amount in VND' })
  @IsNumber()
  @Min(0)
  depositAmount: number;

  @ApiProperty({ example: 5, description: 'Day of month for payment (1-31)' })
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDueDay: number;

  @ApiPropertyOptional({ enum: PaymentMethodType, default: 'bank_transfer' })
  @IsEnum(PaymentMethodType)
  @IsOptional()
  paymentMethod?: PaymentMethodType;

  @ApiPropertyOptional({
    example: { electricity: true, water: true, internet: false },
    description: 'Utilities included in rent',
  })
  @IsOptional()
  utilitiesIncluded?: Record<string, boolean>;

  @ApiPropertyOptional({
    example: { electricity: 3500, water: 15000 },
    description: 'Per-unit utility charges if not included',
  })
  @IsOptional()
  utilitiesCharges?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Contract terms and conditions' })
  @IsString()
  @IsOptional()
  contractTerms?: string;

  @ApiPropertyOptional({ description: 'Special conditions' })
  @IsString()
  @IsOptional()
  specialConditions?: string;

  @ApiProperty({
    type: [ContractMemberDto],
    description: 'List of tenants on this contract',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractMemberDto)
  members: ContractMemberDto[];
}
