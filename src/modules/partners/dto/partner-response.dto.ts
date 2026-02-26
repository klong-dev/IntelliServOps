import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Partner Profile DTO ────────────────────────────────────────────

export class PartnerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'partner@company.com' })
  email: string;

  @ApiProperty({ example: '0901234567' })
  phone: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  fullName: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  companyName: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  taxCode: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  nationalId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  bankAccountNumber: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  bankName: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  address: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  contractStartDate: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  contractEndDate: Date | null;

  @ApiPropertyOptional({ example: '10.00', nullable: true })
  commissionRate: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  paymentTerms: string | null;

  @ApiProperty()
  isVerified: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── Partner Request DTO ────────────────────────────────────────────

export class PartnerRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  partnerId: string;

  @ApiProperty({ example: 'apartment' })
  propertyType: string;

  @ApiProperty({ example: '456 Le Loi, Q3' })
  address: string;

  @ApiProperty({ example: 'Ho Chi Minh' })
  city: string;

  @ApiProperty({ example: 'Quan 3' })
  district: string;

  @ApiPropertyOptional({ example: '100.00', nullable: true })
  totalArea: string | null;

  @ApiProperty({ example: 1 })
  numberOfUnits: number;

  @ApiPropertyOptional({ example: '20000000.00', nullable: true })
  expectedRentPrice: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  propertyImages: any;

  @ApiPropertyOptional({ type: Object, nullable: true })
  propertyDocuments: any;

  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  amenities: any;

  @ApiProperty({ example: 'exclusive' })
  preferredContractType: string;

  @ApiProperty({ example: 'submitted' })
  status: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  reviewedByOperatorId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  reviewNotes: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  rejectionReason: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  approvedAt: Date | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  createdApartmentIds: any;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
