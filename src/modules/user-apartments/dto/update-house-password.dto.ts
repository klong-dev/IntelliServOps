import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class UpdateHousePasswordDto {
  @ApiProperty({
    example: '258036',
    description: 'New apartment door password (4-12 digits)',
  })
  @IsString()
  @Matches(/^\d{4,12}$/, {
    message: 'housePassword must be 4-12 digits',
  })
  housePassword: string;
}
