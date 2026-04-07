import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Nested DTOs ────────────────────────────────────────────────────

class InvoiceContractApartmentDto {
  @ApiProperty({ example: 'apt-123' })
  id: string;

  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 26728 })
  wardCode: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Phuong Ben Nghe',
  })
  wardName?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Thanh pho Ho Chi Minh',
  })
  provinceName?: string | null;
}

class InvoiceContractMemberUserDto {
  @ApiProperty({ example: 'user-123' })
  id: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiProperty({ example: 'a@example.com' })
  email: string;
}

class InvoiceContractMemberDto {
  @ApiProperty({ example: 'primary' })
  memberType: string;

  @ApiProperty({ example: true })
  isPrimaryContact: boolean;

  @ApiProperty({ type: InvoiceContractMemberUserDto })
  user: InvoiceContractMemberUserDto;
}

class InvoiceCreatedByStaffDto {
  @ApiProperty({ example: 'staff-123' })
  id: string;

  @ApiProperty({ example: 'Tran Van B' })
  fullName: string;
}

class InvoiceContractSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'CTR-202601-00001' })
  contractNumber: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty({ example: '12000000.00' })
  monthlyRent: string;

  @ApiProperty({ example: '24000000.00' })
  depositAmount: string;

  @ApiProperty({ example: 5 })
  paymentDueDay: number;

  @ApiProperty({ example: 'bank_transfer' })
  paymentMethod: string;

  @ApiProperty({ example: 'signed' })
  status: string;

  @ApiPropertyOptional({ type: Date, nullable: true })
  signedDate: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  contractDocumentUrl: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  contractTerms: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  specialConditions: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  terminationDate: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  terminationReason: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  earlyTerminationFee: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: InvoiceContractApartmentDto })
  apartment: InvoiceContractApartmentDto;

  @ApiProperty({ type: [InvoiceContractMemberDto] })
  members: InvoiceContractMemberDto[];

  @ApiPropertyOptional({ type: InvoiceCreatedByStaffDto, nullable: true })
  createdByStaff: InvoiceCreatedByStaffDto | null;
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

  @ApiProperty({
    type: InvoiceContractSummaryDto,
    description: 'Contract information for this invoice',
  })
  contract: InvoiceContractSummaryDto;
}

export class InvoiceListPaginatedDto {
  @ApiProperty({ type: [InvoiceListItemDto] })
  items: InvoiceListItemDto[];

  @ApiProperty({ example: 120 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 6 })
  totalPages: number;
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
  utilityCharges: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  additionalCharges: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  discounts: Record<string, unknown> | null;

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
  rentalContract: InvoiceContractSummaryDto;

  @ApiProperty({
    description: 'Contract information for this invoice',
  })
  contract: InvoiceContractSummaryDto;

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
