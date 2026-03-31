import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class UserApartmentApartmentDto {
  @ApiProperty({ example: 'd6e0a098-c1e9-4b5d-9207-e507e9a5974d' })
  id: string;

  @ApiProperty({ example: 'A-1208' })
  apartmentNumber: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Intelli Tower A',
  })
  buildingName: string | null;

  @ApiProperty({ example: 2 })
  maxConcurrentViewings: number;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 12 })
  floorNumber: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 26728 })
  wardCode: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 79 })
  provinceCode: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '12 Nguyen Hue, Phuong Ben Nghe',
  })
  streetAddress: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '10.78800000' })
  latitude: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '106.71950000',
  })
  longitude: string | null;

  @ApiProperty({ type: String, example: '75.00' })
  totalArea: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '68.50' })
  usableArea: string | null;

  @ApiProperty({ example: 2 })
  numberOfBedrooms: number;

  @ApiProperty({ example: 2 })
  numberOfBathrooms: number;

  @ApiProperty({ example: 'semi_furnished' })
  furnishingStatus: string;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['smart_lock', 'balcony', 'gym_access'],
  })
  amenities: string[] | null;

  @ApiProperty({ type: String, example: '18500000.00' })
  baseRentPrice: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '37000000.00' })
  depositAmount: string | null;

  @ApiProperty({ example: 'available' })
  status: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Can goc 2 phong ngu, ban cong huong dong nam.',
  })
  description: string | null;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: [
      'https://cdn.example.com/apartments/a-1208-1.jpg',
      'https://cdn.example.com/apartments/a-1208-2.jpg',
    ],
  })
  images: string[] | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'https://youtu.be/demo-tour-a1208',
  })
  videoTourUrl: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 2020 })
  yearBuilt: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'e33f798c-7978-4a86-b243-b3ac43e020ba',
  })
  ownerId: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '3b6f2e31-417f-4f8f-b251-7d5c03b78468',
  })
  approvedByOperatorId: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  approvedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

class UserApartmentContractDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'CTR-2026-00001' })
  contractNumber: string;
}

export class UserApartmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  apartmentId: string;

  @ApiProperty()
  rentalContractId: string;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty()
  isPrimaryTenant: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveInDate: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveOutDate: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  apartmentDoorPassword: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  buildingGateCode: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  smartLockPin: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  mailboxCode: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  parkingAccessCode: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  wifiName: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  wifiPassword: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  emergencyContactName: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  emergencyContactPhone: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty({ type: UserApartmentApartmentDto })
  apartment: UserApartmentApartmentDto;

  @ApiProperty({ type: UserApartmentContractDto })
  rentalContract: UserApartmentContractDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
