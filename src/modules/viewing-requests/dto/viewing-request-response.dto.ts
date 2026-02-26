import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Viewing Request Response DTO ───────────────────────────────────

export class ViewingRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  guestName: string;

  @ApiProperty({ example: '0901234567' })
  guestPhone: string;

  @ApiPropertyOptional({ example: 'guest@example.com', nullable: true })
  guestEmail: string | null;

  @ApiProperty()
  apartmentId: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  assignedStaffId: string | null;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiPropertyOptional({ type: Date, nullable: true })
  preferredDate: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  preferredTimeSlot: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── Appointment Response DTO ───────────────────────────────────────

export class AppointmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  guestId: string | null;

  @ApiProperty()
  apartmentId: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  contactRequestId: string | null;

  @ApiProperty()
  assignedStaffId: string;

  @ApiProperty()
  appointmentDate: Date;

  @ApiProperty()
  appointmentTime: Date;

  @ApiProperty({ example: 30 })
  durationMinutes: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  meetingLocation: string | null;

  @ApiProperty({ example: 'physical_viewing' })
  type: string;

  @ApiProperty({ example: 'scheduled' })
  status: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  guestNotes: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  staffNotes: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  outcome: string | null;

  @ApiProperty()
  followupRequired: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
