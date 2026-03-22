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

export class UserViewingAssignedStaffDto {
  @ApiProperty({ example: 'e9df7f8e-6cd8-45f9-8e9a-4c0c1e1d9f3f' })
  id: string;

  @ApiProperty({ example: 'Tran Van B' })
  fullName: string;

  @ApiProperty({ example: '0908889999' })
  phone: string;
}

export class UserViewingBookingResponseDto {
  @ApiProperty({ example: 'd7a8e15e-e4b7-4df5-83d4-f7d7e4d4a31a' })
  contactRequestId: string;

  @ApiProperty({ example: 'b6a52ecf-6f88-4ed4-9aa4-7b8db6bc65d4' })
  appointmentId: string;

  @ApiProperty({ example: '11111111-2222-3333-4444-555555555555' })
  apartmentId: string;

  @ApiProperty({ example: 'A-1208' })
  apartmentNumber: string;

  @ApiProperty({ example: '2026-03-24T09:30:00.000Z' })
  appointmentAt: Date;

  @ApiProperty({ example: 30 })
  durationMinutes: number;

  @ApiProperty({ example: 'scheduled' })
  status: string;

  @ApiProperty({
    example:
      'Toi muon xem can ho vao buoi sang, vui long lien he truoc 30 phut.',
  })
  note: string;

  @ApiProperty({ type: UserViewingAssignedStaffDto })
  assignedStaff: UserViewingAssignedStaffDto;
}
