import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  InvoiceStatus,
  InvoiceType,
  PartnerCooperationContractStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PartnerMyRevenueOverviewDto,
  PartnerRevenueSummaryItemDto,
  RevenueFilterQueryDto,
  RevenueOverviewDto,
  RevenueTransactionListDto,
} from './dto';
import {
  PartnerPayoutQueryDto,
  PartnerPayoutSummaryItemDto,
  PartnerPayoutSummaryListDto,
} from './dto/partner-payout.dto';
import type { JwtPayload } from '../auth/auth.service';

type RevenueRow = {
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: string;
  invoicePaidAt: Date;
  invoiceAmount: number;
  isPartnerApartment: boolean;
  commissionRateApplied: number | null;
  systemRevenueAmount: number;
  partnerGrossRevenueAmount: number;
  partnerNetPayoutAmount: number;
  apartment: {
    id: string;
    apartmentNumber: string;
    buildingName: string | null;
  };
  contract: {
    id: string;
    contractNumber: string;
    startDate: Date;
    endDate: Date;
    status: string;
  };
  partner: {
    id: string;
    fullName: string;
    companyName: string | null;
  } | null;
  cooperationContract: {
    id: string;
    contractNumber: string;
    commissionRate: number;
    startDate: Date;
    endDate: Date;
  } | null;
};

@Injectable()
export class RevenueService {
  constructor(private readonly prisma: PrismaService) {}

  private toNumber(value: unknown): number {
    if (
      typeof value === 'object' &&
      value !== null &&
      'toNumber' in value &&
      typeof (value as { toNumber: () => number }).toNumber === 'function'
    ) {
      return (value as { toNumber: () => number }).toNumber();
    }

    return Number(value);
  }

  private normalizeFilter(filter: RevenueFilterQueryDto) {
    const from = filter.from ? new Date(filter.from) : undefined;
    const to = filter.to ? new Date(filter.to) : undefined;

    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException('Invalid from date');
    }

    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid to date');
    }

    if (from && to && from > to) {
      throw new BadRequestException('from must be earlier than or equal to to');
    }

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    return {
      from,
      to,
      page,
      limit,
      partnerId: filter.partnerId,
    };
  }

  private normalizePayoutMonth(month?: string) {
    if (month) {
      const [yearText, monthText] = month.split('-');
      const year = Number(yearText);
      const monthNum = Number(monthText);

      if (
        !Number.isInteger(year) ||
        !Number.isInteger(monthNum) ||
        monthNum < 1 ||
        monthNum > 12
      ) {
        throw new BadRequestException('Invalid month format. Expected YYYY-MM');
      }

      const periodStart = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0));
      const periodEnd = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

      return {
        periodMonth: `${year}-${String(monthNum).padStart(2, '0')}`,
        periodStart,
        periodEnd,
      };
    }

    const now = new Date();
    const year = now.getUTCFullYear();
    const monthNum = now.getUTCMonth() + 1;
    const periodStart = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

    return {
      periodMonth: `${year}-${String(monthNum).padStart(2, '0')}`,
      periodStart,
      periodEnd,
    };
  }

  private mapTransferSummary(
    base: {
      partner: { id: string; fullName: string; companyName: string | null };
      periodMonth: string;
      periodStart: Date;
      periodEnd: Date;
      invoiceCount: number;
      apartmentCount: number;
      totalGrossAmount: number;
      totalSystemCommissionAmount: number;
      totalNetPayoutAmount: number;
    },
    transfer?: {
      transferProofImageUrl: string;
      transferNote: string | null;
      confirmedAt: Date;
      confirmedByStaffId: string;
      confirmedByStaff: { fullName: string };
    } | null,
  ): PartnerPayoutSummaryItemDto {
    return {
      ...base,
      isTransferred: !!transfer,
      transferProofImageUrl: transfer?.transferProofImageUrl ?? null,
      transferNote: transfer?.transferNote ?? null,
      confirmedAt: transfer?.confirmedAt ?? null,
      confirmedByStaffId: transfer?.confirmedByStaffId ?? null,
      confirmedByStaffName: transfer?.confirmedByStaff?.fullName ?? null,
    };
  }

  private pickCooperationContract(
    paidAt: Date,
    contracts: Array<{
      id: string;
      contractNumber: string;
      startDate: Date;
      endDate: Date;
      commissionRate: unknown;
      status: PartnerCooperationContractStatus;
      createdAt: Date;
    }>,
  ) {
    const usableContracts = contracts.filter(
      (contract) =>
        contract.status !== PartnerCooperationContractStatus.cancelled &&
        contract.status !== PartnerCooperationContractStatus.terminated &&
        contract.status !== PartnerCooperationContractStatus.expired,
    );

    const matching = usableContracts
      .filter(
        (contract) =>
          paidAt >= contract.startDate && paidAt <= contract.endDate,
      )
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

    if (matching.length > 0) {
      return matching[0];
    }

    const fallback = usableContracts.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    return fallback[0] ?? null;
  }

  private async buildRevenueRows(
    filter: RevenueFilterQueryDto,
  ): Promise<RevenueRow[]> {
    const normalized = this.normalizeFilter(filter);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.paid,
        invoiceType: {
          notIn: [InvoiceType.deposit, InvoiceType.contractDeposit],
        },
        paidAt: {
          ...(normalized.from && { gte: normalized.from }),
          ...(normalized.to && { lte: normalized.to }),
        },
        ...(normalized.partnerId && {
          rentalContract: {
            apartment: {
              ownerId: normalized.partnerId,
            },
          },
        }),
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceType: true,
        totalAmount: true,
        paidAt: true,
        rentalContract: {
          select: {
            id: true,
            contractNumber: true,
            startDate: true,
            endDate: true,
            status: true,
            apartment: {
              select: {
                id: true,
                apartmentNumber: true,
                buildingName: true,
                owner: {
                  select: {
                    id: true,
                    fullName: true,
                    companyName: true,
                    isPartner: true,
                    commissionRate: true,
                  },
                },
                cooperationContracts: {
                  select: {
                    id: true,
                    contractNumber: true,
                    startDate: true,
                    endDate: true,
                    commissionRate: true,
                    status: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        paidAt: 'desc',
      },
    });

    return invoices
      .filter((invoice) => !!invoice.paidAt)
      .map((invoice) => {
        const apartment = invoice.rentalContract.apartment;
        const owner = apartment.owner;
        const invoicePaidAt = invoice.paidAt as Date;
        const invoiceAmount = this.toNumber(invoice.totalAmount);

        const isPartnerApartment = !!owner?.isPartner;
        const selectedCooperationContract = this.pickCooperationContract(
          invoicePaidAt,
          apartment.cooperationContracts,
        );

        const commissionRate = isPartnerApartment
          ? selectedCooperationContract?.commissionRate != null
            ? this.toNumber(selectedCooperationContract.commissionRate)
            : owner?.commissionRate != null
              ? this.toNumber(owner.commissionRate)
              : 0
          : null;

        const systemRevenueAmount = isPartnerApartment
          ? invoiceAmount * ((commissionRate ?? 0) / 100)
          : invoiceAmount;

        const partnerGrossRevenueAmount = isPartnerApartment
          ? invoiceAmount
          : 0;
        const partnerNetPayoutAmount =
          isPartnerApartment && commissionRate != null
            ? invoiceAmount - systemRevenueAmount
            : 0;

        return {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceType: invoice.invoiceType,
          invoicePaidAt,
          invoiceAmount,
          isPartnerApartment,
          commissionRateApplied: commissionRate,
          systemRevenueAmount,
          partnerGrossRevenueAmount,
          partnerNetPayoutAmount,
          apartment: {
            id: apartment.id,
            apartmentNumber: apartment.apartmentNumber,
            buildingName: apartment.buildingName,
          },
          contract: {
            id: invoice.rentalContract.id,
            contractNumber: invoice.rentalContract.contractNumber,
            startDate: invoice.rentalContract.startDate,
            endDate: invoice.rentalContract.endDate,
            status: invoice.rentalContract.status,
          },
          partner: owner?.isPartner
            ? {
                id: owner.id,
                fullName: owner.fullName,
                companyName: owner.companyName,
              }
            : null,
          cooperationContract: selectedCooperationContract
            ? {
                id: selectedCooperationContract.id,
                contractNumber: selectedCooperationContract.contractNumber,
                commissionRate: this.toNumber(
                  selectedCooperationContract.commissionRate,
                ),
                startDate: selectedCooperationContract.startDate,
                endDate: selectedCooperationContract.endDate,
              }
            : null,
        };
      });
  }

  async getSystemRevenueOverview(
    filter: RevenueFilterQueryDto,
  ): Promise<RevenueOverviewDto> {
    const rows = await this.buildRevenueRows(filter);

    const overview = rows.reduce(
      (acc, row) => {
        acc.invoiceCount += 1;
        acc.totalInvoiceAmount += row.invoiceAmount;
        acc.totalSystemRevenue += row.systemRevenueAmount;
        acc.totalPartnerGrossRevenue += row.partnerGrossRevenueAmount;
        acc.totalPartnerNetPayout += row.partnerNetPayoutAmount;
        return acc;
      },
      {
        invoiceCount: 0,
        totalInvoiceAmount: 0,
        totalSystemRevenue: 0,
        totalPartnerGrossRevenue: 0,
        totalPartnerNetPayout: 0,
      },
    );

    return overview;
  }

  async getPartnerRevenueSummaries(
    filter: RevenueFilterQueryDto,
  ): Promise<PartnerRevenueSummaryItemDto[]> {
    const rows = await this.buildRevenueRows(filter);
    const partnerRows = rows.filter((row) => row.partner);

    const grouped = new Map<
      string,
      PartnerRevenueSummaryItemDto & {
        apartmentSet: Set<string>;
        contractSet: Set<string>;
      }
    >();

    for (const row of partnerRows) {
      const partner = row.partner as {
        id: string;
        fullName: string;
        companyName: string | null;
      };

      if (!grouped.has(partner.id)) {
        grouped.set(partner.id, {
          partner,
          invoiceCount: 0,
          apartmentCount: 0,
          contractCount: 0,
          totalGrossRevenue: 0,
          totalSystemCommissionRevenue: 0,
          totalNetPayoutRevenue: 0,
          apartmentSet: new Set<string>(),
          contractSet: new Set<string>(),
        });
      }

      const summary = grouped.get(
        partner.id,
      ) as PartnerRevenueSummaryItemDto & {
        apartmentSet: Set<string>;
        contractSet: Set<string>;
      };

      summary.invoiceCount += 1;
      summary.totalGrossRevenue += row.partnerGrossRevenueAmount;
      summary.totalSystemCommissionRevenue += row.systemRevenueAmount;
      summary.totalNetPayoutRevenue += row.partnerNetPayoutAmount;
      summary.apartmentSet.add(row.apartment.id);
      summary.contractSet.add(row.contract.id);
    }

    return Array.from(grouped.values())
      .map(({ apartmentSet, contractSet, ...item }) => ({
        ...item,
        apartmentCount: apartmentSet.size,
        contractCount: contractSet.size,
      }))
      .sort((a, b) => b.totalGrossRevenue - a.totalGrossRevenue);
  }

  async getRevenueTransactions(
    filter: RevenueFilterQueryDto,
  ): Promise<RevenueTransactionListDto> {
    const normalized = this.normalizeFilter(filter);
    const rows = await this.buildRevenueRows(filter);

    const total = rows.length;
    const start = (normalized.page - 1) * normalized.limit;
    const end = start + normalized.limit;

    return {
      items: rows.slice(start, end),
      total,
      page: normalized.page,
      limit: normalized.limit,
      totalPages: Math.max(1, Math.ceil(total / normalized.limit)),
    };
  }

  private async assertPartnerUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isPartner: true,
      },
    });

    if (!user?.isPartner) {
      throw new ForbiddenException(
        'Only partner accounts can access partner revenue endpoints',
      );
    }
  }

  async getMyPartnerRevenueOverview(
    currentUser: JwtPayload,
    filter: RevenueFilterQueryDto,
  ): Promise<PartnerMyRevenueOverviewDto> {
    await this.assertPartnerUser(currentUser.sub);

    const rows = await this.buildRevenueRows({
      ...filter,
      partnerId: currentUser.sub,
    });

    const partnerRows = rows.filter((row) => row.isPartnerApartment);

    return partnerRows.reduce(
      (acc, row) => {
        acc.invoiceCount += 1;
        acc.totalGrossRevenue += row.partnerGrossRevenueAmount;
        acc.totalSystemCommissionAmount += row.systemRevenueAmount;
        acc.totalNetPayoutRevenue += row.partnerNetPayoutAmount;
        return acc;
      },
      {
        invoiceCount: 0,
        totalGrossRevenue: 0,
        totalSystemCommissionAmount: 0,
        totalNetPayoutRevenue: 0,
      },
    );
  }

  async getMyPartnerRevenueTransactions(
    currentUser: JwtPayload,
    filter: RevenueFilterQueryDto,
  ): Promise<RevenueTransactionListDto> {
    await this.assertPartnerUser(currentUser.sub);

    const normalized = this.normalizeFilter(filter);
    const rows = await this.buildRevenueRows({
      ...filter,
      partnerId: currentUser.sub,
    });
    const partnerRows = rows.filter((row) => row.isPartnerApartment);

    const total = partnerRows.length;
    const start = (normalized.page - 1) * normalized.limit;
    const end = start + normalized.limit;

    return {
      items: partnerRows.slice(start, end),
      total,
      page: normalized.page,
      limit: normalized.limit,
      totalPages: Math.max(1, Math.ceil(total / normalized.limit)),
    };
  }

  async getStaffPartnerPayoutSummaries(
    query: PartnerPayoutQueryDto,
  ): Promise<PartnerPayoutSummaryListDto> {
    const { periodMonth, periodStart, periodEnd } = this.normalizePayoutMonth(
      query.month,
    );
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const rows = await this.buildRevenueRows({
      from: periodStart.toISOString(),
      to: periodEnd.toISOString(),
      partnerId: query.partnerId,
      page: 1,
      limit: 10000,
    });
    const partnerRows = rows.filter(
      (row) => row.partner && row.isPartnerApartment,
    );

    const grouped = new Map<
      string,
      {
        partner: { id: string; fullName: string; companyName: string | null };
        periodMonth: string;
        periodStart: Date;
        periodEnd: Date;
        invoiceCount: number;
        apartmentSet: Set<string>;
        totalGrossAmount: number;
        totalSystemCommissionAmount: number;
        totalNetPayoutAmount: number;
      }
    >();

    for (const row of partnerRows) {
      const partner = row.partner as {
        id: string;
        fullName: string;
        companyName: string | null;
      };

      if (!grouped.has(partner.id)) {
        grouped.set(partner.id, {
          partner,
          periodMonth,
          periodStart,
          periodEnd,
          invoiceCount: 0,
          apartmentSet: new Set<string>(),
          totalGrossAmount: 0,
          totalSystemCommissionAmount: 0,
          totalNetPayoutAmount: 0,
        });
      }

      const summary = grouped.get(partner.id) as {
        partner: { id: string; fullName: string; companyName: string | null };
        periodMonth: string;
        periodStart: Date;
        periodEnd: Date;
        invoiceCount: number;
        apartmentSet: Set<string>;
        totalGrossAmount: number;
        totalSystemCommissionAmount: number;
        totalNetPayoutAmount: number;
      };

      summary.invoiceCount += 1;
      summary.apartmentSet.add(row.apartment.id);
      summary.totalGrossAmount += row.partnerGrossRevenueAmount;
      summary.totalSystemCommissionAmount += row.systemRevenueAmount;
      summary.totalNetPayoutAmount += row.partnerNetPayoutAmount;
    }

    const partnerIds = Array.from(grouped.keys());
    const transfers = partnerIds.length
      ? await this.prisma.partnerPayoutTransfer.findMany({
          where: {
            partnerId: { in: partnerIds },
            periodMonth,
          },
          select: {
            partnerId: true,
            transferProofImageUrl: true,
            transferNote: true,
            confirmedAt: true,
            confirmedByStaffId: true,
            confirmedByStaff: {
              select: {
                fullName: true,
              },
            },
          },
        })
      : [];

    const transferByPartnerId = new Map(
      transfers.map((transfer) => [transfer.partnerId, transfer]),
    );

    const items = Array.from(grouped.values())
      .map((summary) =>
        this.mapTransferSummary(
          {
            partner: summary.partner,
            periodMonth: summary.periodMonth,
            periodStart: summary.periodStart,
            periodEnd: summary.periodEnd,
            invoiceCount: summary.invoiceCount,
            apartmentCount: summary.apartmentSet.size,
            totalGrossAmount: summary.totalGrossAmount,
            totalSystemCommissionAmount: summary.totalSystemCommissionAmount,
            totalNetPayoutAmount: summary.totalNetPayoutAmount,
          },
          transferByPartnerId.get(summary.partner.id),
        ),
      )
      .sort((a, b) => b.totalNetPayoutAmount - a.totalNetPayoutAmount);

    const total = items.length;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      items: items.slice(start, end),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async confirmPartnerMonthlyPayout(params: {
    currentUser: JwtPayload;
    partnerId: string;
    month: string;
    transferProofImageUrl: string;
    note?: string;
  }): Promise<PartnerPayoutSummaryItemDto> {
    const { periodMonth, periodStart, periodEnd } = this.normalizePayoutMonth(
      params.month,
    );

    const partner = await this.prisma.user.findUnique({
      where: { id: params.partnerId },
      select: {
        id: true,
        fullName: true,
        companyName: true,
        isPartner: true,
      },
    });

    if (!partner || !partner.isPartner) {
      throw new BadRequestException('Partner not found');
    }

    const summary = await this.getStaffPartnerPayoutSummaries({
      month: periodMonth,
      partnerId: params.partnerId,
      page: 1,
      limit: 1,
    });

    const payoutItem = summary.items[0];
    if (!payoutItem) {
      throw new BadRequestException(
        'No eligible paid rent invoices found for this partner in the selected month',
      );
    }

    const transfer = await this.prisma.partnerPayoutTransfer.upsert({
      where: {
        partnerId_periodMonth: {
          partnerId: params.partnerId,
          periodMonth,
        },
      },
      update: {
        periodStart,
        periodEnd,
        totalGrossAmount: payoutItem.totalGrossAmount,
        totalSystemCommissionAmount: payoutItem.totalSystemCommissionAmount,
        totalNetPayoutAmount: payoutItem.totalNetPayoutAmount,
        transferProofImageUrl: params.transferProofImageUrl,
        transferNote: params.note?.trim() || null,
        confirmedByStaffId: params.currentUser.sub,
        confirmedAt: new Date(),
      },
      create: {
        partnerId: params.partnerId,
        periodMonth,
        periodStart,
        periodEnd,
        totalGrossAmount: payoutItem.totalGrossAmount,
        totalSystemCommissionAmount: payoutItem.totalSystemCommissionAmount,
        totalNetPayoutAmount: payoutItem.totalNetPayoutAmount,
        transferProofImageUrl: params.transferProofImageUrl,
        transferNote: params.note?.trim() || null,
        confirmedByStaffId: params.currentUser.sub,
        confirmedAt: new Date(),
      },
      select: {
        transferProofImageUrl: true,
        transferNote: true,
        confirmedAt: true,
        confirmedByStaffId: true,
        confirmedByStaff: {
          select: {
            fullName: true,
          },
        },
      },
    });

    return this.mapTransferSummary(
      {
        partner: {
          id: partner.id,
          fullName: partner.fullName,
          companyName: partner.companyName,
        },
        periodMonth,
        periodStart,
        periodEnd,
        invoiceCount: payoutItem.invoiceCount,
        apartmentCount: payoutItem.apartmentCount,
        totalGrossAmount: payoutItem.totalGrossAmount,
        totalSystemCommissionAmount: payoutItem.totalSystemCommissionAmount,
        totalNetPayoutAmount: payoutItem.totalNetPayoutAmount,
      },
      transfer,
    );
  }
}
