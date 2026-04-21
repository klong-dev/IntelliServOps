import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class InvoiceOverdueListQueryDto {
  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Minimum overdue days for filtering results',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minOverdueDays?: number;
}

export class OverdueInvoiceSummaryDto {
  @ApiProperty()
  invoiceId: string;

  @ApiProperty({ example: 'INV-202604-00021' })
  invoiceNumber: string;

  @ApiProperty({ example: 'rent' })
  invoiceType: string;

  @ApiProperty()
  dueDate: Date;

  @ApiProperty({ example: 12 })
  overdueDays: number;
}

export class OverdueTenantSummaryDto {
  @ApiProperty()
  userId: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiProperty({ example: 'a@example.com' })
  email: string;

  @ApiProperty({ example: '+84901234567' })
  phone: string;

  @ApiProperty({ example: 2 })
  overdueInvoiceCount: number;

  @ApiProperty({ example: 18 })
  maxOverdueDays: number;
}

export class OverdueApartmentTenantItemDto {
  @ApiProperty()
  apartmentId: string;

  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;

  @ApiProperty({ example: 3 })
  overdueInvoiceCount: number;

  @ApiProperty({ example: 18 })
  maxOverdueDays: number;

  @ApiProperty({ type: [OverdueInvoiceSummaryDto] })
  invoices: OverdueInvoiceSummaryDto[];

  @ApiProperty({ type: [OverdueTenantSummaryDto] })
  tenants: OverdueTenantSummaryDto[];
}

export class OverdueApartmentTenantListDto {
  @ApiProperty({ type: [OverdueApartmentTenantItemDto] })
  items: OverdueApartmentTenantItemDto[];

  @ApiProperty({ example: 5 })
  total: number;

  @ApiProperty({ example: 1 })
  minOverdueDays: number;

  @ApiProperty()
  generatedAt: Date;
}
