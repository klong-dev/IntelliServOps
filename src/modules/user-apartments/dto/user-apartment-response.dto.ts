import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class UserApartmentApartmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'A-1208' })
  apartmentNumber: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Intelli Tower A',
  })
  buildingName: string | null;
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
