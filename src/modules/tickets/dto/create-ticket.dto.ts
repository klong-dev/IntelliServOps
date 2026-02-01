import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketCategory, Priority } from '@prisma/client';

export class CreateTicketDto {
  @ApiProperty({ example: 'Question about lease renewal' })
  @IsString()
  @MaxLength(255)
  subject: string;

  @ApiProperty({ example: 'I would like to know if I can renew my lease...' })
  @IsString()
  @MaxLength(4000)
  description: string;

  @ApiProperty({ enum: TicketCategory })
  @IsEnum(TicketCategory)
  category: TicketCategory;

  @ApiPropertyOptional({ enum: Priority, default: 'medium' })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiPropertyOptional({ description: 'Related contract ID' })
  @IsUUID()
  @IsOptional()
  rentalContractId?: string;
}
