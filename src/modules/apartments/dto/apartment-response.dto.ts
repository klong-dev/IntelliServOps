import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Partner Nested DTO ─────────────────────────────────────────────

class PartnerSummaryDto {
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

// ─── Apartment List Item DTO (search / findByPartner) ───────────────

export class ApartmentListItemDto {
  @ApiProperty({ example: 'd6e0a098-c1e9-4b5d-9207-e507e9a5974d' })
  id: string;

  @ApiPropertyOptional({ type: String, example: 'Saigon Pearl', nullable: true })
  buildingName: string | null;

  @ApiProperty({ example: 'R1-801' })
  apartmentNumber: string;

  @ApiPropertyOptional({ type: Number, example: 8, nullable: true })
  floorNumber: number | null;

  @ApiProperty({ example: '92 Nguyễn Hữu Cảnh' })
  address: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Hồ Chí Minh',
    nullable: true,
    description: 'Tỉnh/Thành phố (sau sáp nhập)',
  })
  city?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Quận Bình Thạnh',
    nullable: true,
    description: 'Quận/Huyện (sau sáp nhập)',
  })
  district?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Thành phố Hồ Chí Minh',
    nullable: true,
    description: 'Tỉnh/Thành phố (trước sáp nhập)',
  })
  oldCity?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Quận 9',
    nullable: true,
    description: 'Quận/Huyện (trước sáp nhập)',
  })
  oldDistrict?: string | null;

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

  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  images: string[] | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── Apartment Detail DTO (findOne) ─────────────────────────────────

export class ApartmentDetailDto {
  @ApiProperty({ example: 'd6e0a098-c1e9-4b5d-9207-e507e9a5974d' })
  id: string;

  @ApiPropertyOptional({ type: String, example: 'Saigon Pearl', nullable: true })
  buildingName: string | null;

  @ApiProperty({ example: 'R1-801' })
  apartmentNumber: string;

  @ApiProperty({ type: Number, example: 2 })
  maxConcurrentViewings: number;

  @ApiPropertyOptional({ type: Number, example: 8, nullable: true })
  floorNumber: number | null;

  @ApiProperty({ example: '92 Nguyễn Hữu Cảnh' })
  address: string;

  @ApiProperty({ example: 'Hồ Chí Minh' })
  city: string;

  @ApiProperty({ example: 'Quận Bình Thạnh' })
  district: string;

  @ApiPropertyOptional({ type: String, example: 'Phường 22', nullable: true })
  ward?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Thành phố Hồ Chí Minh',
    nullable: true,
    description: 'Tỉnh/Thành phố (trước sáp nhập)',
  })
  oldCity?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Quận 9',
    nullable: true,
    description: 'Quận/Huyện (trước sáp nhập)',
  })
  oldDistrict?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Phường Long Thạnh Mỹ',
    nullable: true,
    description: 'Phường/Xã (trước sáp nhập)',
  })
  oldWard?: string | null;

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

  @ApiPropertyOptional({ type: [String], example: ['Hồ bơi', 'Gym'], nullable: true })
  amenities: string[] | null;

  @ApiProperty({ example: '12000000' })
  baseRentPrice: string;

  @ApiPropertyOptional({ type: String, example: '24000000', nullable: true })
  depositAmount: string | null;

  @ApiProperty({ example: 'available' })
  status: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  images: string[] | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  videoTourUrl: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  yearBuilt: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  partnerId: string | null;

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

  @ApiPropertyOptional({ type: PartnerSummaryDto })
  partner?: PartnerSummaryDto;

  @ApiProperty({ type: [Object], example: [] })
  iotDevices: any[];

  @ApiProperty({ type: [Object], example: [] })
  utilityMeters: any[];
}

// ─── Apartment Create/Update Result ─────────────────────────────────

export class ApartmentMutationResultDto {
  @ApiProperty({ example: 'd6e0a098-c1e9-4b5d-9207-e507e9a5974d' })
  id: string;

  @ApiProperty({ example: 'R1-801' })
  apartmentNumber: string;

  @ApiProperty({ example: '92 Nguyễn Hữu Cảnh' })
  address: string;

  @ApiProperty({ example: 'Hồ Chí Minh' })
  city: string;

  @ApiProperty({ example: 'Quận Bình Thạnh' })
  district: string;

  @ApiProperty({ example: '12000000' })
  baseRentPrice: string;

  @ApiProperty({ example: 'available' })
  status: string;

  @ApiProperty()
  createdAt: Date;
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
