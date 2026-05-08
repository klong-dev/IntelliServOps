import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus, TicketType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class TicketListQueryDto {
  @ApiPropertyOptional({ enum: TicketStatus, example: TicketStatus.open })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: TicketType, example: TicketType.rent_overdue })
  @IsOptional()
  @IsEnum(TicketType)
  type?: TicketType;
}
