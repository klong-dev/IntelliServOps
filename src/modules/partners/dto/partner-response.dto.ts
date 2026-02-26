import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Partner Profile DTO ────────────────────────────────────────────

export class PartnerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'partner@company.com' })
  email: string;

  @ApiProperty({ example: '0901234567' })
  phone: string;

  @ApiPropertyOptional({ nullable: true })
  fullName: string | null;

  @ApiPropertyOptional({ nullable: true })
  companyName: string | null;

  @ApiPropertyOptional({ nullable: true })
  taxCode: string | null;

  @ApiPropertyOptional({ nullable: true })
  nationalId: string | null;

  @ApiPropertyOptional({ nullable: true })
  bankAccountNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  bankName: string | null;

  @ApiPropertyOptional({ nullable: true })
  address: string | null;

  @ApiPropertyOptional({ nullable: true })
  contractStartDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  contractEndDate: Date | null;

  @ApiPropertyOptional({ example: '10.00', nullable: true })
  commissionRate: string | null;

  @ApiPropertyOptional({ nullable: true })
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

  @ApiPropertyOptional({ nullable: true })
  propertyImages: any;

  @ApiPropertyOptional({ nullable: true })
  propertyDocuments: any;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  amenities: any;

  @ApiProperty({ example: 'exclusive' })
  preferredContractType: string;

  @ApiProperty({ example: 'submitted' })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  reviewedByOperatorId: string | null;

  @ApiPropertyOptional({ nullable: true })
  reviewNotes: string | null;

  @ApiPropertyOptional({ nullable: true })
  rejectionReason: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  createdApartmentIds: any;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
