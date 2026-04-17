import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum InvoiceMeItemType {
  invoice = 'invoice',
  partner_monthly_payout = 'partner_monthly_payout',
  contract_deposit_payout = 'contract_deposit_payout',
}

export class InvoiceMePartyDto {
  @ApiPropertyOptional({ nullable: true })
  id: string | null;

  @ApiPropertyOptional({ nullable: true })
  fullName: string | null;

  @ApiPropertyOptional({ nullable: true })
  companyName?: string | null;
}

export class InvoiceMePayoutBreakdownDto {
  @ApiProperty({ example: 50000000 })
  grossRevenue: number;

  @ApiProperty({ example: 10 })
  systemCommissionRate: number;

  @ApiProperty({ example: 5000000 })
  systemCommissionAmount: number;

  @ApiProperty({ example: 45000000 })
  netPayoutAmount: number;
}

export class InvoiceMePaymentSummaryDto {
  @ApiPropertyOptional({ nullable: true })
  paymentId: string | null;

  @ApiPropertyOptional({ nullable: true })
  paymentReference: string | null;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  paymentDate: Date | null;
}

export class InvoiceMeWorkItemMetaDto {
  @ApiPropertyOptional({ nullable: true, example: '2026-04' })
  payoutMonth: string | null;

  @ApiPropertyOptional({ nullable: true })
  transferProofUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  transferReference: string | null;

  @ApiPropertyOptional({ nullable: true })
  transferNote: string | null;

  @ApiPropertyOptional({ nullable: true })
  confirmedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  confirmedByStaffId: string | null;
}

export class InvoiceMeItemDto {
  @ApiProperty({ enum: InvoiceMeItemType })
  itemType: InvoiceMeItemType;

  @ApiProperty({ description: 'Unique id of the item in this feed' })
  itemId: string;

  @ApiPropertyOptional({ nullable: true })
  invoiceId: string | null;

  @ApiPropertyOptional({ nullable: true })
  invoiceNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  invoiceType: string | null;

  @ApiPropertyOptional({ nullable: true })
  invoiceStatus: string | null;

  @ApiPropertyOptional({ nullable: true })
  billingMonth: string | null;

  @ApiPropertyOptional({ nullable: true })
  billingPeriodStart: Date | null;

  @ApiPropertyOptional({ nullable: true })
  billingPeriodEnd: Date | null;

  @ApiPropertyOptional({ nullable: true })
  dueDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({ nullable: true, example: '15000000.00' })
  totalAmount: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'VND' })
  currency: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'bank_transfer' })
  paymentMethod: string | null;

  @ApiProperty({ type: InvoiceMePaymentSummaryDto })
  paymentSummary: InvoiceMePaymentSummaryDto;

  @ApiPropertyOptional({ nullable: true })
  contractId: string | null;

  @ApiPropertyOptional({ nullable: true })
  contractNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  apartmentId: string | null;

  @ApiPropertyOptional({ nullable: true })
  apartmentNumber: string | null;

  @ApiPropertyOptional({ type: InvoiceMePartyDto, nullable: true })
  payer: InvoiceMePartyDto | null;

  @ApiPropertyOptional({ type: InvoiceMePartyDto, nullable: true })
  receiver: InvoiceMePartyDto | null;

  @ApiPropertyOptional({ type: InvoiceMePayoutBreakdownDto, nullable: true })
  payoutBreakdown: InvoiceMePayoutBreakdownDto | null;

  @ApiProperty({ type: InvoiceMeWorkItemMetaDto })
  workMeta: InvoiceMeWorkItemMetaDto;
}

export class InvoiceMeListDto {
  @ApiProperty({
    enum: ['staff_worklist', 'user_payable', 'partner_receivable'],
  })
  roleContext: 'staff_worklist' | 'user_payable' | 'partner_receivable';

  @ApiProperty({ type: [InvoiceMeItemDto] })
  items: InvoiceMeItemDto[];

  @ApiProperty({ example: 10 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 1 })
  totalPages: number;
}
