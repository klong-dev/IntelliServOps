import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Apartment List Item DTO (search / findByPartner) ───────────────

export class ApartmentListItemDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  buildingName: string | null;

  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;

  @ApiPropertyOptional({ nullable: true })
  apartmentType: string | null;

  @ApiPropertyOptional({ nullable: true })
  floorNumber: number | null;

  @ApiProperty({ example: '123 Nguyen Hue, Q1' })
  address: string;

  @ApiProperty({ example: 'Ho Chi Minh' })
  city: string;

  @ApiProperty({ example: 'Quan 1' })
  district: string;

  @ApiProperty({ example: '75.50' })
  totalArea: string;

  @ApiProperty({ example: 2 })
  numberOfBedrooms: number;

  @ApiProperty({ example: 1 })
  numberOfBathrooms: number;

  @ApiProperty({ example: 'fully_furnished' })
  furnishingStatus: string;

  @ApiProperty({ example: '15000000.00' })
  baseRentPrice: string;

  @ApiPropertyOptional({ example: '30000000.00', nullable: true })
  depositAmount: string | null;

  @ApiProperty({ example: 'available' })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  images: any;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── Room DTO (nested in ApartmentDetailDto) ────────────────────────

class RoomDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'R01' })
  roomNumber: string;

  @ApiProperty({ example: 'bedroom' })
  roomType: string;

  @ApiPropertyOptional({ example: '20.00', nullable: true })
  area: string | null;

  @ApiProperty()
  hasWindow: boolean;

  @ApiProperty()
  hasAirConditioning: boolean;

  @ApiProperty()
  hasPrivateBathroom: boolean;

  @ApiProperty({ example: 1 })
  maxOccupancy: number;

  @ApiPropertyOptional({ example: '5000000.00', nullable: true })
  rentPrice: string | null;

  @ApiProperty({ example: 'available' })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  images: any;
}

// ─── Apartment Detail DTO (findOne) ─────────────────────────────────

export class ApartmentDetailDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  buildingName: string | null;

  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;

  @ApiPropertyOptional({ nullable: true })
  apartmentType: string | null;

  @ApiPropertyOptional({ nullable: true })
  floorNumber: number | null;

  @ApiProperty({ example: '123 Nguyen Hue, Q1' })
  address: string;

  @ApiProperty({ example: 'Ho Chi Minh' })
  city: string;

  @ApiProperty({ example: 'Quan 1' })
  district: string;

  @ApiPropertyOptional({ nullable: true })
  ward: string | null;

  @ApiPropertyOptional({ example: '10.77888899', nullable: true })
  latitude: string | null;

  @ApiPropertyOptional({ example: '106.69944400', nullable: true })
  longitude: string | null;

  @ApiProperty({ example: '75.50' })
  totalArea: string;

  @ApiPropertyOptional({ example: '70.00', nullable: true })
  usableArea: string | null;

  @ApiProperty({ example: 2 })
  numberOfBedrooms: number;

  @ApiProperty({ example: 1 })
  numberOfBathrooms: number;

  @ApiProperty({ example: 'fully_furnished' })
  furnishingStatus: string;

  @ApiPropertyOptional({ nullable: true })
  amenities: any;

  @ApiProperty({ example: '15000000.00' })
  baseRentPrice: string;

  @ApiPropertyOptional({ nullable: true })
  depositAmount: string | null;

  @ApiProperty({ example: 'available' })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  images: any;

  @ApiPropertyOptional({ nullable: true })
  videoTourUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  yearBuilt: number | null;

  @ApiPropertyOptional({ nullable: true })
  partnerId: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedByOperatorId: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [RoomDto] })
  rooms: RoomDto[];
}

// ─── Search Result DTO ──────────────────────────────────────────────

export class ApartmentSearchResultDto {
  @ApiProperty({ type: [ApartmentListItemDto] })
  data: ApartmentListItemDto[];

  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}
