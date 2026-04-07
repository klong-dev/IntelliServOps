import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto';
import { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';
import axios from 'axios';

type WardLookupResponse = {
  name?: string;
  province_name?: string;
};

type WardAddressInfo = {
  wardName: string | null;
  provinceName: string | null;
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

  async create(createDto: CreateInvoiceDto, _currentUser: JwtPayload) {
    // Verify contract exists
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id: createDto.rentalContractId },
      select: { monthlyRent: true },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Calculate totals
    const totalAmount = createDto.items.reduce((sum, item) => {
      return sum + item.amount * (item.quantity || 1);
    }, 0);

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    const invoiceType = createDto.invoiceType ?? InvoiceType.rent;
    const normalizedItems: Prisma.InputJsonArray = createDto.items.map(
      (item) => ({
        description: item.description,
        amount: item.amount,
        quantity: item.quantity || 1,
        itemType: item.itemType || invoiceType,
      }),
    );
    const invoiceContent: Prisma.InputJsonObject = {
      title: `Invoice ${invoiceNumber}`,
      description: `Type: ${invoiceType}`,
      items: normalizedItems,
    };

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        rentalContract: { connect: { id: createDto.rentalContractId } },
        dueDate: new Date(createDto.dueDate),
        issueDate: new Date(),
        billingPeriodStart: new Date(createDto.billingPeriodStart),
        billingPeriodEnd: new Date(createDto.billingPeriodEnd),
        invoiceType,
        invoiceContent,
        baseRent: contract.monthlyRent,
        totalAmount,
        additionalCharges: normalizedItems,
        notes: createDto.notes,
        status: InvoiceStatus.draft,
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceType: true,
        totalAmount: true,
        status: true,
        dueDate: true,
      },
    });
  }

  async update(id: string, updateDto: UpdateInvoiceDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: updateDto,
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        updatedAt: true,
      },
    });
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

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await this.prisma.invoice.count({
      where: { invoiceNumber: { startsWith: `INV-${year}${month}` } },
    });
    return `INV-${year}${month}-${String(count + 1).padStart(5, '0')}`;
  }
}
