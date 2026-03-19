import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Nested DTOs ────────────────────────────────────────────────────

class PaymentInvoiceSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'INV-202601-00001' })
  invoiceNumber: string;

  @ApiProperty({ example: '15000000.00' })
  totalAmount: string;
}

class PaymentInvoiceItemDto {
  @ApiProperty({ example: 'Deposit for contract CTR-2026-00001' })
  description: string;

  @ApiProperty({ example: 20000000 })
  amount: number;

  @ApiProperty({ example: 1 })
  quantity: number;

  @ApiProperty({ example: 'contractDeposit' })
  itemType: string;
}

class PaymentInvoiceContentDto {
  @ApiProperty({ example: 'invoice-123' })
  invoiceId: string;

  @ApiProperty({ example: 'INV-202601-00001' })
  invoiceNumber: string;

  @ApiProperty({ example: 'contractDeposit' })
  invoiceType: string;

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiProperty({ example: 0 })
  baseRent: number;

  @ApiProperty({ example: 0 })
  taxAmount: number;

  @ApiProperty({ example: 20000000 })
  totalAmount: number;

  @ApiProperty({ type: [PaymentInvoiceItemDto] })
  items: PaymentInvoiceItemDto[];

  @ApiProperty({
    type: Object,
    example: {
      title: 'Deposit invoice for CTR-2026-00001',
      description: 'Security deposit payment',
      items: [
        {
          description: 'Deposit for contract CTR-2026-00001',
          amount: 20000000,
          quantity: 1,
          itemType: 'contractDeposit',
        },
      ],
    },
  })
  content: Record<string, unknown>;
}

// ─── Payment List Item DTO (findAll) ────────────────────────────────

export class PaymentListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'PAY-1234567890-ABCDE' })
  paymentReference: string;

  @ApiProperty({ example: '15000000.00' })
  amount: string;

  @ApiProperty({ example: 'bank_transfer' })
  paymentMethod: string;

  @ApiProperty({ example: 'completed' })
  status: string;

  @ApiProperty()
  paymentDate: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: PaymentInvoiceSummaryDto })
  invoice: PaymentInvoiceSummaryDto;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'True when this is a synthetic pending row generated from an unpaid invoice without payment records',
  })
  isSynthetic?: boolean;
}

// ─── Payment Detail DTO (findOne) ───────────────────────────────────

export class PaymentDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'PAY-1234567890-ABCDE' })
  paymentReference: string;

  @ApiProperty({ example: '15000000.00' })
  amount: string;

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiProperty({ example: 'bank_transfer' })
  paymentMethod: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  paymentGateway: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  transactionId: string | null;

  @ApiProperty()
  paymentDate: Date;

  @ApiProperty({ example: 'completed' })
  status: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  paymentProofUrl: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  bankName: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  accountNumber: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  processedByStaffId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  refundAmount: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  refundDate: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  refundReason: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: PaymentInvoiceContentDto })
  invoice: PaymentInvoiceContentDto;

  @ApiProperty()
  user: any; // { id, fullName }
}

// ─── Payment Created DTO ────────────────────────────────────────────

export class PaymentCreatedDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'PAY-1234567890-ABCDE' })
  paymentReference: string;

  @ApiProperty({ example: '15000000.00' })
  amount: string;

  @ApiProperty({ example: 'pending' })
  status: string;
}

export class PayOSPaymentLinkCreatedDto {
  @ApiProperty({ example: '9fbc9e7e-5a4d-4f38-9ba8-cc96af4f0eaf' })
  paymentId: string;

  @ApiProperty({ example: 'invoice-123' })
  invoiceId: string;

  @ApiProperty({ example: 'PAYOS-250319123456' })
  paymentReference: string;

  @ApiProperty({ example: 250319123456 })
  orderCode: number;

  @ApiProperty({ example: 'PENDING' })
  status: string;

  @ApiProperty({
    example: 'https://pay.payos.vn/web/4cecc6f4f7af43f09b3d3137ce645a49',
  })
  checkoutUrl: string;

  @ApiProperty({ example: '0002010102123858...' })
  qrCode: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Unix timestamp (seconds) for link expiry',
  })
  expiredAt?: number | null;

  @ApiProperty({ type: PaymentInvoiceContentDto })
  invoice: PaymentInvoiceContentDto;
}
