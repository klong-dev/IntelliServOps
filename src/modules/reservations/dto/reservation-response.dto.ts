import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Apartment Summary (nested) ─────────────────────────────────────

class ReservationApartmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;

  @ApiProperty({ example: '123 Nguyen Hue, Q1' })
  address: string;

  @ApiProperty({ example: '15000000.00' })
  baseRentPrice: string;
}

// ─── Reservation Response DTO ───────────────────────────────────────

export class ReservationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  apartmentId: string;

  @ApiProperty()
  desiredStartDate: Date;

  @ApiProperty()
  desiredEndDate: Date;

  @ApiPropertyOptional({ type: Number, nullable: true })
  numberOfOccupants: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  specialRequests: string | null;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiPropertyOptional({ type: Date, nullable: true })
  expiresAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: ReservationApartmentDto })
  apartment: ReservationApartmentDto;
}

// ─── Reservation Created DTO ────────────────────────────────────────

export class ReservationCreatedDto extends ReservationResponseDto {}
