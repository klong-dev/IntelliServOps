import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
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

  @ApiPropertyOptional({
    description: 'Thoi luong slot xem (phut), mac dinh 30',
    example: 45,
    minimum: 15,
    maximum: 240,
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  durationMinutes?: number;

  @ApiPropertyOptional({
    description: 'Ghi chu cua user cho lich hen (khong bat buoc)',
    example:
      'Toi muon xem can ho vao buoi sang, vui long lien he truoc 30 phut.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
