import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateUserViewingRequestDto {
  @ApiProperty({
    description: 'ID can ho ma user muon dat lich xem',
    example: '11111111-2222-3333-4444-555555555555',
  })
  @IsUUID()
  apartmentId: string;

  @ApiProperty({
    description: 'Thoi gian hen xem can ho (ISO 8601)',
    example: '2026-03-24T09:30:00.000Z',
  })
  @IsDateString()
  appointmentAt: string;

  @ApiProperty({
    description: 'Ghi chu cua user cho lich hen',
    example:
      'Toi muon xem can ho vao buoi sang, vui long lien he truoc 30 phut.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note: string;
}
