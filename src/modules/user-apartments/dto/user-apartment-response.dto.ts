import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class UserApartmentListApartmentDto {
  @ApiProperty({ example: 'd6e0a098-c1e9-4b5d-9207-e507e9a5974d' })
  id!: string;

  @ApiProperty({ example: 'A-1208' })
  apartmentNumber!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Intelli Tower A',
  })
  buildingName!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 12 })
  floorNumber!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 26728 })
  wardCode!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 79 })
  provinceCode!: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '12 Nguyen Hue, Phuong Ben Nghe',
  })
  streetAddress!: string | null;

  @ApiPropertyOptional({ nullable: true })
  images!: unknown;

  @ApiProperty({ example: 'available' })
  status!: string;
}

class UserApartmentListContractDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'CTR-2026-00001' })
  contractNumber!: string;

  @ApiProperty({ example: 'active' })
  status!: string;
}

class UserApartmentUserIdentityDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  nationalId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  passportNumber!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  name!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  dob!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  sex!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  nationality!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  address!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  issueDate!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  doe!: string | null;

  @ApiProperty()
  isVerified!: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  verifiedAt!: Date | null;
}

class UserApartmentUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName!: string;

  @ApiProperty({ example: 'a@example.com' })
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  profileImageUrl!: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  dateOfBirth!: Date | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  isVerified!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  emergencyContactName!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  emergencyContactPhone!: string | null;

  @ApiPropertyOptional({ type: UserApartmentUserIdentityDto, nullable: true })
  identity!: UserApartmentUserIdentityDto | null;
}

class UserApartmentPersonDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  phone!: string | null;
}

class UserApartmentAmenityDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'wifi' })
  code!: string;

  @ApiProperty({ example: 'Wi-Fi' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  icon!: string | null;

  @ApiProperty()
  isActive!: boolean;
}

class UserApartmentApartmentAmenityDto {
  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: UserApartmentAmenityDto })
  amenity!: UserApartmentAmenityDto;
}

class UserApartmentPolicySummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'rental_rules' })
  policyType!: string;

  @ApiProperty({ example: 'No smoking inside apartment' })
  title!: string;

  @ApiProperty({ example: '1.0' })
  version!: string;

  @ApiProperty({ example: 'vi' })
  language!: string;

  @ApiProperty()
  effectiveDate!: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  expiryDate!: Date | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  requiresAcceptance!: boolean;

  @ApiProperty()
  displayOrder!: number;
}

class UserApartmentApartmentPolicyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  isRequired!: boolean;

  @ApiProperty()
  effectiveDate!: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  expiryDate!: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: UserApartmentPolicySummaryDto })
  policy!: UserApartmentPolicySummaryDto;
}

class UserApartmentRoomDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'R01' })
  roomNumber!: string;

  @ApiProperty({ example: 'bedroom' })
  roomType!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  area!: string | null;

  @ApiProperty()
  hasWindow!: boolean;

  @ApiProperty()
  hasAirConditioning!: boolean;

  @ApiProperty()
  hasPrivateBathroom!: boolean;

  @ApiProperty()
  maxOccupancy!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  rentPrice!: string | null;

  @ApiProperty({ example: 'available' })
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  images!: unknown;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

class UserApartmentDetailApartmentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  apartmentNumber!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  buildingName!: string | null;

  @ApiProperty()
  maxConcurrentViewings!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  floorNumber!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  wardCode!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  provinceCode!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  streetAddress!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  latitude!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  longitude!: string | null;

  @ApiProperty({ type: String })
  totalArea!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  usableArea!: string | null;

  @ApiProperty()
  maxOccupants!: number;

  @ApiProperty()
  numberOfBedrooms!: number;

  @ApiProperty()
  numberOfBathrooms!: number;

  @ApiProperty({ example: 'semi_furnished' })
  furnishingStatus!: string;

  @ApiPropertyOptional({ nullable: true })
  amenities!: unknown;

  @ApiProperty({ type: String })
  baseRentPrice!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  depositAmount!: string | null;

  @ApiProperty({ example: 'available' })
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  images!: unknown;

  @ApiPropertyOptional({ type: String, nullable: true })
  videoTourUrl!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  yearBuilt!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  ownerId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  approvedByOperatorId!: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  approvedAt!: Date | null;

  @ApiPropertyOptional({ type: UserApartmentPersonDto, nullable: true })
  owner!: UserApartmentPersonDto | null;

  @ApiPropertyOptional({ type: UserApartmentPersonDto, nullable: true })
  approvedByOperator!: UserApartmentPersonDto | null;

  @ApiProperty({ type: [UserApartmentApartmentAmenityDto] })
  apartmentAmenities!: UserApartmentApartmentAmenityDto[];

  @ApiProperty({ type: [UserApartmentApartmentPolicyDto] })
  apartmentPolicies!: UserApartmentApartmentPolicyDto[];

  @ApiProperty({ type: [UserApartmentRoomDto] })
  rooms!: UserApartmentRoomDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

class UserApartmentContractMemberDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  rentalContractId!: string;

  @ApiProperty({ example: 'co_tenant' })
  memberType!: string;

  @ApiProperty()
  isPrimaryContact!: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveInDate!: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveOutDate!: Date | null;

  @ApiProperty()
  notificationEnabled!: boolean;

  @ApiProperty({ example: 'full' })
  accessLevel!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  sharePercentage!: string | null;

  @ApiProperty({ example: 'active' })
  status!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: UserApartmentPersonDto })
  user!: UserApartmentPersonDto;
}

class UserApartmentContractBriefDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  contractNumber!: string;

  @ApiProperty({ example: 'active' })
  status!: string;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;
}

class UserApartmentDetailContractDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'CTR-2026-00001' })
  contractNumber!: string;

  @ApiProperty()
  apartmentId!: string;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;

  @ApiProperty({ type: String })
  monthlyRent!: string;

  @ApiProperty({ type: String })
  depositAmount!: string;

  @ApiProperty()
  paymentDueDay!: number;

  @ApiProperty({ example: 'bank_transfer' })
  paymentMethod!: string;

  @ApiPropertyOptional({ nullable: true })
  utilitiesIncluded!: unknown;

  @ApiPropertyOptional({ nullable: true })
  utilitiesCharges!: unknown;

  @ApiPropertyOptional({ type: String, nullable: true })
  contractTerms!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  specialConditions!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  landlordName!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  landlordIdNumber!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  landlordIdIssueDate!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  landlordIdIssuePlace!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  landlordAddress!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  landlordPhone!: string | null;

  @ApiProperty({ example: 'active' })
  status!: string;

  @ApiProperty({ example: 'normal' })
  category!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  renewedFromContractId!: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  signedDate!: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  contractDocumentUrl!: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  terminationDate!: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  terminationReason!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  earlyTerminationFee!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  createdByStaffId!: string | null;

  @ApiPropertyOptional({ type: UserApartmentPersonDto, nullable: true })
  createdByStaff!: UserApartmentPersonDto | null;

  @ApiProperty({ type: [UserApartmentContractMemberDto] })
  members!: UserApartmentContractMemberDto[];

  @ApiPropertyOptional({ type: UserApartmentContractBriefDto, nullable: true })
  renewedFromContract!: UserApartmentContractBriefDto | null;

  @ApiProperty({ type: [UserApartmentContractBriefDto] })
  renewalContracts!: UserApartmentContractBriefDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class UserApartmentListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  apartmentId!: string;

  @ApiProperty()
  rentalContractId!: string;

  @ApiProperty({ example: 'active' })
  status!: string;

  @ApiProperty()
  isPrimaryTenant!: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveInDate!: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveOutDate!: Date | null;

  @ApiProperty({
    example: true,
    description:
      'True when the apartment door PIN has not been initialized yet and the tenant must set it on first use.',
  })
  isFirstPass!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  buildingGateCode!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  smartLockPin!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  mailboxCode!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  parkingAccessCode!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  wifiName!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  wifiPassword!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  emergencyContactName!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  emergencyContactPhone!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: UserApartmentListApartmentDto })
  apartment!: UserApartmentListApartmentDto;

  @ApiProperty({ type: UserApartmentListContractDto })
  rentalContract!: UserApartmentListContractDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class UserApartmentDetailDto extends UserApartmentListItemDto {
  @ApiProperty({ type: UserApartmentUserDto })
  user!: UserApartmentUserDto;

  @ApiProperty({ type: UserApartmentDetailApartmentDto })
  declare apartment: UserApartmentDetailApartmentDto;

  @ApiProperty({ type: UserApartmentDetailContractDto })
  declare rentalContract: UserApartmentDetailContractDto;
}

export class UserApartmentMutationResultDto extends UserApartmentListItemDto {}
