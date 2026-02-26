import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Nested DTOs ────────────────────────────────────────────────────

class ContractApartmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;

  @ApiProperty({ example: '123 Nguyen Hue, Q1' })
  address: string;

  @ApiProperty({ example: 'Ho Chi Minh' })
  city: string;
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
}

class ContractMemberDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'primary' })
  memberType: string;

  @ApiProperty()
  isPrimaryContact: boolean;

  @ApiPropertyOptional({ nullable: true })
  moveInDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  moveOutDate: Date | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ type: ContractMemberUserDto })
  user: ContractMemberUserDto;
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

  @ApiProperty({ type: ContractApartmentDto })
  apartment: ContractApartmentDto;
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

  @ApiPropertyOptional({ nullable: true })
  utilitiesIncluded: any;

  @ApiPropertyOptional({ nullable: true })
  utilitiesCharges: any;

  @ApiPropertyOptional({ nullable: true })
  contractTerms: string | null;

  @ApiPropertyOptional({ nullable: true })
  specialConditions: string | null;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  signedDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  contractDocumentUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  terminationDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  terminationReason: string | null;

  @ApiPropertyOptional({ nullable: true })
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
