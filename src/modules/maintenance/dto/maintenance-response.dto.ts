import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Nested DTOs ────────────────────────────────────────────────────

class MaintenanceApartmentDto {
  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;

  @ApiPropertyOptional({ type: Number, example: 26728, nullable: true })
  wardCode: number | null;

  @ApiPropertyOptional({ type: String, example: 'Xa Chau Pha', nullable: true })
  wardName: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Tinh Ba Ria - Vung Tau',
    nullable: true,
  })
  provinceName: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'Xa Chau Pha, Thi xa Phu My, Tinh Ba Ria - Vung Tau',
    nullable: true,
  })
  fullAddress: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '123 Nguyen Hue',
    nullable: true,
  })
  streetAddress: string | null;

  @ApiPropertyOptional({
    type: String,
    example: '123 Nguyen Hue',
    nullable: true,
  })
  address: string | null;
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

  @ApiPropertyOptional({ type: Date, nullable: true })
  preferredDate: Date | null;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: [
      'https://cdn.example.com/maintenance/issue-1.jpg',
      'https://cdn.example.com/maintenance/issue-2.jpg',
    ],
  })
  images: string[];

  @ApiProperty({ example: false })
  isRated: boolean;

  @ApiProperty({ type: MaintenanceApartmentDto })
  apartment: MaintenanceApartmentDto;
}

export class MaintenanceHistoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Broken AC in bedroom' })
  title: string;

  @ApiProperty({ example: 'hvac' })
  category: string;

  @ApiProperty({ example: 'high' })
  urgency: string;

  @ApiProperty({ example: 'completed' })
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  completedAt: Date | null;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['https://cdn.example.com/maintenance/issue-1.jpg'],
  })
  images: string[];

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['https://cdn.example.com/maintenance/completed-1.jpg'],
  })
  completionImages: string[];

  @ApiProperty({ example: true })
  isRated: boolean;

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

  @ApiProperty({ example: 'hvac' })
  category: string;

  @ApiProperty({ example: 'Broken AC in bedroom' })
  title: string;

  @ApiProperty({ example: 'The AC unit is making loud noise and not cooling' })
  description: string;

  @ApiProperty({ example: 'medium' })
  urgency: string;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['https://cdn.example.com/maintenance/issue-1.jpg'],
  })
  images: string[];

  @ApiPropertyOptional({ type: Date, nullable: true })
  preferredDate: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  preferredTimeSlot: string | null;

  @ApiProperty()
  isTenantPresentRequired: boolean;

  @ApiProperty({ example: 'submitted' })
  status: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  assignedTaskId: string | null;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['https://cdn.example.com/maintenance/completed-1.jpg'],
  })
  completionImages: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  completionNotes: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  tenantRating: number | null;

  @ApiProperty({ example: false })
  isRated: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  tenantFeedback: string | null;

  @ApiPropertyOptional({ example: '500000.00', nullable: true })
  costEstimate: string | null;

  @ApiPropertyOptional({ example: '450000.00', nullable: true })
  actualCost: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  costCoveredBy: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  completedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: MaintenanceApartmentDto })
  apartment: MaintenanceApartmentDto;

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
