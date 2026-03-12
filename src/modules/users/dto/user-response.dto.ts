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

// ─── User Identity DTO (nested in User responses) ────────────────────

export class UserIdentityDetailDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiPropertyOptional({ example: '012345678901', nullable: true })
  nationalId: string | null;

  @ApiPropertyOptional({ example: 'A12345678', nullable: true })
  passportNumber: string | null;

  @ApiPropertyOptional({ example: 'Nguyen Van A', nullable: true })
  name: string | null;

  @ApiPropertyOptional({ example: '01/01/1990', nullable: true })
  dob: string | null;

  @ApiPropertyOptional({ example: 'M', nullable: true })
  sex: string | null;

  @ApiPropertyOptional({ example: 'Việt Nam', nullable: true })
  nationality: string | null;

  @ApiPropertyOptional({ example: 'Kinh', nullable: true })
  ethnicity: string | null;

  @ApiPropertyOptional({ example: 'Ha Noi', nullable: true })
  home: string | null;

  @ApiPropertyOptional({
    example: '123 Tran Hung Dao, Hoan Kiem, Ha Noi',
    nullable: true,
  })
  address: string | null;

  @ApiPropertyOptional({ example: 'Ha Noi', nullable: true })
  province: string | null;

  @ApiPropertyOptional({ example: 'Hoan Kiem', nullable: true })
  district: string | null;

  @ApiPropertyOptional({ example: 'Hoan Kiem', nullable: true })
  ward: string | null;

  @ApiPropertyOptional({ example: '123 Tran Hung Dao', nullable: true })
  street: string | null;

  @ApiPropertyOptional({ example: 'Sẹo 2cm trán phải', nullable: true })
  features: string | null;

  @ApiPropertyOptional({ example: '01/01/2020', nullable: true })
  issueDate: string | null;

  @ApiPropertyOptional({ example: '01/01/2030', nullable: true })
  doe: string | null;

  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiPropertyOptional({ example: '2026-03-10T10:30:00.000Z', nullable: true })
  verifiedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── AI Verification Result ─────────────────────────────────────────

class AiVerificationResultDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiPropertyOptional({
    example: '012345678901',
    nullable: true,
  })
  extractedId: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: {
      id: '012345678901',
      name: 'Nguyen Van A',
      dob: '15/05/1990',
      sex: 'M',
      nationality: 'VN',
      home: 'Ha Noi',
      address: '123 Tran Hung Dao',
      province: 'Ha Noi',
      district: 'Hoan Kiem',
      ward: 'Hoan Kiem',
      street: '123 Tran Hung Dao',
    },
  })
  extractedInfo: Record<string, any> | null;
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
    type: UserIdentityDetailDto,
    nullable: true,
  })
  identity?: UserIdentityDetailDto | null;

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

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  profileImageUrl: string | null;

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

  @ApiPropertyOptional({
    type: UserIdentityDetailDto,
    nullable: true,
  })
  identity?: UserIdentityDetailDto | null;

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

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  profileImageUrl: string | null;

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
    type: UserIdentityDetailDto,
    nullable: true,
  })
  identity?: UserIdentityDetailDto | null;

  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiPropertyOptional({
    type: AiVerificationResultDto,
    nullable: true,
  })
  aiVerification?: AiVerificationResultDto | null;

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

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiPropertyOptional({
    type: UserIdentityDetailDto,
    nullable: true,
  })
  identity?: UserIdentityDetailDto | null;

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
