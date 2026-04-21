import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaymentMethodType } from '@prisma/client';

export class UpdateContractPdfContentDto {
  @ApiPropertyOptional({
    description: 'Landlord name displayed in PDF (Party A)',
    example: 'Hoàng Kim Long',
  })
  @IsString()
  @IsOptional()
  landlordName?: string;

  @ApiPropertyOptional({
    description: 'Landlord national ID number displayed in PDF',
    example: '060204000351',
  })
  @IsString()
  @IsOptional()
  landlordIdNumber?: string;

  @ApiPropertyOptional({
    description: 'Issue date of landlord ID/license',
    example: '19/04/2021',
  })
  @IsString()
  @IsOptional()
  landlordIdIssueDate?: string;

  @ApiPropertyOptional({
    description:
      'Legacy issue-place field kept for backward compatibility; rental contract PDF no longer renders this value',
    example: 'Canh sat quan ly hanh chinh ve trat tu xa hoi',
  })
  @IsString()
  @IsOptional()
  landlordIdIssuePlace?: string;

  @ApiPropertyOptional({
    description: 'Landlord business address displayed in PDF',
    example: 'Chung cư Vinhomes Grand Park, phường Long Bình, TP Thủ Đức',
  })
  @IsString()
  @IsOptional()
  landlordAddress?: string;

  @ApiPropertyOptional({
    description: 'Landlord phone number displayed in PDF',
    example: '0388969964',
  })
  @IsString()
  @IsOptional()
  landlordPhone?: string;

  @ApiPropertyOptional({
    description: 'Contract start date used in PDF',
    example: '2026-04-01',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Contract end date used in PDF',
    example: '2027-03-31',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Monthly rental fee',
    example: 15000000,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyRent?: number;

  @ApiPropertyOptional({
    description: 'Deposit amount',
    example: 30000000,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  depositAmount?: number;

  @ApiPropertyOptional({
    description: 'Monthly payment due day (1-28)',
    example: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(28)
  @IsOptional()
  paymentDueDay?: number;

  @ApiPropertyOptional({
    description: 'Payment method',
    enum: PaymentMethodType,
    example: PaymentMethodType.bank_transfer,
  })
  @IsEnum(PaymentMethodType)
  @IsOptional()
  paymentMethod?: PaymentMethodType;

  @ApiPropertyOptional({
    description: 'Special conditions shown in contract PDF',
    example: 'Không nuôi thú cưng trong căn hộ.',
  })
  @IsString()
  @IsOptional()
  specialConditions?: string;

  @ApiPropertyOptional({
    description: 'Additional contract terms shown in contract PDF',
    example: 'Không thay đổi kết cấu căn hộ trong thời hạn thuê.',
  })
  @IsString()
  @IsOptional()
  contractTerms?: string;
}
