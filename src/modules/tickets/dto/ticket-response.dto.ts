import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketAction, TicketStatus, TicketType } from '@prisma/client';

export class TicketRelatedInvoiceDto {
  @ApiProperty({ example: 'test-rent-overdue-invoice' })
  id: string;

  @ApiProperty({ example: 'INV-TEST-OVERDUE-001' })
  invoiceNumber: string;

  @ApiProperty({ example: 'overdue' })
  status: string;

  @ApiProperty()
  issueDate: Date;

  @ApiProperty()
  dueDate: Date;
}

export class TicketRelatedContractDto {
  @ApiProperty({ example: 'test-rent-overdue-contract' })
  id: string;

  @ApiProperty({ example: 'RC-TEST-OVERDUE-001' })
  contractNumber: string;
}

export class TicketRelatedApartmentDto {
  @ApiProperty({ example: 'test-rent-overdue-apt' })
  id: string;

  @ApiProperty({ example: 'TEST-OVERDUE-101' })
  apartmentNumber: string;
}

export class TicketStaffSummaryDto {
  @ApiProperty({ example: 'test-rent-overdue-staff' })
  id: string;

  @ApiProperty({ example: 'Staff Rent Overdue' })
  fullName: string;
}

export class TicketResponseDto {
  @ApiProperty({ example: 'cb939a09-8764-4c45-8fae-e38c2c595bce' })
  id: string;

  @ApiProperty({ example: 'TO-1778259125923-034' })
  ticketNumber: string;

  @ApiProperty({ enum: TicketType, example: TicketType.rent_overdue })
  type: TicketType | null;

  @ApiProperty({ enum: TicketStatus, example: TicketStatus.open })
  status: TicketStatus;

  @ApiPropertyOptional({ enum: TicketAction, nullable: true })
  resolutionAction: TicketAction | null;

  @ApiPropertyOptional({ nullable: true, example: 'Khách còn ?, gia h?n 3 ngày d? thanh toán.' })
  resolutionNote: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  resolutionImages: string[] | null;

  @ApiPropertyOptional({ type: TicketRelatedInvoiceDto, nullable: true })
  invoice?: TicketRelatedInvoiceDto | null;

  @ApiProperty({ type: TicketRelatedContractDto })
  rentalContract: TicketRelatedContractDto;

  @ApiPropertyOptional({ type: TicketRelatedApartmentDto, nullable: true })
  apartment?: TicketRelatedApartmentDto | null;

  @ApiPropertyOptional({ type: TicketStaffSummaryDto, nullable: true })
  resolvedByStaff?: TicketStaffSummaryDto | null;

  @ApiPropertyOptional({ nullable: true })
  resolvedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  closedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
