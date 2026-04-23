import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class InvoicePartnerPayoutQueryDto {
  @ApiPropertyOptional({
    example: '2026-04',
    description: 'Month in YYYY-MM format. Default is current month',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;

  @ApiPropertyOptional({
    example: '9fbc9e7e-5a4d-4f38-9ba8-cc96af4f0eaf',
    description: 'Filter by partner user id',
  })
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ConfirmInvoicePartnerPayoutDto {
  @ApiProperty({
    example: '9fbc9e7e-5a4d-4f38-9ba8-cc96af4f0eaf',
    description: 'Partner user id to confirm monthly transfer',
  })
  @IsUUID()
  partnerId: string;

  @ApiProperty({
    example: '2026-04',
    description: 'Month in YYYY-MM format',
  })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month: string;

  @ApiPropertyOptional({
    example: 'Da chuyen khoan du ngay 05/04/2026',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Transfer proof image (JPEG/PNG/WebP)',
  })
  transferProof: unknown;
}

export class InvoicePartnerPayoutPartnerInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiPropertyOptional({ nullable: true })
  companyName: string | null;
}

export class InvoicePartnerPayoutSummaryItemDto {
  @ApiProperty({ type: InvoicePartnerPayoutPartnerInfoDto })
  partner: InvoicePartnerPayoutPartnerInfoDto;

  @ApiProperty({ example: '2026-04' })
  periodMonth: string;

  @ApiProperty()
  periodStart: Date;

  @ApiProperty()
  periodEnd: Date;

  @ApiProperty({ example: 12 })
  invoiceCount: number;

  @ApiProperty({ example: 3 })
  apartmentCount: number;

  @ApiProperty({ example: 150000000 })
  totalGrossAmount: number;

  @ApiProperty({ example: 15000000 })
  totalSystemCommissionAmount: number;

  @ApiProperty({ example: 135000000 })
  totalNetPayoutAmount: number;

  @ApiProperty({ example: false })
  isTransferred: boolean;

  @ApiPropertyOptional({ nullable: true })
  transferProofImageUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  transferNote: string | null;

  @ApiPropertyOptional({ nullable: true })
  confirmedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  confirmedByStaffId: string | null;

  @ApiPropertyOptional({ nullable: true })
  confirmedByStaffName: string | null;
}

export class InvoicePartnerPayoutSummaryListDto {
  @ApiProperty({ type: [InvoicePartnerPayoutSummaryItemDto] })
  items: InvoicePartnerPayoutSummaryItemDto[];

  @ApiProperty({ example: 10 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 1 })
  totalPages: number;
}

export class ConfirmInvoicePartnerPayoutResultDto {
  @ApiProperty({ type: InvoicePartnerPayoutSummaryItemDto })
  payout: InvoicePartnerPayoutSummaryItemDto;
}
