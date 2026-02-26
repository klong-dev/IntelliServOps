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

  @ApiPropertyOptional({ nullable: true })
  paymentGateway: string | null;

  @ApiPropertyOptional({ nullable: true })
  transactionId: string | null;

  @ApiProperty()
  paymentDate: Date;

  @ApiProperty({ example: 'completed' })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  paymentProofUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  bankName: string | null;

  @ApiPropertyOptional({ nullable: true })
  accountNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiPropertyOptional({ nullable: true })
  processedByStaffId: string | null;

  @ApiPropertyOptional({ nullable: true })
  refundAmount: string | null;

  @ApiPropertyOptional({ nullable: true })
  refundDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  refundReason: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  invoice: any; // Full include with nested contract and members

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
