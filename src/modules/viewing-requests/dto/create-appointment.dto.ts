import {
  IsUUID,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({ example: '2026-02-10', description: 'Appointment date' })
  @IsDateString()
  appointmentDate: string;

  @ApiProperty({ example: '14:00', description: 'Appointment time (HH:mm)' })
  @IsString()
  appointmentTime: string;

  @ApiPropertyOptional({ example: 30, default: 30 })
  @IsInt()
  @IsOptional()
  @Min(15)
  @Max(120)
  durationMinutes?: number;

  @ApiPropertyOptional({ description: 'Meeting location' })
  @IsString()
  @IsOptional()
  meetingLocation?: string;

  @ApiPropertyOptional({ description: 'Staff notes' })
  @IsString()
  @IsOptional()
  staffNotes?: string;
}
