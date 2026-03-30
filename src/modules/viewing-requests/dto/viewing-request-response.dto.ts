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

class UserMyViewingApartmentDto {
  @ApiProperty({ example: '11111111-2222-3333-4444-555555555555' })
  id: string;

  @ApiProperty({ example: 'A-1208' })
  apartmentNumber: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Intelli Tower A',
  })
  buildingName: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 26728 })
  wardCode: number | null;
}

export class UserMyViewingRequestDto {
  @ApiProperty({ example: 'b6a52ecf-6f88-4ed4-9aa4-7b8db6bc65d4' })
  appointmentId: string;

  @ApiProperty({ example: '2026-03-24T09:30:00.000Z' })
  appointmentAt: Date;

  @ApiProperty({ example: 30 })
  durationMinutes: number;

  @ApiProperty({ example: 'scheduled' })
  status: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'Toi muon xem can ho vao buoi sang.',
  })
  note: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  cancelledAt: Date | null;

  @ApiProperty({ type: UserMyViewingApartmentDto })
  apartment: UserMyViewingApartmentDto;

  @ApiProperty({ type: UserViewingAssignedStaffDto })
  assignedStaff: UserViewingAssignedStaffDto;

  @ApiProperty()
  createdAt: Date;
}
