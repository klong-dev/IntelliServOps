import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SearchUserByNationalIdDto {
  @ApiProperty({
    description: 'CCCD/CMND number to search user identity',
    example: '079203001234',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  nationalId: string;
}
