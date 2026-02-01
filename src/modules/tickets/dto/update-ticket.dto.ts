import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus, Priority } from '@prisma/client';

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: Priority })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiPropertyOptional({ description: 'Staff ID to assign' })
  @IsUUID()
  @IsOptional()
  assignedToStaffId?: string;

  @ApiPropertyOptional({ description: 'Resolution notes' })
  @IsString()
  @IsOptional()
  resolutionNotes?: string;
}

export class AddTicketCommentDto {
  @ApiPropertyOptional({ description: 'Comment content' })
  @IsString()
  content: string;
}
