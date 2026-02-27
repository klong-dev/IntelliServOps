import { IsString, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStaffNoteDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'ID of the user this note is about',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    example:
      'Customer inquired about apartment upgrade options. Seems interested in 2BR units.',
    description: 'Content of the staff note',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}
