import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Nested DTOs ────────────────────────────────────────────────────

class UserSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  email: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  phone: string | null;
}

class RoomSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'R01' })
  roomNumber: string;

  @ApiProperty({ example: 'bedroom' })
  roomType: string;

  @ApiPropertyOptional({ type: String, example: '20.00', nullable: true })
  area: string | null;

  @ApiProperty({ example: 'available' })
  status: string;
}

class ContractSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'RC-2026-0001' })
  contractNumber: string;

  @ApiProperty({ example: 'active' })
  status: string;
}

// ─── UserRoom List Item DTO ─────────────────────────────────────────

export class UserRoomListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  roomId: string;

  @ApiProperty()
  rentalContractId: string;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveInDate: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveOutDate: Date | null;

  @ApiProperty()
  isPrimary: boolean;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty()
  createdAt: Date;
}

// ─── UserRoom Detail DTO ────────────────────────────────────────────

export class UserRoomDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  roomId: string;

  @ApiProperty()
  rentalContractId: string;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveInDate: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  moveOutDate: Date | null;

  @ApiProperty()
  isPrimary: boolean;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty({ type: UserSummaryDto })
  user: UserSummaryDto;

  @ApiProperty({ type: RoomSummaryDto })
  room: RoomSummaryDto;

  @ApiProperty({ type: ContractSummaryDto })
  rentalContract: ContractSummaryDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── UserRoom Mutation Result DTO ───────────────────────────────────

export class UserRoomMutationResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  roomId: string;

  @ApiProperty()
  rentalContractId: string;

  @ApiProperty()
  isPrimary: boolean;

  @ApiProperty({ example: 'active' })
  status: string;

  @ApiProperty()
  createdAt: Date;
}
