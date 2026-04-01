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
    example: 'Cong ty TNHH IntelliServOps',
  })
  @IsString()
  @IsOptional()
  landlordName?: string;

  @ApiPropertyOptional({
    description: 'Landlord/company ID number displayed in PDF',
    example: '0312345678',
  })
  @IsString()
  @IsOptional()
  landlordIdNumber?: string;

  @ApiPropertyOptional({
    description: 'Issue date of landlord ID/license',
    example: '01/01/2020',
  })
  @IsString()
  @IsOptional()
  landlordIdIssueDate?: string;

  @ApiPropertyOptional({
    description: 'Issue place of landlord ID/license',
    example: 'So KH&DT TP. Ho Chi Minh',
  })
  @IsString()
  @IsOptional()
  landlordIdIssuePlace?: string;

  @ApiPropertyOptional({
    description: 'Landlord registered address displayed in PDF',
    example: 'TP. Ho Chi Minh, Viet Nam',
  })
  @IsString()
  @IsOptional()
  landlordAddress?: string;

  @ApiPropertyOptional({
    description: 'Landlord phone number displayed in PDF',
    example: '1900 0000',
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
    example: 'Khong nuoi thu cung trong can ho.',
  })
  @IsString()
  @IsOptional()
  specialConditions?: string;

  @ApiPropertyOptional({
    description: 'Additional contract terms shown in contract PDF',
    example: 'Khong thay doi ket cau can ho trong thoi han thue.',
  })
  @IsString()
  @IsOptional()
  contractTerms?: string;
}
