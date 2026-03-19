import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Nested DTOs ────────────────────────────────────────────────────

class InvoiceContractApartmentDto {
  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;

  @ApiProperty({ example: '123 Nguyen Hue, Q1' })
  address: string;
}

class InvoiceContractSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'CTR-202601-00001' })
  contractNumber: string;

  @ApiProperty({ type: InvoiceContractApartmentDto })
  apartment: InvoiceContractApartmentDto;
}

class InvoicePaymentSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '15000000.00' })
  amount: string;

  @ApiProperty({ example: 'bank_transfer' })
  paymentMethod: string;

  @ApiProperty({ example: 'completed' })
  status: string;

  @ApiProperty()
  paymentDate: Date;
}

class InvoiceContentItemDto {
  @ApiProperty({ example: 'Deposit for contract CTR-2026-00001' })
  description: string;

  @ApiProperty({ example: 20000000 })
  amount: number;

  @ApiProperty({ example: 1 })
  quantity: number;

  @ApiProperty({ example: 'contractDeposit' })
  itemType: string;
}

class InvoiceContentDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  title?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null;

  @ApiProperty({ type: [InvoiceContentItemDto] })
  items: InvoiceContentItemDto[];
}

// ─── Invoice List Item DTO (findAll) ────────────────────────────────

export class InvoiceListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'INV-202601-00001' })
  invoiceNumber: string;

  @ApiProperty({ example: '15000000.00' })
  totalAmount: string;

  @ApiProperty({ example: 'issued' })
  status: string;

  @ApiProperty({ example: 'rent' })
  invoiceType: string;

  @ApiProperty()
  dueDate: Date;

  @ApiProperty()
  billingPeriodStart: Date;

  @ApiProperty()
  billingPeriodEnd: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: InvoiceContractSummaryDto })
  rentalContract: InvoiceContractSummaryDto;
}

// ─── Invoice Detail DTO (findOne) ───────────────────────────────────

export class InvoiceDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'INV-202601-00001' })
  invoiceNumber: string;

  @ApiProperty()
  billingPeriodStart: Date;

  @ApiProperty()
  billingPeriodEnd: Date;

  @ApiProperty()
  issueDate: Date;

  @ApiProperty()
  dueDate: Date;

  @ApiProperty({ example: '15000000.00' })
  baseRent: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  utilityCharges: any;

  @ApiPropertyOptional({ type: Object, nullable: true })
  additionalCharges: any;

  @ApiPropertyOptional({ type: Object, nullable: true })
  discounts: any;

  @ApiProperty({ example: '0.00' })
  taxAmount: string;

  @ApiProperty({ example: '15000000.00' })
  totalAmount: string;

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiProperty({ example: 'issued' })
  status: string;

  @ApiProperty({ example: 'rent' })
  invoiceType: string;

  @ApiPropertyOptional({ type: InvoiceContentDto, nullable: true })
  invoiceContent: InvoiceContentDto | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  paymentMethod: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  invoiceDocumentUrl: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  sentAt: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  paidAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty()
  rentalContract: any; // Full include with nested apartment and members

  @ApiProperty({ type: [InvoicePaymentSummaryDto] })
  payments: InvoicePaymentSummaryDto[];
}

// ─── Invoice Created DTO ────────────────────────────────────────────

export class InvoiceCreatedDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'INV-202601-00001' })
  invoiceNumber: string;

  @ApiProperty({ example: '15000000.00' })
  totalAmount: string;

  @ApiProperty({ example: 'draft' })
  status: string;

  @ApiProperty()
  dueDate: Date;
}

// ─── Invoice Updated DTO ────────────────────────────────────────────

export class InvoiceUpdatedDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'INV-202601-00001' })
  invoiceNumber: string;

  @ApiProperty({ example: 'issued' })
  status: string;

  @ApiProperty()
  updatedAt: Date;
}
