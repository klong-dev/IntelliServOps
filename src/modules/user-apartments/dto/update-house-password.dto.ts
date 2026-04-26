import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class UpdateHousePasswordDto {
  @ApiProperty({
    example: '258036',
    description:
      'New legacy cached local house password (4-12 digits). This does not update smart-lock first-pass PIN state.',
  })
  @IsString()
  @Matches(/^\d{4,12}$/, {
    message: 'housePassword must be 4-12 digits',
  })
  housePassword: string;
}
