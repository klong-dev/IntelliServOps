import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Ticket List Item DTO (findAll) ─────────────────────────────────

export class TicketListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'TKT-00001' })
  ticketNumber: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  rentalContractId: string;

  @ApiProperty({ example: 'billing' })
  category: string;

  @ApiProperty({ example: 'Overcharged electricity bill' })
  subject: string;

  @ApiProperty({ example: 'medium' })
  priority: string;

  @ApiProperty({ example: 'open' })
  status: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  assignedToStaffId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── Ticket Detail DTO (findOne) ────────────────────────────────────

export class TicketDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'TKT-00001' })
  ticketNumber: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  rentalContractId: string;

  @ApiProperty({ example: 'billing' })
  category: string;

  @ApiProperty({ example: 'Overcharged electricity bill' })
  subject: string;

  @ApiProperty({ example: 'I noticed the electricity charge is higher than expected...' })
  description: string;

  @ApiProperty({ example: 'medium' })
  priority: string;

  @ApiProperty({ example: 'open' })
  status: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  assignedToStaffId: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  attachments: any;

  @ApiPropertyOptional({ type: String, nullable: true })
  resolutionNotes: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  satisfactionRating: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  satisfactionFeedback: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  firstResponseAt: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  resolvedAt: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  closedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
