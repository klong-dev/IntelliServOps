import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Nested DTOs ────────────────────────────────────────────────────

class MaintenanceApartmentDto {
  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;

  @ApiProperty({ example: '123 Nguyen Hue, Q1' })
  address: string;
}

class MaintenanceRoomDto {
  @ApiProperty({ example: 'R01' })
  roomNumber: string;

  @ApiProperty({ example: 'bedroom' })
  roomType: string;
}

class MaintenanceUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiProperty({ example: '0901234567' })
  phone: string;
}

// ─── Maintenance List Item DTO (findAll) ────────────────────────────

export class MaintenanceListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Broken AC in bedroom' })
  title: string;

  @ApiProperty({ example: 'hvac' })
  category: string;

  @ApiProperty({ example: 'medium' })
  urgency: string;

  @ApiProperty({ example: 'submitted' })
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ nullable: true })
  preferredDate: Date | null;

  @ApiProperty({ type: MaintenanceApartmentDto })
  apartment: MaintenanceApartmentDto;
}

// ─── Maintenance Detail DTO (findOne) ───────────────────────────────

export class MaintenanceDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  rentalContractId: string;

  @ApiProperty()
  apartmentId: string;

  @ApiPropertyOptional({ nullable: true })
  roomId: string | null;

  @ApiProperty({ example: 'hvac' })
  category: string;

  @ApiProperty({ example: 'Broken AC in bedroom' })
  title: string;

  @ApiProperty({ example: 'The AC unit is making loud noise and not cooling' })
  description: string;

  @ApiProperty({ example: 'medium' })
  urgency: string;

  @ApiPropertyOptional({ nullable: true })
  images: any;

  @ApiPropertyOptional({ nullable: true })
  preferredDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  preferredTimeSlot: string | null;

  @ApiProperty()
  isTenantPresentRequired: boolean;

  @ApiProperty({ example: 'submitted' })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  assignedTaskId: string | null;

  @ApiPropertyOptional({ nullable: true })
  completionImages: any;

  @ApiPropertyOptional({ nullable: true })
  completionNotes: string | null;

  @ApiPropertyOptional({ nullable: true })
  tenantRating: number | null;

  @ApiPropertyOptional({ nullable: true })
  tenantFeedback: string | null;

  @ApiPropertyOptional({ example: '500000.00', nullable: true })
  costEstimate: string | null;

  @ApiPropertyOptional({ example: '450000.00', nullable: true })
  actualCost: string | null;

  @ApiPropertyOptional({ nullable: true })
  costCoveredBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: MaintenanceApartmentDto })
  apartment: MaintenanceApartmentDto;

  @ApiPropertyOptional({ type: MaintenanceRoomDto, nullable: true })
  room: MaintenanceRoomDto | null;

  @ApiProperty({ type: MaintenanceUserDto })
  user: MaintenanceUserDto;
}

// ─── Maintenance Created DTO ────────────────────────────────────────

export class MaintenanceCreatedDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Broken AC in bedroom' })
  title: string;

  @ApiProperty({ example: 'submitted' })
  status: string;

  @ApiProperty({ example: 'medium' })
  urgency: string;
}

// ─── Maintenance Updated DTO ────────────────────────────────────────

export class MaintenanceUpdatedDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Broken AC in bedroom' })
  title: string;

  @ApiProperty({ example: 'in_progress' })
  status: string;
}
