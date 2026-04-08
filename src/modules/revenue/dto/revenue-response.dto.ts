import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RevenueApartmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  apartmentNumber: string;

  @ApiPropertyOptional({ nullable: true })
  buildingName: string | null;
}

export class RevenueContractDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  contractNumber: string;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;

  @ApiProperty()
  status: string;
}

export class RevenuePartnerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiPropertyOptional({ nullable: true })
  companyName: string | null;
}

export class RevenueCooperationContractDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  contractNumber: string;

  @ApiProperty({ example: 10 })
  commissionRate: number;

  @ApiProperty()
  startDate: Date;

  @ApiProperty()
  endDate: Date;
}

export class RevenueTransactionDto {
  @ApiProperty()
  invoiceId: string;

  @ApiProperty()
  invoiceNumber: string;

  @ApiProperty()
  invoiceType: string;

  @ApiProperty()
  invoicePaidAt: Date;

  @ApiProperty({ example: 12000000 })
  invoiceAmount: number;

  @ApiProperty({ example: true })
  isPartnerApartment: boolean;

  @ApiProperty({ example: 10, nullable: true })
  commissionRateApplied: number | null;

  @ApiProperty({ example: 1200000 })
  systemRevenueAmount: number;

  @ApiProperty({ example: 12000000 })
  partnerGrossRevenueAmount: number;

  @ApiProperty({ example: 10800000 })
  partnerNetPayoutAmount: number;

  @ApiProperty({ type: RevenueApartmentDto })
  apartment: RevenueApartmentDto;

  @ApiProperty({ type: RevenueContractDto })
  contract: RevenueContractDto;

  @ApiPropertyOptional({ type: RevenuePartnerDto, nullable: true })
  partner: RevenuePartnerDto | null;

  @ApiPropertyOptional({ type: RevenueCooperationContractDto, nullable: true })
  cooperationContract: RevenueCooperationContractDto | null;
}

export class RevenueOverviewDto {
  @ApiProperty({ example: 25 })
  invoiceCount: number;

  @ApiProperty({ example: 350000000 })
  totalInvoiceAmount: number;

  @ApiProperty({ example: 275000000 })
  totalSystemRevenue: number;

  @ApiProperty({ example: 100000000 })
  totalPartnerGrossRevenue: number;

  @ApiProperty({ example: 85000000 })
  totalPartnerNetPayout: number;
}

export class PartnerRevenueSummaryItemDto {
  @ApiProperty({ type: RevenuePartnerDto })
  partner: RevenuePartnerDto;

  @ApiProperty({ example: 10 })
  invoiceCount: number;

  @ApiProperty({ example: 2 })
  apartmentCount: number;

  @ApiProperty({ example: 3 })
  contractCount: number;

  @ApiProperty({ example: 120000000 })
  totalGrossRevenue: number;

  @ApiProperty({ example: 12000000 })
  totalSystemCommissionRevenue: number;

  @ApiProperty({ example: 108000000 })
  totalNetPayoutRevenue: number;
}

export class RevenueTransactionListDto {
  @ApiProperty({ type: [RevenueTransactionDto] })
  items: RevenueTransactionDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

export class PartnerMyRevenueOverviewDto {
  @ApiProperty({ example: 12 })
  invoiceCount: number;

  @ApiProperty({ example: 180000000 })
  totalGrossRevenue: number;

  @ApiProperty({ example: 18000000 })
  totalSystemCommissionAmount: number;

  @ApiProperty({ example: 162000000 })
  totalNetPayoutRevenue: number;
}
