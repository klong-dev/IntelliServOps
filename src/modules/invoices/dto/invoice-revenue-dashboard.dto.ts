import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export const INVOICE_REVENUE_TIMESERIES_GRANULARITIES = [
  'month',
  'year',
] as const;

export class InvoiceRevenueDashboardQueryDto {
  @ApiPropertyOptional({
    example: '2026-04-01T00:00:00.000Z',
    description: 'Start date filter based on invoice paidAt',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-04-30T23:59:59.999Z',
    description: 'End date filter based on invoice paidAt',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    example: 5,
    default: 5,
    description: 'Number of apartments returned for top and bottom rankings',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topLimit?: number;
}

export class InvoiceRevenueTimeseriesQueryDto {
  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00.000Z',
    description: 'Start date filter based on invoice paidAt',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.999Z',
    description: 'End date filter based on invoice paidAt',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    enum: INVOICE_REVENUE_TIMESERIES_GRANULARITIES,
    default: 'month',
    description: 'Grouping granularity for system revenue timeseries',
  })
  @IsOptional()
  @IsIn(INVOICE_REVENUE_TIMESERIES_GRANULARITIES)
  granularity?: (typeof INVOICE_REVENUE_TIMESERIES_GRANULARITIES)[number];
}

export class InvoiceRevenueUserStatsDto {
  @ApiProperty({ example: 120 })
  totalActiveUsers: number;

  @ApiProperty({ example: 18 })
  totalActivePartners: number;

  @ApiProperty({ example: 102 })
  totalActiveNonPartnerUsers: number;

  @ApiProperty({ example: 0.15 })
  partnerRatio: number;

  @ApiProperty({ example: 0.85 })
  userRatio: number;
}

export class InvoiceRevenueOccupancyStatsDto {
  @ApiProperty({ example: 35 })
  occupiedApartmentCount: number;

  @ApiProperty({ example: 14 })
  vacantApartmentCount: number;
}

export class InvoiceRevenueApartmentRankingItemDto {
  @ApiProperty()
  apartmentId: string;

  @ApiProperty({ example: 'A101' })
  apartmentNumber: string;

  @ApiPropertyOptional({ example: 'Vinhomes Central Park', nullable: true })
  buildingName: string | null;

  @ApiProperty({ example: 72000000 })
  paidRevenue: number;

  @ApiProperty({ example: 4 })
  invoiceCount: number;
}

export class InvoiceRevenueApartmentRankingSummaryDto {
  @ApiProperty({ type: [InvoiceRevenueApartmentRankingItemDto] })
  topApartments: InvoiceRevenueApartmentRankingItemDto[];

  @ApiProperty({ type: [InvoiceRevenueApartmentRankingItemDto] })
  bottomApartments: InvoiceRevenueApartmentRankingItemDto[];
}

export class InvoiceRevenueSystemSummaryDto {
  @ApiProperty({ example: 350000000 })
  totalPaidRevenue: number;

  @ApiProperty({ example: 275000000 })
  totalSystemRevenue: number;

  @ApiProperty({ example: 100000000 })
  totalPartnerGrossRevenue: number;

  @ApiProperty({ example: 85000000 })
  totalPartnerNetPayout: number;

  @ApiProperty({ example: 25 })
  invoiceCount: number;
}

export class InvoiceRevenueDashboardDto {
  @ApiProperty({ type: InvoiceRevenueUserStatsDto })
  userStats: InvoiceRevenueUserStatsDto;

  @ApiProperty({ type: InvoiceRevenueOccupancyStatsDto })
  occupancyStats: InvoiceRevenueOccupancyStatsDto;

  @ApiProperty({ type: InvoiceRevenueApartmentRankingSummaryDto })
  apartmentRevenueStats: InvoiceRevenueApartmentRankingSummaryDto;

  @ApiProperty({ type: InvoiceRevenueSystemSummaryDto })
  systemRevenueSummary: InvoiceRevenueSystemSummaryDto;
}

export class InvoiceRevenueTimeseriesItemDto {
  @ApiProperty({ example: '2026-04' })
  periodKey: string;

  @ApiProperty({ example: '04/2026' })
  periodLabel: string;

  @ApiProperty({ example: 95000000 })
  totalPaidRevenue: number;

  @ApiProperty({ example: 72000000 })
  totalSystemRevenue: number;

  @ApiProperty({ example: 23000000 })
  totalPartnerGrossRevenue: number;

  @ApiProperty({ example: 20700000 })
  totalPartnerNetPayout: number;

  @ApiProperty({ example: 7 })
  invoiceCount: number;
}

export class InvoiceRevenueTimeseriesDto {
  @ApiProperty({
    enum: INVOICE_REVENUE_TIMESERIES_GRANULARITIES,
    example: 'month',
  })
  granularity: (typeof INVOICE_REVENUE_TIMESERIES_GRANULARITIES)[number];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-01-01T00:00:00.000Z',
  })
  from: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-12-31T23:59:59.999Z',
  })
  to: string | null;

  @ApiProperty({ type: [InvoiceRevenueTimeseriesItemDto] })
  items: InvoiceRevenueTimeseriesItemDto[];
}
