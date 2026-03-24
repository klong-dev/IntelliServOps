import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ type: String, example: 'Thị xã Phú Mỹ', nullable: true })
  districtName: string | null;

  @ApiPropertyOptional({ type: Number, example: 79, nullable: true })
  provinceCode: number | null;

  @ApiPropertyOptional({ type: String, example: 'Thành phố Hồ Chí Minh', nullable: true })
  provinceName: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Xã Châu Pha, Thành phố Hồ Chí Minh',
    nullable: true,
  })
  fullAddress: string | null;
}

// ─── Apartment List Item DTO (search / findByOwner) ───────────────

export class ApartmentListItemDto {
  @ApiProperty({ example: 'd6e0a098-c1e9-4b5d-9207-e507e9a5974d' })
  id: string;

  @ApiPropertyOptional({ type: String, example: 'Saigon Pearl', nullable: true })
  buildingName: string | null;

  @ApiProperty({ example: 'R1-801' })
  apartmentNumber: string;

  @ApiPropertyOptional({ type: Number, example: 8, nullable: true })
  floorNumber: number | null;

  @ApiPropertyOptional({
    type: Number,
    example: 26728,
    nullable: true,
    description: 'Mã phường/xã sau sáp nhập (v2)',
  })
  newWardCode?: number | null;

  @ApiPropertyOptional({
    type: Number,
    example: 26731,
    nullable: true,
    description: 'Mã phường/xã trước sáp nhập (v1)',
  })
  oldWardCode?: number | null;

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

  @ApiPropertyOptional({
    type: WardAddressDto,
    nullable: true,
    description: 'Địa chỉ đã resolve từ mã địa chỉ sau sáp nhập (v2)',
  })
  newAddress?: WardAddressDto | null;

  @ApiPropertyOptional({
    type: WardAddressDto,
    nullable: true,
    description: 'Địa chỉ đã resolve từ mã địa chỉ trước sáp nhập (v1)',
  })
  oldAddress?: WardAddressDto | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Chuỗi địa chỉ hiển thị theo addressType đang filter (new/old/both)',
  })
  displayAddress?: string | null;

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

  @ApiPropertyOptional({
    type: Number,
    example: 26728,
    nullable: true,
    description: 'Mã phường/xã sau sáp nhập (v2)',
  })
  newWardCode?: number | null;

  @ApiPropertyOptional({
    type: Number,
    example: 26731,
    nullable: true,
    description: 'Mã phường/xã trước sáp nhập (v1)',
  })
  oldWardCode?: number | null;

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
    description: 'Mã phường/xã sau sáp nhập (v2)',
  })
  newWardCode: number | null;

  @ApiPropertyOptional({
    type: Number,
    example: 79,
    nullable: true,
    description: 'Mã tỉnh/thành sau sáp nhập (v2), auto-resolved từ wardCode',
  })
  newProvinceCode: number | null;

  @ApiPropertyOptional({
    type: Number,
    example: 26731,
    nullable: true,
    description: 'Mã phường/xã trước sáp nhập (v1)',
  })
  oldWardCode: number | null;

  @ApiPropertyOptional({
    type: Number,
    example: 760,
    nullable: true,
    description: 'Mã quận/huyện trước sáp nhập (v1), auto-resolved từ wardCode',
  })
  oldDistrictCode: number | null;

  @ApiPropertyOptional({
    type: Number,
    example: 77,
    nullable: true,
    description: 'Mã tỉnh/thành trước sáp nhập (v1), auto-resolved từ wardCode',
  })
  oldProvinceCode: number | null;

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
