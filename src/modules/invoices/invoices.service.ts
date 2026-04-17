import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';
import type { CreateInvoiceDto, UpdateInvoiceDto } from './dto';
import axios from 'axios';

type WardLookupResponse = {
  name?: string;
  province_name?: string;
};

type WardAddressInfo = {
  wardName: string | null;
  provinceName: string | null;
};

type UtilityBreakdown = {
  previousReading: string | null;
  currentReading: string | null;
  consumption: string | null;
  unit: string | null;
  ratePerUnit: string | null;
  amount: string | null;
};

@Injectable()
export class InvoicesService {
  private readonly provincesBaseUrl = 'https://provinces.open-api.vn';
  private readonly wardAddressCache = new Map<number, WardAddressInfo | null>();

  constructor(private readonly prisma: PrismaService) {}

  private normalizeWardName(value: string | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async resolveWardAddressFromWardCode(
    wardCode: number,
  ): Promise<WardAddressInfo | null> {
    if (this.wardAddressCache.has(wardCode)) {
      return this.wardAddressCache.get(wardCode) ?? null;
    }

    try {
      const response = await axios.get<WardLookupResponse>(
        `${this.provincesBaseUrl}/api/v2/w/${wardCode}`,
        { timeout: 15000 },
      );

      const address: WardAddressInfo = {
        wardName: this.normalizeWardName(response.data.name),
        provinceName: this.normalizeWardName(response.data.province_name),
      };

      this.wardAddressCache.set(wardCode, address);
      return address;
    } catch {
      this.wardAddressCache.set(wardCode, null);
      return null;
    }
  }

  private async enrichContractsWithWardAddress<
    T extends {
      rentalContract?: {
        apartment?: {
          wardCode?: number | null;
        } | null;
      };
      contract?: {
        apartment?: {
          wardCode?: number | null;
        } | null;
      };
    },
  >(items: T[]): Promise<T[]> {
    const wardCodes = items
      .map((item) => item.rentalContract?.apartment?.wardCode)
      .concat(items.map((item) => item.contract?.apartment?.wardCode));

    const uniqueWardCodes = Array.from(
      new Set(
        wardCodes.filter((code): code is number => typeof code === 'number'),
      ),
    );

    const resolvedEntries = await Promise.all(
      uniqueWardCodes.map(async (wardCode) => {
        return [
          wardCode,
          await this.resolveWardAddressFromWardCode(wardCode),
        ] as const;
      }),
    );

    const wardAddressMap = new Map<number, WardAddressInfo | null>(
      resolvedEntries,
    );

    const enrichApartment = <
      A extends { wardCode?: number | null } | null | undefined,
    >(
      apartment: A,
    ) => {
      if (!apartment) {
        return apartment;
      }

      const wardAddress =
        typeof apartment.wardCode === 'number'
          ? (wardAddressMap.get(apartment.wardCode) ?? null)
          : null;

      return {
        ...apartment,
        wardName: wardAddress?.wardName ?? null,
        provinceName: wardAddress?.provinceName ?? null,
      };
    };

    return items.map((item) => ({
      ...item,
      rentalContract: item.rentalContract
        ? {
            ...item.rentalContract,
            apartment: enrichApartment(item.rentalContract.apartment),
          }
        : item.rentalContract,
      contract: item.contract
        ? {
            ...item.contract,
            apartment: enrichApartment(item.contract.apartment),
          }
        : item.contract,
    }));
  }

  @Cron(CronExpression.EVERY_HOUR)
  async autoMarkOverdueInvoices(): Promise<void> {
    await this.markOverdue();
  }

  private readonly invoiceContractSelect = {
    id: true,
    contractNumber: true,
    startDate: true,
    endDate: true,
    monthlyRent: true,
    depositAmount: true,
    paymentDueDay: true,
    paymentMethod: true,
    status: true,
    signedDate: true,
    contractDocumentUrl: true,
    contractTerms: true,
    specialConditions: true,
    terminationDate: true,
    terminationReason: true,
    earlyTerminationFee: true,
    createdAt: true,
    updatedAt: true,
    apartment: {
      select: {
        id: true,
        apartmentNumber: true,
        wardCode: true,
      },
    },
    members: {
      select: {
        memberType: true,
        isPrimaryContact: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    },
    createdByStaff: {
      select: {
        id: true,
        fullName: true,
      },
    },
  } as const;

  async findAll(
    currentUser: JwtPayload,
    query?: { status?: InvoiceStatus; page?: number; limit?: number },
  ) {
    await this.markOverdue();

    const { status, page = 1, limit = 20 } = query ?? {};
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.InvoiceWhereInput = {};

    if (status) {
      where.status = status;
    }

    // Users see only their contract invoices
    if (currentUser.actorType === 'user') {
      where.rentalContract = {
        members: { some: { userId: currentUser.sub } },
      };
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          invoiceType: true,
          totalAmount: true,
          status: true,
          dueDate: true,
          billingPeriodStart: true,
          billingPeriodEnd: true,
          createdAt: true,
          rentalContract: {
            select: this.invoiceContractSelect,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const mappedItems = invoices.map((invoice) => ({
      ...invoice,
      contract: invoice.rentalContract,
    }));

    const items = await this.enrichContractsWithWardAddress(mappedItems);

    return {
      items,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findOne(id: string, currentUser: JwtPayload) {
    await this.markOverdue();

    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        rentalContract: {
          select: this.invoiceContractSelect,
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            status: true,
            paymentDate: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Restrict users to their own invoices
    if (currentUser.actorType === 'user') {
      const isMember = invoice.rentalContract.members.some(
        (m) => m.user.id === currentUser.sub,
      );
      if (!isMember) {
        throw new NotFoundException('Invoice not found');
      }
    }

    return {
      ...invoice,
      contract: invoice.rentalContract,
    };
  }

  async create(dto: CreateInvoiceDto, _currentUser: JwtPayload) {
    const rentalContract = await this.prisma.rentalContract.findUnique({
      where: { id: dto.rentalContractId },
      select: {
        id: true,
        monthlyRent: true,
      },
    });

    if (!rentalContract) {
      throw new NotFoundException('Rental contract not found');
    }

    const invoiceNumber = await this.generateInvoiceNumber();
    const items = dto.items ?? [];
    const itemsTotal = items.reduce(
      (sum, item) => sum + Number(item.amount ?? 0) * Number(item.quantity ?? 1),
      0,
    );
    const baseRent = new Prisma.Decimal(rentalContract.monthlyRent.toString());
    const totalAmount = new Prisma.Decimal(itemsTotal.toFixed(2));

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        rentalContractId: dto.rentalContractId,
        invoiceType: dto.invoiceType ?? InvoiceType.rent,
        invoiceContent: {
          items,
        } as unknown as Prisma.InputJsonValue,
        billingPeriodStart: new Date(dto.billingPeriodStart),
        billingPeriodEnd: new Date(dto.billingPeriodEnd),
        issueDate: new Date(),
        dueDate: new Date(dto.dueDate),
        baseRent,
        additionalCharges: items as unknown as Prisma.InputJsonValue,
        totalAmount,
        status: InvoiceStatus.draft,
        notes: dto.notes ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    const existing = await this.prisma.invoice.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async findMonthlyUtilityUsage(
    currentUser: JwtPayload,
    query?: { page?: number; limit?: number },
  ) {
    await this.markOverdue();

    const { page = 1, limit = 12 } = query ?? {};
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.InvoiceWhereInput = {
      invoiceType: InvoiceType.utility,
    };

    if (currentUser.actorType === 'user') {
      where.rentalContract = {
        members: { some: { userId: currentUser.sub } },
      };
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          billingPeriodStart: true,
          billingPeriodEnd: true,
          issueDate: true,
          dueDate: true,
          paidAt: true,
          totalAmount: true,
          utilityCharges: true,
          rentalContract: {
            select: {
              id: true,
              contractNumber: true,
              apartment: {
                select: {
                  id: true,
                  apartmentNumber: true,
                },
              },
            },
          },
        },
        orderBy: [{ billingPeriodStart: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: safeLimit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const items = invoices.map((invoice) => {
      const utilityCharges = this.toJsonObject(invoice.utilityCharges);
      const electricity = this.readUtilityBreakdown(
        utilityCharges,
        ['electricity', 'electric', 'electricMeter'],
        'kWh',
      );
      const water = this.readUtilityBreakdown(
        utilityCharges,
        ['water', 'waterMeter'],
        'm3',
      );

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        billingPeriodStart: invoice.billingPeriodStart,
        billingPeriodEnd: invoice.billingPeriodEnd,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        apartment: {
          id: invoice.rentalContract.apartment.id,
          apartmentNumber: invoice.rentalContract.apartment.apartmentNumber,
        },
        contract: {
          id: invoice.rentalContract.id,
          contractNumber: invoice.rentalContract.contractNumber,
        },
        electricity,
        water,
        totalUtilityAmount: this.resolveUtilityTotalAmount(
          utilityCharges,
          electricity,
          water,
          invoice.totalAmount,
        ),
      };
    });

    return {
      items,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async markOverdue() {
    const now = new Date();
    return this.prisma.invoice.updateMany({
      where: {
        status: {
          in: [
            InvoiceStatus.draft,
            InvoiceStatus.issued,
            InvoiceStatus.sent,
            InvoiceStatus.partially_paid,
          ],
        },
        dueDate: { lt: now },
      },
      data: { status: InvoiceStatus.overdue },
    });
  }

  private toJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private readUtilityBreakdown(
    utilityCharges: Record<string, unknown>,
    keys: string[],
    defaultUnit: string,
  ): UtilityBreakdown | null {
    const source = keys
      .map((key) => utilityCharges[key])
      .find((value) => value && typeof value === 'object' && !Array.isArray(value));

    if (!source) {
      return null;
    }

    const breakdown = source as Record<string, unknown>;

    return {
      previousReading: this.readDecimalString(
        breakdown.previousReading ?? breakdown.oldReading,
      ),
      currentReading: this.readDecimalString(
        breakdown.currentReading ?? breakdown.newReading,
      ),
      consumption: this.readDecimalString(
        breakdown.consumption ?? breakdown.used,
      ),
      unit:
        this.readStringValue(breakdown.unit ?? breakdown.unitOfMeasurement) ??
        defaultUnit,
      ratePerUnit: this.readDecimalString(
        breakdown.ratePerUnit ?? breakdown.rate,
      ),
      amount: this.readDecimalString(breakdown.amount),
    };
  }

  private resolveUtilityTotalAmount(
    utilityCharges: Record<string, unknown>,
    electricity: UtilityBreakdown | null,
    water: UtilityBreakdown | null,
    fallbackInvoiceTotal: Prisma.Decimal,
  ): string {
    const explicit = this.readDecimalString(
      utilityCharges.totalUtilityAmount ?? utilityCharges.total,
    );

    if (explicit) {
      return explicit;
    }

    const electricityAmount = this.toNumber(electricity?.amount ?? null);
    const waterAmount = this.toNumber(water?.amount ?? null);
    if (electricityAmount !== null || waterAmount !== null) {
      return ((electricityAmount ?? 0) + (waterAmount ?? 0)).toFixed(2);
    }

    return fallbackInvoiceTotal.toString();
  }

  private readDecimalString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value.toFixed(2) : null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof value === 'object' && value !== null) {
      const asDecimal = (value as { toString?: () => string }).toString?.();
      if (typeof asDecimal === 'string' && asDecimal.trim().length > 0) {
        return asDecimal;
      }
    }

    return null;
  }

  private readStringValue(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toNumber(value: string | null): number | null {
    if (!value) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await this.prisma.invoice.count({
      where: { invoiceNumber: { startsWith: `INV-${year}${month}` } },
    });
    return `INV-${year}${month}-${String(count + 1).padStart(5, '0')}`;
  }
}
