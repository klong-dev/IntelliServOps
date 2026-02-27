import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStaffNoteDto {
  @ApiPropertyOptional({
    example: 'Updated note content about the customer.',
    description: 'Updated content of the staff note',
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(5000)
  content?: string;
}
