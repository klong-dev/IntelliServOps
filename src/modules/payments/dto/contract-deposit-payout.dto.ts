import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class ListDueContractDepositPayoutsQueryDto {
  @ApiPropertyOptional({
    description:
      'Contract end month in YYYY-MM format. Defaults to previous month if omitted.',
    example: '2026-03',
  })
  @IsOptional()
  @Matches(YEAR_MONTH_PATTERN, {
    message: 'month must be in YYYY-MM format',
  })
  month?: string;
}

export class ContractDepositPayoutItemDto {
  @ApiPropertyOptional({
    description: 'Refund payment record ID if payout was already processed',
    example: '6c6b2b36-4468-440b-8ba8-53dcd8d2be84',
    nullable: true,
  })
  payoutPaymentId: string | null;

  @ApiProperty({ example: '7f1154da-a4dd-4c0f-b67f-6b01f75fd611' })
  contractId: string;

  @ApiProperty({ example: 'CTR-2026-00123' })
  contractNumber: string;

  @ApiProperty({ example: 'd32f07dd-6697-4a93-8ee8-ea1190ddfca0' })
  apartmentId: string;

  @ApiProperty({ example: 'A1-1203' })
  apartmentNumber: string;

  @ApiProperty({ example: 'c8f1ff12-d4bd-4ec8-aec8-d5d1945a860f' })
  recipientUserId: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  recipientFullName: string;

  @ApiPropertyOptional({ example: '0901234567', nullable: true })
  recipientPhone: string | null;

  @ApiPropertyOptional({ example: 'Vietcombank', nullable: true })
  recipientBankName: string | null;

  @ApiPropertyOptional({ example: '001100223344', nullable: true })
  recipientBankAccountNumber: string | null;

  @ApiProperty({ example: '2026-03' })
  payoutMonth: string;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  contractEndDate: Date;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  dueDate: Date;

  @ApiProperty({ example: '20000000.00' })
  depositAmount: string;

  @ApiProperty({ example: '20000000.00' })
  payoutAmount: string;

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiProperty({ example: true })
  isDue: boolean;

  @ApiPropertyOptional({
    description: 'Transfer proof image URL if payout was confirmed',
    nullable: true,
    example:
      'https://cdn.example.com/apartment-cooperation/contract-deposit-payouts/2026-03/contract-id/staff-id-1710000000000.jpg',
  })
  transferProofUrl: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'MB-TRX-000999' })
  transferReference: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Hoan coc khi ket thuc hop dong',
  })
  transferNote: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-04-01T09:30:00.000Z' })
  confirmedAt: Date | null;

  @ApiPropertyOptional({ nullable: true, example: 'staff-uuid' })
  confirmedByStaffId: string | null;
}

export class ConfirmContractDepositPayoutDto {
  @ApiProperty({
    description: 'Rental contract ID to payout deposit for',
    example: '7f1154da-a4dd-4c0f-b67f-6b01f75fd611',
  })
  @IsUUID()
  contractId: string;

  @ApiPropertyOptional({
    description: 'Bank transfer reference or transaction code',
    example: 'MB-TRX-000999',
  })
  @IsOptional()
  @IsString()
  transferReference?: string;

  @ApiPropertyOptional({
    description: 'Internal note for payout confirmation',
    example: 'Hoan coc khi ket thuc hop dong',
  })
  @IsOptional()
  @IsString()
  transferNote?: string;

  @ApiPropertyOptional({
    description: 'Reason of deposit refund',
    example: 'Hop dong het han, hoan tra tien coc',
  })
  @IsOptional()
  @IsString()
  refundReason?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Transfer proof image (JPG/PNG/WebP)',
  })
  transferProof: any;
}

export class ConfirmContractDepositPayoutResultDto {
  @ApiProperty({ example: 'Contract deposit payout confirmed successfully' })
  message: string;

  @ApiProperty({ example: '6c6b2b36-4468-440b-8ba8-53dcd8d2be84' })
  payoutPaymentId: string;

  @ApiProperty({ example: '7f1154da-a4dd-4c0f-b67f-6b01f75fd611' })
  contractId: string;

  @ApiProperty({ example: 'CTR-2026-00123' })
  contractNumber: string;

  @ApiProperty({ example: 'c8f1ff12-d4bd-4ec8-aec8-d5d1945a860f' })
  recipientUserId: string;

  @ApiProperty({ example: '20000000.00' })
  payoutAmount: string;

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiProperty({ example: 'refunded' })
  status: string;

  @ApiProperty({
    example:
      'https://cdn.example.com/apartment-cooperation/contract-deposit-payouts/2026-03/contract-id/staff-id-1710000000000.jpg',
  })
  transferProofUrl: string;

  @ApiProperty({ example: '2026-04-01T09:30:00.000Z' })
  confirmedAt: Date;

  @ApiProperty({ example: 'staff-uuid' })
  confirmedByStaffId: string;
}
