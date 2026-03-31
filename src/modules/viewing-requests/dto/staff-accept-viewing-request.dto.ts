import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class StaffAcceptViewingRequestDto {
  @ApiProperty({
    description: 'Appointment ID assigned to current staff',
    example: 'b6a52ecf-6f88-4ed4-9aa4-7b8db6bc65d4',
  })
  @IsUUID()
  appointmentId: string;
}
