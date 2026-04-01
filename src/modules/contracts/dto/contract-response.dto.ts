import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Nested DTOs ────────────────────────────────────────────────────

class ContractApartmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 26728 })
  wardCode: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 79 })
  provinceCode: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '12 Nguyễn Huệ, Phường Bến Nghé',
  })
  streetAddress: string | null;
}

class WardAddressDto {
  @ApiProperty({ example: 26728 })
  wardCode: number;

  @ApiPropertyOptional({ type: String, example: 'Xa Chau Pha', nullable: true })
  wardName: string | null;

  @ApiPropertyOptional({ type: Number, example: 754, nullable: true })
  districtCode: number | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Thi xa Phu My',
    nullable: true,
  })
  districtName: string | null;

  @ApiPropertyOptional({ type: Number, example: 79, nullable: true })
  provinceCode: number | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Thanh pho Ho Chi Minh',
    nullable: true,
  })
  provinceName: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Xa Chau Pha, Thanh pho Ho Chi Minh',
    nullable: true,
  })
  fullAddress: string | null;
}

class ContractMemberUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: '0901234567' })
  phone: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '079203001234',
  })
  nationalId?: string | null;
}

class ContractMemberDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'primary' })
  memberType: string;

  @ApiProperty()
  isPrimaryContact: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveInDate: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveOutDate: Date | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ type: ContractMemberUserDto })
  user: ContractMemberUserDto;
}

class ContractListMemberUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;
}

class ContractListMemberDto {
  @ApiProperty({ type: ContractListMemberUserDto })
  user: ContractListMemberUserDto;

  @ApiProperty({ example: 'primary' })
  memberType: string;

  @ApiProperty()
  isPrimaryContact: boolean;
}

// ─── Contract List Item DTO (findAll) ───────────────────────────────

export class ContractListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'CTR-202601-00001' })
  contractNumber: string;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty({ example: '15000000.00' })
  monthlyRent: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ example: true })
  hasPdf: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '/contracts/pdf/view?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  })
  pdfUrl: string | null;

  @ApiProperty({ type: ContractApartmentDto })
  apartment: ContractApartmentDto;

  @ApiProperty({ type: [ContractListMemberDto] })
  members: ContractListMemberDto[];
}

// ─── Contract Detail DTO (findOne) ──────────────────────────────────

export class ContractDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'CTR-202601-00001' })
  contractNumber: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty({ example: '15000000.00' })
  monthlyRent: string;

  @ApiProperty({ example: '30000000.00' })
  depositAmount: string;

  @ApiProperty({ example: 5 })
  paymentDueDay: number;

  @ApiProperty({ example: 'bank_transfer' })
  paymentMethod: string;

  @ApiPropertyOptional({ type: Object, nullable: true })
  utilitiesIncluded: any;

  @ApiPropertyOptional({ type: Object, nullable: true })
  utilitiesCharges: any;

  @ApiPropertyOptional({ type: String, nullable: true })
  contractTerms: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  specialConditions: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Cong ty TNHH IntelliServOps',
  })
  landlordName: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '0312345678',
  })
  landlordIdNumber: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '01/01/2020',
  })
  landlordIdIssueDate: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'So KH&DT TP. Ho Chi Minh',
  })
  landlordIdIssuePlace: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'TP. Ho Chi Minh, Viet Nam',
  })
  landlordAddress: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '1900 0000',
  })
  landlordPhone: string | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiPropertyOptional({ type: Date, nullable: true })
  signedDate: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  contractDocumentUrl: string | null;

  @ApiProperty({ example: true })
  hasPdf: boolean;

  @ApiProperty({
    example: '/contracts/9fbc9e7e-5a4d-4f38-9ba8-cc96af4f0eaf/pdf',
  })
  pdfUrl: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '/contracts/pdf/view?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  })
  publicPdfUrl?: string | null;

  @ApiProperty({ example: false })
  hasLandlordSignature: boolean;

  @ApiProperty({ example: false })
  hasTenantSignature: boolean;

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

  @ApiProperty({ type: ContractApartmentDto })
  apartment: ContractApartmentDto;

  @ApiProperty({ type: [ContractMemberDto] })
  members: ContractMemberDto[];
}
