import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class ListDuePartnerMonthlyPayoutsQueryDto {
  @ApiPropertyOptional({
    description:
      'Billing month in YYYY-MM format. Defaults to previous month if omitted.',
    example: '2026-03',
  })
  @IsOptional()
  @Matches(YEAR_MONTH_PATTERN, {
    message: 'month must be in YYYY-MM format',
  })
  month?: string;
}

export class PartnerMonthlyPayoutItemDto {
  @ApiPropertyOptional({
    description: 'Payout record ID if previously created',
    example: '9df9c54e-5de4-4d23-8db8-78c4b0d5c2da',
    nullable: true,
  })
  payoutId: string | null;

  @ApiProperty({ example: '7c2bd59f-e25d-4b76-b9a6-1f1f91d25f71' })
  partnerId: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  partnerName: string;

  @ApiPropertyOptional({ example: 'A Property Co., Ltd', nullable: true })
  partnerCompanyName: string | null;

  @ApiPropertyOptional({ example: 'BIDV', nullable: true })
  bankName: string | null;

  @ApiPropertyOptional({ example: '1234567890123', nullable: true })
  bankAccountNumber: string | null;

  @ApiPropertyOptional({
    example: 'Thanh toan vao ngay 05 hang thang',
    nullable: true,
  })
  paymentTerms: string | null;

  @ApiProperty({ example: '2026-03' })
  payoutMonth: string;

  @ApiProperty({ example: '2026-03-01T00:00:00.000Z' })
  billingPeriodStart: Date;

  @ApiProperty({ example: '2026-04-01T00:00:00.000Z' })
  billingPeriodEndExclusive: Date;

  @ApiProperty({ example: '2026-04-05T00:00:00.000Z' })
  dueDate: Date;

  @ApiProperty({ example: '50000000.00' })
  grossRevenue: string;

  @ApiProperty({
    description: 'Commission amount kept by system based on cooperation rate',
    example: '5000000.00',
  })
  commissionAmount: string;

  @ApiProperty({
    description: 'Effective weighted commission rate (%)',
    example: 10,
  })
  effectiveCommissionRate: number;

  @ApiProperty({
    description: 'Amount that must be transferred to partner',
    example: '45000000.00',
  })
  payoutAmount: string;

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiProperty({
    description:
      'Always true in this endpoint because only due partners are returned',
    example: true,
  })
  isDue: boolean;

  @ApiPropertyOptional({
    description: 'Transfer proof image URL if already uploaded',
    nullable: true,
    example:
      'https://cdn.example.com/apartment-cooperation/partner-payouts/2026-03/partner-id/staff-id-1710000000000.jpg',
  })
  transferProofUrl: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'MB-TRX-000321' })
  transferReference: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Thanh toan dung han thang 3',
  })
  transferNote: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-04-05T09:30:00.000Z' })
  confirmedAt: Date | null;

  @ApiPropertyOptional({ nullable: true, example: 'staff-uuid' })
  confirmedByStaffId: string | null;
}

export class ConfirmPartnerMonthlyPayoutDto {
  @ApiProperty({
    description: 'Partner user ID to confirm payment for',
    example: '7c2bd59f-e25d-4b76-b9a6-1f1f91d25f71',
  })
  @IsUUID()
  partnerId: string;

  @ApiProperty({
    description: 'Billing month in YYYY-MM format',
    example: '2026-03',
  })
  @Matches(YEAR_MONTH_PATTERN, {
    message: 'payoutMonth must be in YYYY-MM format',
  })
  payoutMonth: string;

  @ApiPropertyOptional({
    description: 'Bank transfer reference or transaction code',
    example: 'MB-TRX-000321',
  })
  @IsOptional()
  @IsString()
  transferReference?: string;

  @ApiPropertyOptional({
    description: 'Internal note for payout confirmation',
    example: 'Da doi soat va chuyen khoan thanh cong',
  })
  @IsOptional()
  @IsString()
  transferNote?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Transfer proof image (JPG/PNG/WebP)',
  })
  transferProof: any;
}

export class ConfirmPartnerMonthlyPayoutResultDto {
  @ApiProperty({ example: 'Partner monthly payout confirmed successfully' })
  message: string;

  @ApiProperty({ example: '9df9c54e-5de4-4d23-8db8-78c4b0d5c2da' })
  payoutId: string;

  @ApiProperty({ example: '7c2bd59f-e25d-4b76-b9a6-1f1f91d25f71' })
  partnerId: string;

  @ApiProperty({ example: '2026-03' })
  payoutMonth: string;

  @ApiProperty({ example: '45000000.00' })
  payoutAmount: string;

  @ApiProperty({ example: 'paid' })
  status: string;

  @ApiProperty({
    example:
      'https://cdn.example.com/apartment-cooperation/partner-payouts/2026-03/partner-id/staff-id-1710000000000.jpg',
  })
  transferProofUrl: string;

  @ApiProperty({ example: '2026-04-05T09:30:00.000Z' })
  confirmedAt: Date;

  @ApiProperty({ example: 'staff-uuid' })
  confirmedByStaffId: string;
}
