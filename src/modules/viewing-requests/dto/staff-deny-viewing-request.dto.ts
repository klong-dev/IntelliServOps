import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class StaffDenyViewingRequestDto {
  @ApiProperty({
    description: 'Appointment ID assigned to current staff',
    example: 'b6a52ecf-6f88-4ed4-9aa4-7b8db6bc65d4',
  })
  @IsUUID()
  appointmentId: string;

  @ApiPropertyOptional({
    description: 'Reason when staff denies the viewing request',
    example: 'Staff has emergency maintenance at that time.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
