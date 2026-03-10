import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Contract Summary (nested in UserDetailDto) ─────────────────────

class ContractApartmentSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '123 Nguyen Hue, Q1' })
  address: string;

  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;
}

class ContractSummaryDto {
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

  @ApiProperty({ type: ContractApartmentSummaryDto })
  apartment: ContractApartmentSummaryDto;
}

class ContractMembershipDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'primary' })
  memberType: string;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveInDate: Date | null;

  @ApiPropertyOptional({ example: '50.00', nullable: true })
  sharePercentage: string | null;

  @ApiProperty({ type: ContractSummaryDto })
  rentalContract: ContractSummaryDto;
}

// ─── User List Item DTO (findAll) ────────────────────────────────────

export class UserListItemDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiPropertyOptional({ example: '0901234567', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiPropertyOptional({ example: '1990-05-15T00:00:00.000Z', nullable: true })
  dateOfBirth: Date | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  profileImageUrl: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/identity-card-front.jpg',
    nullable: true,
  })
  identityCardFrontUrl: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/identity-card-back.jpg',
    nullable: true,
  })
  identityCardBackUrl: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── User Detail DTO (findOne / getProfile) ─────────────────────────

export class UserDetailDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiPropertyOptional({ example: '0901234567', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiPropertyOptional({ example: '1990-05-15T00:00:00.000Z', nullable: true })
  dateOfBirth: Date | null;

  @ApiPropertyOptional({ example: '012345678901', nullable: true })
  nationalId: string | null;

  @ApiPropertyOptional({ example: 'A12345678', nullable: true })
  passportNumber: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  profileImageUrl: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/identity-card-front.jpg',
    nullable: true,
  })
  identityCardFrontUrl: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/identity-card-back.jpg',
    nullable: true,
  })
  identityCardBackUrl: string | null;

  @ApiPropertyOptional({ example: 'Tran Thi B', nullable: true })
  emergencyContactName: string | null;

  @ApiPropertyOptional({ example: '0987654321', nullable: true })
  emergencyContactPhone: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiPropertyOptional({ example: '2026-03-10T10:30:00.000Z', nullable: true })
  lastLoginAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: [ContractMembershipDto], nullable: true })
  contractMemberships?: ContractMembershipDto[];
}

// ─── User Created DTO (create response) ─────────────────────────────

export class UserCreatedDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiPropertyOptional({ example: '0901234567', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiPropertyOptional({ example: '1990-05-15T00:00:00.000Z', nullable: true })
  dateOfBirth: Date | null;

  @ApiPropertyOptional({ example: '012345678901', nullable: true })
  nationalId: string | null;

  @ApiPropertyOptional({ example: 'A12345678', nullable: true })
  passportNumber: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  profileImageUrl: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── User Updated DTO (update response) ─────────────────────────────

export class UserUpdatedDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiPropertyOptional({ example: '0901234567', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiPropertyOptional({ example: '1990-05-15T00:00:00.000Z', nullable: true })
  dateOfBirth: Date | null;

  @ApiPropertyOptional({ example: '012345678901', nullable: true })
  nationalId: string | null;

  @ApiPropertyOptional({ example: 'A12345678', nullable: true })
  passportNumber: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  profileImageUrl: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/identity-card-front.jpg',
    nullable: true,
  })
  identityCardFrontUrl: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/identity-card-back.jpg',
    nullable: true,
  })
  identityCardBackUrl: string | null;

  @ApiPropertyOptional({ example: 'Tran Thi B', nullable: true })
  emergencyContactName: string | null;

  @ApiPropertyOptional({ example: '0987654321', nullable: true })
  emergencyContactPhone: string | null;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiProperty()
  updatedAt: Date;
}

// ─── User Identity Card DTO (identity card update response) ────────

export class UserIdentityCardDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiPropertyOptional({
    example: 'https://example.com/identity-card-front.jpg',
    nullable: true,
  })
  identityCardFrontUrl: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/identity-card-back.jpg',
    nullable: true,
  })
  identityCardBackUrl: string | null;

  @ApiProperty()
  updatedAt: Date;
}

// ─── User Verified DTO (verify response) ────────────────────────────

export class UserVerifiedDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiPropertyOptional({ example: '012345678901', nullable: true })
  nationalId: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/identity-card-front.jpg',
    nullable: true,
  })
  identityCardFrontUrl: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/identity-card-back.jpg',
    nullable: true,
  })
  identityCardBackUrl: string | null;

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiProperty()
  updatedAt: Date;
}

// ─── User Deleted DTO (remove response) ─────────────────────────────

export class UserDeletedDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiProperty({ example: false })
  isActive: boolean;

  @ApiProperty()
  updatedAt: Date;
}
