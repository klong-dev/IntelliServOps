import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// ─── Owner Nested DTO ─────────────────────────────────────────────

class OwnerSummaryDto {
  @ApiProperty({ example: 'e33f798c-7978-4a86-b243-b3ac43e020ba' })
  id: string;

  @ApiProperty({ example: 'Công ty Đầu tư Hoàng Gia' })
  companyName: string;

  @ApiProperty({ example: 'Trương Thị Đầu Tư' })
  fullName: string;
}

// ─── Room DTO (nested in ApartmentDetailDto) ────────────────────────

class RoomDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'R01' })
  roomNumber: string;

  @ApiProperty({ example: 'bedroom' })
  roomType: string;

  @ApiPropertyOptional({ type: String, example: '20.00', nullable: true })
  area: string | null;

  @ApiProperty({ example: true })
  hasWindow: boolean;

  @ApiProperty({ example: true })
  hasAirConditioning: boolean;

  @ApiProperty({ example: false })
  hasPrivateBathroom: boolean;

  @ApiProperty({ example: 1 })
  maxOccupancy: number;

  @ApiPropertyOptional({ type: String, example: '5000000.00', nullable: true })
  rentPrice: string | null;

  @ApiProperty({ example: 'available' })
  status: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  images: string[] | null;
}

class WardAddressDto {
  @ApiProperty({ example: 26728 })
  wardCode: number;

  @ApiPropertyOptional({ type: String, example: 'Xã Châu Pha', nullable: true })
  wardName: string | null;

  @ApiPropertyOptional({ type: Number, example: 754, nullable: true })
  districtCode: number | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Thị xã Phú Mỹ',
    nullable: true,
  })
  districtName: string | null;

  @ApiPropertyOptional({ type: Number, example: 79, nullable: true })
  provinceCode: number | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Thành phố Hồ Chí Minh',
    nullable: true,
  })
  provinceName: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Xã Châu Pha, Thành phố Hồ Chí Minh',
    nullable: true,
  })
  fullAddress: string | null;
}

class RentalContractLinkedUserDto {
  @ApiProperty({ example: 'e33f798c-7978-4a86-b243-b3ac43e020ba' })
  id: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;
}

class RentalContractMemberLinkDto {
  @ApiProperty({ example: '7c2946d7-b237-4e6d-aec4-8f055f8d12f0' })
  id: string;

  @ApiProperty({ example: 'primary' })
  memberType: string;

  @ApiProperty({ example: true })
  isPrimaryContact: boolean;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ type: RentalContractLinkedUserDto })
  user: RentalContractLinkedUserDto;
}

class ApartmentUserApartmentContractDto {
  @ApiProperty({ example: '5e10f4d8-1c14-48f5-8ad4-e35ea928f2a3' })
  id: string;

  @ApiProperty({ example: 'CTR-2026-00001' })
  contractNumber: string;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ type: [RentalContractMemberLinkDto] })
  members: RentalContractMemberLinkDto[];
}

class ApartmentUserApartmentDto {
  @ApiProperty({ example: 'ce47fe96-d6a9-4df2-9f95-c0a7ac4a4d5c' })
  id: string;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty({ example: true })
  isPrimaryTenant: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveInDate: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveOutDate: Date | null;

  @ApiProperty({ type: RentalContractLinkedUserDto })
  user: RentalContractLinkedUserDto;

  @ApiProperty({ type: ApartmentUserApartmentContractDto })
  rentalContract: ApartmentUserApartmentContractDto;
}

export class ApartmentCooperationContractDto {
  @ApiProperty({ example: '3f5369be-815f-42cb-8a8b-971fbe4a3557' })
  id: string;

  @ApiProperty({ example: 'COOP-2026-00001' })
  contractNumber: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiPropertyOptional({ type: Date, nullable: true })
  startDate?: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  endDate?: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  signedDate?: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  contractDocumentUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  cooperationContractPdfUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  cooperationContractPublicPdfUrl?: string | null;
}

// ─── Apartment List Item DTO (search / findByOwner) ───────────────

export class ApartmentListItemDto {
  @ApiProperty({ example: 'd6e0a098-c1e9-4b5d-9207-e507e9a5974d' })
  id: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Saigon Pearl',
    nullable: true,
  })
  buildingName: string | null;

  @ApiProperty({ example: 'R1-801' })
  apartmentNumber: string;

  @ApiPropertyOptional({ type: Number, example: 8, nullable: true })
  floorNumber: number | null;

  @ApiPropertyOptional({
    type: Number,
    example: 26728,
    nullable: true,
    description: 'Mã phường/xã (v2)',
  })
  wardCode?: number | null;

  @ApiPropertyOptional({
    type: Number,
    example: 79,
    nullable: true,
    description: 'Mã tỉnh/thành (v2), auto-resolved từ wardCode',
  })
  provinceCode?: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '12 Nguyễn Huệ, Phường Bến Nghé',
    description: 'Địa chỉ cụ thể (số nhà, ngõ, hẻm, đường...)',
  })
  streetAddress?: string | null;

  @ApiProperty({ example: '55' })
  totalArea: string;

  @ApiProperty({ example: 1 })
  numberOfBedrooms: number;

  @ApiProperty({ example: 1 })
  numberOfBathrooms: number;

  @ApiProperty({ example: 'semi_furnished' })
  furnishingStatus: string;

  @ApiProperty({ example: '12000000' })
  baseRentPrice: string;

  @ApiPropertyOptional({ type: String, example: '24000000', nullable: true })
  depositAmount: string | null;

  @ApiProperty({ example: 'available' })
  status: string;

  @ApiPropertyOptional({
    type: Number,
    example: 4.5,
    nullable: true,
    description: 'Diem danh gia trung binh cua apartment (1-5)',
  })
  rating?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  images: string[] | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  videoTourUrl: string | null;

  @ApiPropertyOptional({
    type: [ApartmentCooperationContractDto],
    nullable: true,
    description:
      'Danh sach hop dong hop tac lien quan toi apartment (thuong dung cho owner dashboard)',
    example: [
      {
        id: '3f5369be-815f-42cb-8a8b-971fbe4a3557',
        contractNumber: 'COOP-2026-00001',
        status: 'pending',
        startDate: '2026-03-01T00:00:00.000Z',
        endDate: '2027-03-01T00:00:00.000Z',
        signedDate: '2026-03-01T10:20:30.000Z',
        contractDocumentUrl:
          'https://storage.example.com/cooperation/COOP-2026-00001.pdf',
        cooperationContractPdfUrl:
          '/apartments/cooperation-contracts/3f5369be-815f-42cb-8a8b-971fbe4a3557/pdf',
        cooperationContractPublicPdfUrl:
          '/apartments/cooperation-contracts/pdf/view?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      },
    ],
  })
  cooperationContracts?: ApartmentCooperationContractDto[] | null;

  @ApiPropertyOptional({
    type: ApartmentCooperationContractDto,
    nullable: true,
    description:
      'Hop dong hop tac tuong ung moi nhat cua apartment (owner dashboard)',
  })
  cooperationContract?: ApartmentCooperationContractDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── Apartment Detail DTO (findOne) ─────────────────────────────────

export class ApartmentDetailDto {
  @ApiProperty({ example: 'd6e0a098-c1e9-4b5d-9207-e507e9a5974d' })
  id: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Saigon Pearl',
    nullable: true,
  })
  buildingName: string | null;

  @ApiProperty({ example: 'R1-801' })
  apartmentNumber: string;

  @ApiProperty({ type: Number, example: 2 })
  maxConcurrentViewings: number;

  @ApiPropertyOptional({ type: Number, example: 8, nullable: true })
  floorNumber: number | null;

  @ApiPropertyOptional({
    type: Number,
    example: 26728,
    nullable: true,
    description: 'Mã phường/xã (v2)',
  })
  wardCode?: number | null;

  @ApiPropertyOptional({
    type: Number,
    example: 79,
    nullable: true,
    description: 'Mã tỉnh/thành (v2), auto-resolved từ wardCode',
  })
  provinceCode?: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '12 Nguyễn Huệ, Phường Bến Nghé',
    description: 'Địa chỉ cụ thể (số nhà, ngõ, hẻm, đường...)',
  })
  streetAddress?: string | null;

  @ApiPropertyOptional({ type: String, example: '10.788', nullable: true })
  latitude: string | null;

  @ApiPropertyOptional({ type: String, example: '106.7195', nullable: true })
  longitude: string | null;

  @ApiProperty({ example: '55' })
  totalArea: string;

  @ApiPropertyOptional({ type: String, example: '50', nullable: true })
  usableArea: string | null;

  @ApiProperty({ example: 1 })
  numberOfBedrooms: number;

  @ApiProperty({ example: 1 })
  numberOfBathrooms: number;

  @ApiProperty({ example: 'semi_furnished' })
  furnishingStatus: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Hồ bơi', 'Gym'],
    nullable: true,
  })
  amenities: string[] | null;

  @ApiProperty({ example: '12000000' })
  baseRentPrice: string;

  @ApiPropertyOptional({ type: String, example: '24000000', nullable: true })
  depositAmount: string | null;

  @ApiProperty({ example: 'available' })
  status: string;

  @ApiPropertyOptional({
    type: Number,
    example: 4.5,
    nullable: true,
    description: 'Diem danh gia trung binh cua apartment (1-5)',
  })
  rating?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  images: string[] | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  videoTourUrl: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  yearBuilt: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  ownerId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  approvedByOperatorId: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  approvedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [RoomDto] })
  rooms: RoomDto[];

  @ApiPropertyOptional({ type: OwnerSummaryDto })
  owner?: OwnerSummaryDto;

  @ApiProperty({ type: [Object], example: [] })
  iotDevices: any[];

  @ApiProperty({ type: [Object], example: [] })
  utilityMeters: any[];

  @ApiProperty({
    type: [ApartmentUserApartmentDto],
    description:
      'Danh sach userApartment duoc lay tu rental contract co status active',
    example: [],
  })
  userApartments: ApartmentUserApartmentDto[];
}

// ─── Apartment Create/Update Result ─────────────────────────────────

export class ApartmentMutationResultDto {
  @ApiProperty({ example: 'd6e0a098-c1e9-4b5d-9207-e507e9a5974d' })
  id: string;

  @ApiProperty({ example: 'R1-801' })
  apartmentNumber: string;

  @ApiPropertyOptional({
    type: Number,
    example: 26728,
    nullable: true,
    description: 'Mã phường/xã (v2)',
  })
  wardCode: number | null;

  @ApiPropertyOptional({
    type: Number,
    example: 79,
    nullable: true,
    description: 'Mã tỉnh/thành (v2), auto-resolved từ wardCode',
  })
  provinceCode: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '12 Nguyễn Huệ, Phường Bến Nghé',
    description: 'Địa chỉ cụ thể (số nhà, ngõ, hẻm, đường...)',
  })
  streetAddress: string | null;

  @ApiProperty({ example: '12000000' })
  baseRentPrice: string;

  @ApiPropertyOptional({ type: [String], nullable: true })
  images: string[] | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  videoTourUrl: string | null;

  @ApiProperty({ example: 'available' })
  status: string;

  @ApiPropertyOptional({ type: Date, nullable: true })
  createdAt?: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  updatedAt?: Date;
}

// ─── Apartment Status Result ────────────────────────────────────────

export class ApartmentStatusResultDto {
  @ApiProperty({ example: 'd6e0a098-c1e9-4b5d-9207-e507e9a5974d' })
  id: string;

  @ApiProperty({ example: 'R1-801' })
  apartmentNumber: string;

  @ApiProperty({ example: 'available' })
  status: string;
}

export class RateApartmentDto {
  @ApiProperty({
    example: 5,
    minimum: 1,
    maximum: 5,
    description: 'Diem danh gia tu 1 den 5',
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    example: 'Can ho sach se, quan ly ho tro nhanh.',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comment?: string;
}

export class ApartmentRatingResultDto {
  @ApiProperty({ example: 'fbec65aa-facd-45f8-bd7b-97317018f3e6' })
  id: string;

  @ApiProperty({ example: 'd6e0a098-c1e9-4b5d-9207-e507e9a5974d' })
  apartmentId: string;

  @ApiProperty({ example: 'e33f798c-7978-4a86-b243-b3ac43e020ba' })
  userId: string;

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Can ho sach se, quan ly ho tro nhanh.',
  })
  comment: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 4.5,
    description: 'Diem danh gia trung binh moi nhat cua apartment',
  })
  averageRating: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
