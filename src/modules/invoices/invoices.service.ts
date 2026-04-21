import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ActorType,
  InvoiceStatus,
  InvoiceType,
  PartnerCooperationContractStatus,
  PaymentMethodType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';
import axios from 'axios';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  InvoiceMeActorScope,
  InvoiceMeItemDto,
  InvoiceMeItemType,
  InvoiceMeListDto,
  InvoiceMeQueryDto,
} from './dto';
import type { CreateInvoiceDto, UpdateInvoiceDto } from './dto';

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

type OverdueRentUtilityInvoiceCandidate = {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  dueDate: Date;
  rentalContract: {
    apartment: {
      apartmentNumber: string;
    };
    members: Array<{
      userId: string;
      user: {
        fullName: string;
      };
    }>;
  };
};

@Injectable()
export class InvoicesService {
  private readonly provincesBaseUrl = 'https://provinces.open-api.vn';
  private readonly wardAddressCache = new Map<number, WardAddressInfo | null>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async notifyOverdueRentUtilityInvoices(
    invoices: OverdueRentUtilityInvoiceCandidate[],
    now: Date,
  ): Promise<void> {
    if (!invoices.length) {
      return;
    }

    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const sentKeys = new Set<string>();
    const tasks: Promise<unknown>[] = [];

    for (const invoice of invoices) {
      const overdueDays = Math.max(
        1,
        Math.floor(
          (now.getTime() - invoice.dueDate.getTime()) / millisecondsPerDay,
        ),
      );
      const invoiceTypeLabel =
        invoice.invoiceType === InvoiceType.utility ? 'utility' : 'rent';
      const apartmentLabel =
        invoice.rentalContract?.apartment?.apartmentNumber ?? 'unknown';
      const members = invoice.rentalContract?.members ?? [];

      if (!members.length) {
        continue;
      }

      for (const member of members) {
        const sentKey = `${invoice.id}:${member.userId}`;
        if (sentKeys.has(sentKey)) {
          continue;
        }
        sentKeys.add(sentKey);

        const message =
          overdueDays >= 15
            ? `Invoice ${invoice.invoiceNumber} (${invoiceTypeLabel}) for apartment ${apartmentLabel} is overdue ${overdueDays} days. IoT services are temporarily disabled until payment is completed.`
            : `Invoice ${invoice.invoiceNumber} (${invoiceTypeLabel}) for apartment ${apartmentLabel} is overdue ${overdueDays} days. If it reaches 15 overdue days, IoT services will be temporarily disabled.`;

        tasks.push(
          this.notificationsService.createAndPush({
            recipientType: ActorType.user,
            recipientId: member.userId,
            notificationType: 'warning',
            channel: 'in_app',
            priority: 'high',
            title: 'Invoice overdue',
            message,
            actionUrl: `/invoices/${invoice.id}`,
            actionLabel: 'View invoice',
            relatedEntityType: 'Invoice',
            relatedEntityId: invoice.id,
          }),
        );
      }
    }

    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  }

  private normalizeWardName(value: string | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toInvoiceReceiver(
    owner:
      | {
          id: string;
          fullName: string;
          companyName: string | null;
        }
      | null
      | undefined,
  ) {
    return owner
      ? {
          id: owner.id,
          fullName: owner.fullName,
          companyName: owner.companyName,
        }
      : null;
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

  private formatBillingMonth(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private resolveBillingMonthRange(month?: string):
    | {
        start: Date;
        endExclusive: Date;
      }
    | undefined {
    if (!month) {
      return undefined;
    }

    const [yearText, monthText] = month.split('-');
    const year = Number(yearText);
    const monthNum = Number(monthText);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(monthNum) ||
      monthNum < 1 ||
      monthNum > 12
    ) {
      throw new BadRequestException('billingMonth must be in YYYY-MM format');
    }

    return {
      start: new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0)),
      endExclusive: new Date(Date.UTC(year, monthNum, 1, 0, 0, 0, 0)),
    };
  }

  private pickCooperationContract(
    referenceDate: Date,
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
          referenceDate >= contract.startDate &&
          referenceDate <= contract.endDate,
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

  private resolvePaymentSummary(invoice: {
    status: InvoiceStatus;
    payments: Array<{
      id: string;
      paymentReference: string;
      status: PaymentStatus;
      paymentDate: Date;
    }>;
  }) {
    const latestPayment = invoice.payments[0] ?? null;
    const fallbackStatus =
      invoice.status === InvoiceStatus.paid
        ? PaymentStatus.completed
        : PaymentStatus.pending;

    return {
      paymentId: latestPayment?.id ?? null,
      paymentReference: latestPayment?.paymentReference ?? null,
      status: latestPayment?.status ?? fallbackStatus,
      paymentDate: latestPayment?.paymentDate ?? null,
    };
  }

  private normalizeDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date filter');
    }

    return date;
  }

  private applyCommonInvoiceMeFilters(
    items: InvoiceMeItemDto[],
    query: InvoiceMeQueryDto,
  ): InvoiceMeItemDto[] {
    const dueFrom = this.normalizeDate(query.dueFrom);
    const dueTo = this.normalizeDate(query.dueTo);
    const paidFrom = this.normalizeDate(query.paidFrom);
    const paidTo = this.normalizeDate(query.paidTo);
    const searchText = query.search?.trim().toLowerCase() ?? null;

    return items.filter((item) => {
      if (query.invoiceType && item.invoiceType !== query.invoiceType) {
        return false;
      }

      if (query.invoiceStatus && item.invoiceStatus !== query.invoiceStatus) {
        return false;
      }

      if (
        query.paymentStatus &&
        item.paymentSummary.status !== query.paymentStatus
      ) {
        return false;
      }

      if (query.paymentMethod && item.paymentMethod !== query.paymentMethod) {
        return false;
      }

      if (query.billingMonth && item.billingMonth !== query.billingMonth) {
        return false;
      }

      if (query.payerUserId && item.payer?.id !== query.payerUserId) {
        return false;
      }

      if (query.receiverUserId && item.receiver?.id !== query.receiverUserId) {
        return false;
      }

      if (dueFrom) {
        if (!item.dueDate || item.dueDate < dueFrom) {
          return false;
        }
      }

      if (dueTo) {
        if (!item.dueDate || item.dueDate > dueTo) {
          return false;
        }
      }

      if (paidFrom) {
        if (!item.paidAt || item.paidAt < paidFrom) {
          return false;
        }
      }

      if (paidTo) {
        if (!item.paidAt || item.paidAt > paidTo) {
          return false;
        }
      }

      if (!searchText) {
        return true;
      }

      const haystacks = [
        item.invoiceNumber,
        item.contractNumber,
        item.apartmentNumber,
        item.payer?.fullName,
        item.receiver?.fullName,
        item.receiver?.companyName ?? null,
      ]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.toLowerCase());

      return haystacks.some((value) => value.includes(searchText));
    });
  }

  private async resolveMeScope(
    currentUser: JwtPayload,
    query: InvoiceMeQueryDto,
  ): Promise<'staff_worklist' | 'user_payable' | 'partner_receivable'> {
    const requestedScope = query.actorScope ?? InvoiceMeActorScope.auto;
    const isPrivilegedActor =
      currentUser.actorType === ActorType.staff ||
      currentUser.actorType === ActorType.operator ||
      currentUser.actorType === ActorType.admin;

    if (isPrivilegedActor) {
      if (
        requestedScope !== InvoiceMeActorScope.auto &&
        requestedScope !== InvoiceMeActorScope.staff_worklist
      ) {
        throw new ForbiddenException(
          'This actorScope is not allowed for staff actor',
        );
      }
      return 'staff_worklist';
    }

    if (currentUser.actorType !== ActorType.user) {
      return 'user_payable';
    }

    const currentUserRecord = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
      select: {
        isPartner: true,
      },
    });

    const isPartner = !!currentUserRecord?.isPartner;
    if (requestedScope === InvoiceMeActorScope.user_payable) {
      return 'user_payable';
    }

    if (requestedScope === InvoiceMeActorScope.partner_receivable) {
      if (!isPartner) {
        throw new ForbiddenException('Current user is not a partner');
      }
      return 'partner_receivable';
    }

    return isPartner ? 'partner_receivable' : 'user_payable';
  }

  private async getStaffWorkItems(
    currentUser: JwtPayload,
    query: InvoiceMeQueryDto,
  ): Promise<InvoiceMeItemDto[]> {
    const month = query.billingMonth;
    const paymentsServiceCompat = this.paymentsService as PaymentsService & {
      listDueContractDepositPayouts?: (
        currentUser: JwtPayload,
        query: { month?: string },
      ) => Promise<
        Array<{
          payoutPaymentId: string | null;
          contractId: string;
          contractNumber: string;
          apartmentId: string;
          apartmentNumber: string;
          recipientUserId: string;
          recipientFullName: string;
          payoutMonth: string;
          dueDate: Date;
          payoutAmount: string;
          currency: string;
          status: PaymentStatus;
          transferProofUrl: string | null;
          transferReference: string | null;
          transferNote: string | null;
          confirmedAt: Date | null;
          confirmedByStaffId: string | null;
        }>
      >;
    };
    const [partnerPayouts, depositPayouts] = await Promise.all([
      this.paymentsService.listDuePartnerMonthlyPayouts(currentUser, { month }),
      paymentsServiceCompat.listDueContractDepositPayouts
        ? paymentsServiceCompat.listDueContractDepositPayouts(currentUser, {
            month,
          })
        : Promise.resolve([]),
    ]);

    const partnerItems: InvoiceMeItemDto[] = partnerPayouts.map((item) => ({
      itemType: InvoiceMeItemType.partner_monthly_payout,
      itemId:
        item.payoutId ??
        `partner-monthly-${item.partnerId}-${item.payoutMonth}`,
      invoiceId: null,
      invoiceNumber: null,
      invoiceType: InvoiceType.rent,
      invoiceStatus: null,
      billingMonth: item.payoutMonth,
      billingPeriodStart: item.billingPeriodStart,
      billingPeriodEnd: item.billingPeriodEndExclusive,
      dueDate: item.dueDate,
      paidAt: item.confirmedAt,
      totalAmount: item.payoutAmount,
      currency: item.currency,
      paymentMethod: PaymentMethodType.bank_transfer,
      paymentSummary: {
        paymentId: item.payoutId,
        paymentReference: item.transferReference,
        status:
          item.status === 'paid'
            ? PaymentStatus.completed
            : item.status === 'cancelled'
              ? PaymentStatus.cancelled
              : PaymentStatus.pending,
        paymentDate: item.confirmedAt,
      },
      contractId: null,
      contractNumber: null,
      apartmentId: null,
      apartmentNumber: null,
      payer: {
        id: null,
        fullName: 'System',
        companyName: null,
      },
      receiver: {
        id: item.partnerId,
        fullName: item.partnerName,
        companyName: item.partnerCompanyName,
      },
      payoutBreakdown: {
        grossRevenue: Number(item.grossRevenue),
        systemCommissionRate: item.effectiveCommissionRate,
        systemCommissionAmount: Number(item.commissionAmount),
        netPayoutAmount: Number(item.payoutAmount),
      },
      workMeta: {
        payoutMonth: item.payoutMonth,
        transferProofUrl: item.transferProofUrl,
        transferReference: item.transferReference,
        transferNote: item.transferNote,
        confirmedAt: item.confirmedAt,
        confirmedByStaffId: item.confirmedByStaffId,
      },
    }));

    const depositItems: InvoiceMeItemDto[] = depositPayouts.map((item) => ({
      itemType: InvoiceMeItemType.contract_deposit_payout,
      itemId:
        item.payoutPaymentId ??
        `contract-deposit-${item.contractId}-${item.payoutMonth}`,
      invoiceId: null,
      invoiceNumber: null,
      invoiceType: InvoiceType.contractDeposit,
      invoiceStatus: null,
      billingMonth: item.payoutMonth,
      billingPeriodStart: null,
      billingPeriodEnd: null,
      dueDate: item.dueDate,
      paidAt: item.confirmedAt,
      totalAmount: item.payoutAmount,
      currency: item.currency,
      paymentMethod: PaymentMethodType.bank_transfer,
      paymentSummary: {
        paymentId: item.payoutPaymentId,
        paymentReference: item.transferReference,
        status:
          item.status === PaymentStatus.refunded
            ? PaymentStatus.completed
            : item.status,
        paymentDate: item.confirmedAt,
      },
      contractId: item.contractId,
      contractNumber: item.contractNumber,
      apartmentId: item.apartmentId,
      apartmentNumber: item.apartmentNumber,
      payer: {
        id: null,
        fullName: 'System',
        companyName: null,
      },
      receiver: {
        id: item.recipientUserId,
        fullName: item.recipientFullName,
        companyName: null,
      },
      payoutBreakdown: null,
      workMeta: {
        payoutMonth: item.payoutMonth,
        transferProofUrl: item.transferProofUrl,
        transferReference: item.transferReference,
        transferNote: item.transferNote,
        confirmedAt: item.confirmedAt,
        confirmedByStaffId: item.confirmedByStaffId,
      },
    }));

    return [...partnerItems, ...depositItems].sort(
      (a, b) =>
        +(b.dueDate ? new Date(b.dueDate) : 0) -
        +(a.dueDate ? new Date(a.dueDate) : 0),
    );
  }

  private async getUserPayableItems(
    currentUser: JwtPayload,
    query: InvoiceMeQueryDto,
  ): Promise<InvoiceMeItemDto[]> {
    if (query.payerUserId && query.payerUserId !== currentUser.sub) {
      return [];
    }

    const billingMonthRange = this.resolveBillingMonthRange(query.billingMonth);
    const defaultStatuses: InvoiceStatus[] = [
      InvoiceStatus.draft,
      InvoiceStatus.issued,
      InvoiceStatus.sent,
      InvoiceStatus.partially_paid,
      InvoiceStatus.overdue,
    ];

    const where: Prisma.InvoiceWhereInput = {
      rentalContract: {
        members: {
          some: {
            userId: currentUser.sub,
          },
        },
        ...(query.receiverUserId
          ? { apartment: { ownerId: query.receiverUserId } }
          : {}),
      },
      ...(query.invoiceType ? { invoiceType: query.invoiceType } : {}),
      ...(query.invoiceStatus
        ? { status: query.invoiceStatus }
        : { status: { in: defaultStatuses } }),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(billingMonthRange
        ? {
            billingPeriodStart: {
              gte: billingMonthRange.start,
              lt: billingMonthRange.endExclusive,
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                invoiceNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                rentalContract: {
                  contractNumber: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                rentalContract: {
                  apartment: {
                    apartmentNumber: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const invoices = await this.prisma.invoice.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        invoiceNumber: true,
        invoiceType: true,
        status: true,
        billingPeriodStart: true,
        billingPeriodEnd: true,
        dueDate: true,
        paidAt: true,
        totalAmount: true,
        currency: true,
        paymentMethod: true,
        rentalContract: {
          select: {
            id: true,
            contractNumber: true,
            apartment: {
              select: {
                id: true,
                apartmentNumber: true,
                owner: {
                  select: {
                    id: true,
                    fullName: true,
                    companyName: true,
                  },
                },
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
                  },
                },
              },
            },
          },
        },
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            id: true,
            paymentReference: true,
            status: true,
            paymentDate: true,
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    return invoices.map((invoice) => {
      const receiver = this.toInvoiceReceiver(
        invoice.rentalContract.apartment.owner,
      );
      const primaryMember =
        invoice.rentalContract.members.find(
          (member) => member.memberType === 'primary',
        ) ||
        invoice.rentalContract.members.find(
          (member) => member.isPrimaryContact,
        ) ||
        invoice.rentalContract.members[0];
      const paymentSummary = this.resolvePaymentSummary(invoice);
      const paymentPayer = invoice.payments[0]?.user;
      const payer = paymentPayer
        ? {
            id: paymentPayer.id,
            fullName: paymentPayer.fullName,
            companyName: null,
          }
        : primaryMember
          ? {
              id: primaryMember.user.id,
              fullName: primaryMember.user.fullName,
              companyName: null,
            }
          : null;

      return {
        itemType: InvoiceMeItemType.invoice,
        itemId: invoice.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        invoiceStatus: invoice.status,
        billingMonth: this.formatBillingMonth(invoice.billingPeriodStart),
        billingPeriodStart: invoice.billingPeriodStart,
        billingPeriodEnd: invoice.billingPeriodEnd,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        totalAmount: String(invoice.totalAmount),
        currency: invoice.currency,
        paymentMethod: invoice.paymentMethod,
        paymentSummary,
        contractId: invoice.rentalContract.id,
        contractNumber: invoice.rentalContract.contractNumber,
        apartmentId: invoice.rentalContract.apartment.id,
        apartmentNumber: invoice.rentalContract.apartment.apartmentNumber,
        payer,
        receiver,
        payoutBreakdown: null,
        workMeta: {
          payoutMonth: null,
          transferProofUrl: null,
          transferReference: null,
          transferNote: null,
          confirmedAt: null,
          confirmedByStaffId: null,
        },
      } as InvoiceMeItemDto;
    });
  }

  private async getPartnerReceivableItems(
    currentUser: JwtPayload,
    query: InvoiceMeQueryDto,
  ): Promise<InvoiceMeItemDto[]> {
    if (query.receiverUserId && query.receiverUserId !== currentUser.sub) {
      return [];
    }

    const billingMonthRange = this.resolveBillingMonthRange(query.billingMonth);

    const where: Prisma.InvoiceWhereInput = {
      rentalContract: {
        apartment: {
          ownerId: currentUser.sub,
        },
      },
      ...(query.invoiceType
        ? { invoiceType: query.invoiceType }
        : { invoiceType: InvoiceType.rent }),
      ...(query.invoiceStatus
        ? { status: query.invoiceStatus }
        : { status: InvoiceStatus.paid }),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(billingMonthRange
        ? {
            billingPeriodStart: {
              gte: billingMonthRange.start,
              lt: billingMonthRange.endExclusive,
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                invoiceNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                rentalContract: {
                  contractNumber: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                rentalContract: {
                  apartment: {
                    apartmentNumber: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const invoices = await this.prisma.invoice.findMany({
      where,
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        invoiceNumber: true,
        invoiceType: true,
        status: true,
        billingPeriodStart: true,
        billingPeriodEnd: true,
        dueDate: true,
        paidAt: true,
        totalAmount: true,
        currency: true,
        paymentMethod: true,
        rentalContract: {
          select: {
            id: true,
            contractNumber: true,
            apartment: {
              select: {
                id: true,
                apartmentNumber: true,
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
            members: {
              select: {
                memberType: true,
                isPrimaryContact: true,
                user: {
                  select: {
                    id: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        },
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            id: true,
            paymentReference: true,
            status: true,
            paymentDate: true,
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    return invoices.map((invoice) => {
      const owner = invoice.rentalContract.apartment.owner;
      const receiver = this.toInvoiceReceiver(owner);
      const referenceDate = invoice.paidAt ?? invoice.billingPeriodEnd;
      const selectedContract = this.pickCooperationContract(
        referenceDate,
        invoice.rentalContract.apartment.cooperationContracts,
      );

      const commissionRate = owner?.isPartner
        ? selectedContract?.commissionRate != null
          ? this.toNumber(selectedContract.commissionRate)
          : owner.commissionRate != null
            ? this.toNumber(owner.commissionRate)
            : 0
        : 0;
      const gross = this.toNumber(invoice.totalAmount);
      const commissionAmount = owner?.isPartner
        ? gross * (commissionRate / 100)
        : 0;
      const paymentSummary = this.resolvePaymentSummary(invoice);

      const primaryMember =
        invoice.rentalContract.members.find(
          (member) => member.memberType === 'primary',
        ) ||
        invoice.rentalContract.members.find(
          (member) => member.isPrimaryContact,
        ) ||
        invoice.rentalContract.members[0];
      const paymentPayer = invoice.payments[0]?.user;
      const payer = paymentPayer
        ? {
            id: paymentPayer.id,
            fullName: paymentPayer.fullName,
            companyName: null,
          }
        : primaryMember
          ? {
              id: primaryMember.user.id,
              fullName: primaryMember.user.fullName,
              companyName: null,
            }
          : null;

      return {
        itemType: InvoiceMeItemType.invoice,
        itemId: invoice.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        invoiceStatus: invoice.status,
        billingMonth: this.formatBillingMonth(invoice.billingPeriodStart),
        billingPeriodStart: invoice.billingPeriodStart,
        billingPeriodEnd: invoice.billingPeriodEnd,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        totalAmount: String(invoice.totalAmount),
        currency: invoice.currency,
        paymentMethod: invoice.paymentMethod,
        paymentSummary,
        contractId: invoice.rentalContract.id,
        contractNumber: invoice.rentalContract.contractNumber,
        apartmentId: invoice.rentalContract.apartment.id,
        apartmentNumber: invoice.rentalContract.apartment.apartmentNumber,
        payer,
        receiver,
        payoutBreakdown: {
          grossRevenue: gross,
          systemCommissionRate: Number(commissionRate.toFixed(2)),
          systemCommissionAmount: Number(commissionAmount.toFixed(2)),
          netPayoutAmount: Number((gross - commissionAmount).toFixed(2)),
        },
        workMeta: {
          payoutMonth: null,
          transferProofUrl: null,
          transferReference: null,
          transferNote: null,
          confirmedAt: null,
          confirmedByStaffId: null,
        },
      } as InvoiceMeItemDto;
    });
  }

  async findMe(
    currentUser: JwtPayload,
    query: InvoiceMeQueryDto,
  ): Promise<InvoiceMeListDto> {
    await this.markOverdue();

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const scope = await this.resolveMeScope(currentUser, query);

    const scopedItems =
      scope === 'staff_worklist'
        ? await this.getStaffWorkItems(currentUser, query)
        : scope === 'partner_receivable'
          ? await this.getPartnerReceivableItems(currentUser, query)
          : await this.getUserPayableItems(currentUser, query);

    const filteredItems = this.applyCommonInvoiceMeFilters(scopedItems, query);
    const total = filteredItems.length;
    const skip = (page - 1) * limit;

    return {
      roleContext: scope,
      items: filteredItems.slice(skip, skip + limit),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
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
          billingMonth: true,
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
        billingMonth:
          invoice.billingMonth ??
          this.formatBillingMonth(invoice.billingPeriodStart),
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

  async listOverdueApartmentsAndTenants(query?: { minOverdueDays?: number }) {
    await this.markOverdue();

    const now = new Date();
    const minOverdueDays = Math.max(1, query?.minOverdueDays ?? 1);
    const thresholdDate = new Date(
      now.getTime() - (minOverdueDays - 1) * 24 * 60 * 60 * 1000,
    );
    const millisecondsPerDay = 1000 * 60 * 60 * 24;

    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.overdue,
        invoiceType: {
          in: [InvoiceType.rent, InvoiceType.utility],
        },
        dueDate: {
          lt: thresholdDate,
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceType: true,
        dueDate: true,
        rentalContract: {
          select: {
            apartment: {
              select: {
                id: true,
                apartmentNumber: true,
              },
            },
            members: {
              select: {
                userId: true,
                user: {
                  select: {
                    fullName: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    const apartmentMap = new Map<
      string,
      {
        apartmentId: string;
        apartmentNumber: string;
        overdueInvoiceCount: number;
        maxOverdueDays: number;
        invoices: Array<{
          invoiceId: string;
          invoiceNumber: string;
          invoiceType: InvoiceType;
          dueDate: Date;
          overdueDays: number;
        }>;
        tenants: Map<
          string,
          {
            userId: string;
            fullName: string;
            email: string;
            phone: string | null;
            overdueInvoiceCount: number;
            maxOverdueDays: number;
          }
        >;
      }
    >();

    for (const invoice of overdueInvoices) {
      const apartment = invoice.rentalContract.apartment;
      const overdueDays = Math.max(
        1,
        Math.floor(
          (now.getTime() - invoice.dueDate.getTime()) / millisecondsPerDay,
        ),
      );

      if (!apartmentMap.has(apartment.id)) {
        apartmentMap.set(apartment.id, {
          apartmentId: apartment.id,
          apartmentNumber: apartment.apartmentNumber,
          overdueInvoiceCount: 0,
          maxOverdueDays: 0,
          invoices: [],
          tenants: new Map(),
        });
      }

      const apartmentEntry = apartmentMap.get(apartment.id)!;
      apartmentEntry.overdueInvoiceCount += 1;
      apartmentEntry.maxOverdueDays = Math.max(
        apartmentEntry.maxOverdueDays,
        overdueDays,
      );
      apartmentEntry.invoices.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        dueDate: invoice.dueDate,
        overdueDays,
      });

      for (const member of invoice.rentalContract.members) {
        if (!apartmentEntry.tenants.has(member.userId)) {
          apartmentEntry.tenants.set(member.userId, {
            userId: member.userId,
            fullName: member.user.fullName,
            email: member.user.email,
            phone: member.user.phone,
            overdueInvoiceCount: 0,
            maxOverdueDays: 0,
          });
        }

        const tenantEntry = apartmentEntry.tenants.get(member.userId)!;
        tenantEntry.overdueInvoiceCount += 1;
        tenantEntry.maxOverdueDays = Math.max(
          tenantEntry.maxOverdueDays,
          overdueDays,
        );
      }
    }

    const items = [...apartmentMap.values()]
      .map((entry) => ({
        apartmentId: entry.apartmentId,
        apartmentNumber: entry.apartmentNumber,
        overdueInvoiceCount: entry.overdueInvoiceCount,
        maxOverdueDays: entry.maxOverdueDays,
        invoices: entry.invoices,
        tenants: [...entry.tenants.values()].sort(
          (a, b) => b.maxOverdueDays - a.maxOverdueDays,
        ),
      }))
      .sort((a, b) => b.maxOverdueDays - a.maxOverdueDays);

    return {
      items,
      total: items.length,
      minOverdueDays,
      generatedAt: now,
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
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
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
      (sum, item) =>
        sum + Number(item.amount ?? 0) * Number(item.quantity ?? 1),
      0,
    );

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        rentalContractId: dto.rentalContractId,
        invoiceType: dto.invoiceType ?? InvoiceType.rent,
        invoiceContent: {
          items,
        } as unknown as Prisma.InputJsonValue,
        billingMonth: this.formatBillingMonth(new Date(dto.billingPeriodStart)),
        billingPeriodStart: new Date(dto.billingPeriodStart),
        billingPeriodEnd: new Date(dto.billingPeriodEnd),
        issueDate: new Date(),
        dueDate: new Date(dto.dueDate),
        baseRent: new Prisma.Decimal(rentalContract.monthlyRent.toString()),
        additionalCharges: items as unknown as Prisma.InputJsonValue,
        totalAmount: new Prisma.Decimal(itemsTotal.toFixed(2)),
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

  async markOverdue() {
    const now = new Date();
    const pendingStatuses: InvoiceStatus[] = [
      InvoiceStatus.draft,
      InvoiceStatus.issued,
      InvoiceStatus.sent,
      InvoiceStatus.partially_paid,
    ];

    const overdueRentUtilityCandidates = await this.prisma.invoice.findMany({
      where: {
        status: {
          in: pendingStatuses,
        },
        dueDate: { lt: now },
        invoiceType: {
          in: [InvoiceType.rent, InvoiceType.utility],
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceType: true,
        dueDate: true,
        rentalContract: {
          select: {
            apartment: {
              select: {
                apartmentNumber: true,
              },
            },
            members: {
              select: {
                userId: true,
                user: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const cancelledDepositInvoices = await this.prisma.invoice.updateMany({
      where: {
        status: {
          in: pendingStatuses,
        },
        dueDate: { lt: now },
        invoiceType: {
          in: [InvoiceType.deposit, InvoiceType.contractDeposit],
        },
      },
      data: { status: InvoiceStatus.cancelled },
    });

    const overdueInvoices = await this.prisma.invoice.updateMany({
      where: {
        status: {
          in: pendingStatuses,
        },
        dueDate: { lt: now },
        invoiceType: {
          notIn: [InvoiceType.deposit, InvoiceType.contractDeposit],
        },
      },
      data: { status: InvoiceStatus.overdue },
    });

    await this.notifyOverdueRentUtilityInvoices(
      Array.isArray(overdueRentUtilityCandidates)
        ? overdueRentUtilityCandidates
        : [],
      now,
    );

    return {
      count:
        (cancelledDepositInvoices?.count ?? 0) + (overdueInvoices?.count ?? 0),
    };
  }

  private async generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await this.prisma.invoice.count({
      where: { invoiceNumber: { startsWith: `INV-${year}${month}` } },
    });
    return `INV-${year}${month}-${String(count + 1).padStart(5, '0')}`;
  }

  private toJsonObject(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> {
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
      .find(
        (value) => value && typeof value === 'object' && !Array.isArray(value),
      );

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

    const electricityAmount = this.toNullableNumber(
      electricity?.amount ?? null,
    );
    const waterAmount = this.toNullableNumber(water?.amount ?? null);
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

  private toNullableNumber(value: string | null): number | null {
    if (!value) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
