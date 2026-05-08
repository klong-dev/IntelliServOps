import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateContractDto,
  UpdateContractDto,
  UploadContractPdfDto,
  CancelContractDto,
  AddContractMemberDto,
  CooperationCommissionPhaseInputDto,
  SetGlobalCooperationCommissionPhasesDto,
} from './dto';
import type { UpdateContractPdfContentDto } from './dto/update-contract-pdf-content.dto';
import { RenewContractDto, RenewalOption } from './dto/renew-contract.dto';
import {
  ContractStatus,
  ActorType,
  ApartmentStatus,
  DepositDisposition,
  MeterType,
  MemberStatus,
  PartnerCooperationContractStatus,
  UserApartmentStatus,
  ReservationStatus,
  InvoiceStatus,
  InvoiceType,
  MeterStatus,
  PaymentMethodType,
  MemberType,
  Prisma,
} from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';
import { ApartmentsService } from '../apartments/apartments.service';
import { IoTService } from '../iot/iot.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ContractPdfData, ContractPdfService } from './contract-pdf.service';
import {
  isMissingContractPartyAField,
  resolveContractPartyAFields,
} from './contract-party-a-defaults';
import * as crypto from 'crypto';
import { readFile } from 'fs/promises';
import * as path from 'path';
import axios from 'axios';

type WardLookupResponse = {
  name?: string;
  province_name?: string;
};

type WardAddressInfo = {
  wardName: string | null;
  provinceName: string | null;
};

type UtilityChargeItem = {
  description: string;
  amount: number;
  quantity: number;
  itemType: string;
  meterId: string;
  meterType: MeterType;
  meterNumber: string;
  unit: string;
  previousReading: number;
  currentReading: number;
  consumption: number;
  readingStartId: string;
  readingEndId: string;
  readingStartDate: string;
  readingEndDate: string;
  ratePerUnit: number;
};

type MeterReadingSnapshot = {
  id: string;
  readingDate: Date;
  readingValue: number;
  previousReadingValue: number | null;
  consumption: number | null;
};

type DoorPasswordSyncResult = {
  success: boolean;
  skipped: boolean;
  message: string;
};

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);
  private readonly contractRenewalWindowDays = 30;
  private readonly contractExpiryReminderDays = [30, 14, 7, 3, 1] as const;
  private readonly PDF_TOKEN_SECRET =
    process.env.JWT_SECRET || 'pdf-token-secret';
  private readonly PDF_TOKEN_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private readonly provincesBaseUrl = 'https://provinces.open-api.vn';
  private readonly landlordSignaturePath = path.join(
    process.cwd(),
    'documents',
    'sign.png',
  );
  private readonly wardAddressCache = new Map<number, WardAddressInfo | null>();
  private landlordSignatureBufferPromise: Promise<Buffer | null> | null = null;

  private readonly depositInvoiceSelect = {
    id: true,
    invoiceNumber: true,
    invoiceType: true,
    status: true,
    totalAmount: true,
    dueDate: true,
  } as const;

  private readonly cancellableInvoiceStatuses: InvoiceStatus[] = [
    InvoiceStatus.draft,
    InvoiceStatus.issued,
    InvoiceStatus.sent,
    InvoiceStatus.partially_paid,
    InvoiceStatus.overdue,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly apartmentsService: ApartmentsService,
    private readonly ioTService: IoTService,
    private readonly notificationsService: NotificationsService,
    private readonly contractPdfService: ContractPdfService,
  ) {}

  private async getDefaultLandlordSignature(): Promise<Buffer | null> {
    if (!this.landlordSignatureBufferPromise) {
      this.landlordSignatureBufferPromise = readFile(this.landlordSignaturePath)
        .then((buffer) => Buffer.from(buffer))
        .catch((error: unknown) => {
          this.landlordSignatureBufferPromise = null;
          this.logger.warn(
            `Could not load default landlord signature from ${this.landlordSignaturePath}: ${error instanceof Error ? error.message : 'unknown error'}`,
          );
          return null;
        });
    }

    return this.landlordSignatureBufferPromise;
  }

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

  private async enrichContractApartmentAddress<
    T extends { apartment?: { wardCode?: number | null } | null },
  >(items: T[]): Promise<T[]> {
    const uniqueWardCodes = Array.from(
      new Set(
        items
          .map((item) => item.apartment?.wardCode)
          .filter((code): code is number => typeof code === 'number'),
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

    return items.map((item) => {
      const wardCode = item.apartment?.wardCode;
      const wardAddress =
        typeof wardCode === 'number'
          ? (wardAddressMap.get(wardCode) ?? null)
          : null;

      return {
        ...item,
        apartment: item.apartment
          ? {
              ...item.apartment,
              wardName: wardAddress?.wardName ?? null,
              provinceName: wardAddress?.provinceName ?? null,
            }
          : item.apartment,
      };
    });
  }

  private appendSystemNote(
    existingNotes: string | null | undefined,
    nextNote: string,
  ): string {
    const trimmedExisting = existingNotes?.trim();
    return trimmedExisting ? `${trimmedExisting}\n${nextNote}` : nextNote;
  }

  private formatDate(d: Date): string {
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}/${d.getFullYear()}`;
  }

  private formatCurrency(amount: Prisma.Decimal | number | null | undefined) {
    if (amount === null || amount === undefined) {
      return undefined;
    }
    const num =
      typeof amount === 'object' && 'toNumber' in amount
        ? amount.toNumber()
        : Number(amount);
    if (!Number.isFinite(num)) {
      return undefined;
    }
    return num.toLocaleString('vi-VN');
  }

  private addMonthsKeepingContractDay(baseDate: Date, months: number): Date {
    const d = new Date(baseDate);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() < day) {
      d.setDate(0);
    }
    return d;
  }

  private getContractDurationMonthsInclusive(
    startDate: Date,
    endDate: Date,
  ): number {
    const endExclusive = new Date(endDate);
    endExclusive.setDate(endExclusive.getDate() + 1);

    let months =
      (endExclusive.getFullYear() - startDate.getFullYear()) * 12 +
      (endExclusive.getMonth() - startDate.getMonth());

    if (endExclusive.getDate() < startDate.getDate()) {
      months -= 1;
    }

    return Math.max(1, months);
  }

  private getUtcDayStart(date = new Date()): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private getWholeDayDiff(targetDate: Date, baseDate = new Date()): number {
    const targetDay = this.getUtcDayStart(targetDate);
    const baseDay = this.getUtcDayStart(baseDate);
    const diffMs = targetDay.getTime() - baseDay.getTime();

    return Math.round(diffMs / (24 * 60 * 60 * 1000));
  }

  async assertLeaseTermWithinCooperationContract(
    apartmentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const cooperationContracts =
      await this.prisma.partnerCooperationContract.findMany({
        where: {
          apartmentId,
          status: {
            in: [
              PartnerCooperationContractStatus.pending,
              PartnerCooperationContractStatus.signed,
              PartnerCooperationContractStatus.active,
            ],
          },
        },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          contractNumber: true,
          startDate: true,
          endDate: true,
        },
      });

    if (cooperationContracts.length === 0) {
      return;
    }

    const matchingContract =
      cooperationContracts.find(
        (contract) =>
          contract.startDate.getTime() <= startDate.getTime() &&
          contract.endDate.getTime() >= startDate.getTime(),
      ) ?? cooperationContracts[0];

    if (
      startDate.getTime() < matchingContract.startDate.getTime() ||
      endDate.getTime() > matchingContract.endDate.getTime()
    ) {
      throw new BadRequestException(
        `Apartment can only be rented within cooperation term ${this.formatDate(
          matchingContract.startDate,
        )} - ${this.formatDate(matchingContract.endDate)} for contract ${matchingContract.contractNumber}`,
      );
    }
  }

  private async hasContractExpiryReminderBeenSent(params: {
    contractId: string;
    recipientId: string;
    daysBeforeEnd: number;
  }): Promise<boolean> {
    const existingReminder = await this.prisma.notification.findFirst({
      where: {
        recipientType: ActorType.user,
        recipientId: params.recipientId,
        relatedEntityType: 'RentalContract',
        relatedEntityId: params.contractId,
        AND: [
          {
            metadata: {
              path: ['reminderType'],
              equals: 'contract_expiry',
            },
          },
          {
            metadata: {
              path: ['daysBeforeEnd'],
              equals: params.daysBeforeEnd,
            },
          },
        ],
      },
      select: { id: true },
    });

    return Boolean(existingReminder);
  }

  private async sendContractExpiryReminder(params: {
    contractId: string;
    contractNumber: string;
    endDate: Date;
    recipientId: string;
    daysBeforeEnd: number;
  }): Promise<void> {
    const alreadySent = await this.hasContractExpiryReminderBeenSent({
      contractId: params.contractId,
      recipientId: params.recipientId,
      daysBeforeEnd: params.daysBeforeEnd,
    });

    if (alreadySent) {
      return;
    }

    const dayLabel =
      params.daysBeforeEnd === 1 ? '1 ngày' : `${params.daysBeforeEnd} ngày`;
    const notification = await this.notificationsService.createAndPush({
      recipientType: ActorType.user,
      recipientId: params.recipientId,
      notificationType: 'warning',
      channel: 'in_app',
      title: 'Hợp đồng sắp hết hạn',
      message: `Hợp đồng ${params.contractNumber} sẽ hết hạn sau ${dayLabel} (${this.formatDate(params.endDate)}). Bạn chỉ có thể gia hạn trong 30 ngày cuối hợp đồng.`,
      actionUrl: `/contracts/${params.contractId}`,
      actionLabel: 'Xem hợp đồng',
      priority: 'high',
      relatedEntityType: 'RentalContract',
      relatedEntityId: params.contractId,
    });

    if (!notification?.id) {
      return;
    }

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        metadata: {
          reminderType: 'contract_expiry',
          daysBeforeEnd: params.daysBeforeEnd,
          contractNumber: params.contractNumber,
          endDate: params.endDate.toISOString(),
        } satisfies Prisma.InputJsonObject,
      },
      select: { id: true },
    });
  }

  private async buildUserApartmentActivationOperations(contract: {
    id: string;
    apartmentId: string;
    startDate: Date;
    endDate: Date;
    members?: Array<{
      userId: string;
      memberType: MemberType;
      isPrimaryContact: boolean;
    }>;
  }): Promise<{
    operations: Prisma.PrismaPromise<any>[];
    shouldResetDoorPin: boolean;
  }> {
    const members = contract.members ?? [];

    if (!members.length) {
      return {
        operations: [],
        shouldResetDoorPin: false,
      };
    }

    return {
      operations: members.map((member) =>
        this.prisma.userApartment.upsert({
          where: {
            userId_apartmentId_rentalContractId: {
              userId: member.userId,
              apartmentId: contract.apartmentId,
              rentalContractId: contract.id,
            },
          },
          create: {
            user: { connect: { id: member.userId } },
            apartment: { connect: { id: contract.apartmentId } },
            rentalContract: { connect: { id: contract.id } },
            moveInDate: contract.startDate,
            moveOutDate: contract.endDate,
            apartmentDoorPassword: null,
            isPrimaryTenant:
              member.memberType === MemberType.primary ||
              member.isPrimaryContact,
            status: UserApartmentStatus.active,
          },
          update: {
            moveInDate: contract.startDate,
            moveOutDate: contract.endDate,
            apartmentDoorPassword: null,
            isPrimaryTenant:
              member.memberType === MemberType.primary ||
              member.isPrimaryContact,
            status: UserApartmentStatus.active,
          },
        }),
      ),
      shouldResetDoorPin: true,
    };
  }

  private async clearApartmentDoorPinHash(
    apartmentId: string,
    rentalContractId: string,
  ): Promise<DoorPasswordSyncResult> {
    try {
      const syncResult =
        await this.ioTService.clearApartmentDoorPinHash(apartmentId);

      if (!syncResult.success) {
        this.logger.warn(
          `Door PIN reset was not completed for contract ${rentalContractId} apartment ${apartmentId}: ${syncResult.message}`,
        );
      }

      return {
        success: syncResult.success,
        skipped: Boolean(syncResult.skipped),
        message: syncResult.message,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Door PIN reset failed for contract ${rentalContractId} apartment ${apartmentId}: ${message}`,
      );

      return {
        success: false,
        skipped: false,
        message,
      };
    }
  }

  private async notifyMembersDoorFirstPassSetup(params: {
    memberUserIds: string[];
    rentalContractId: string;
    invoiceNumber?: string;
  }): Promise<void> {
    const contextText = params.invoiceNumber
      ? `Đặt cọc ${params.invoiceNumber} đã thanh toán.`
      : 'Đặt cọc hợp đồng đã thanh toán.';

    await Promise.allSettled(
      params.memberUserIds.map((memberUserId) =>
        this.notificationsService.createAndPush({
          recipientType: ActorType.user,
          recipientId: memberUserId,
          notificationType: 'success',
          channel: 'in_app',
          title: 'PIN cửa cần thiết lập lại',
          message: `${contextText} PIN cửa đã được đặt lại. Vui lòng thiết lập PIN mới khi sử dụng lần đầu.`,
          actionUrl: `/contracts/${params.rentalContractId}`,
          actionLabel: 'Xem hợp đồng',
          priority: 'high',
          relatedEntityType: 'RentalContract',
          relatedEntityId: params.rentalContractId,
        }),
      ),
    );
  }

  private async syncExpiredContractsByDate(): Promise<void> {
    const todayStart = this.getUtcDayStart();
    const now = new Date();

    await this.prisma.rentalContract.updateMany({
      where: {
        status: {
          in: [
            ContractStatus.pending,
            ContractStatus.signed,
            ContractStatus.active,
          ],
        },
        endDate: { lt: todayStart },
      },
      data: {
        status: ContractStatus.expired,
      },
    });

    // Contracts that passed activation date but still have no paid deposit
    // are treated as overdue and must expire.
    await this.prisma.rentalContract.updateMany({
      where: {
        status: {
          in: [ContractStatus.pending, ContractStatus.signed],
        },
        startDate: { lt: todayStart },
        endDate: { gte: todayStart },
        invoices: {
          none: {
            invoiceType: InvoiceType.contractDeposit,
            status: InvoiceStatus.paid,
          },
        },
      },
      data: {
        status: ContractStatus.expired,
      },
    });

    await this.prisma.reservation.updateMany({
      where: {
        status: ReservationStatus.pending,
        expiresAt: { lt: now },
      },
      data: {
        status: ReservationStatus.expired,
      },
    });

    await this.reconcileApartmentOccupancyStates();
  }

  private async reconcileApartmentOccupancyStates(): Promise<void> {
    const todayStart = this.getUtcDayStart();
    const now = new Date();

    const expiredAssignments =
      (await this.prisma.userApartment.findMany({
        where: {
          status: {
            in: [UserApartmentStatus.active, UserApartmentStatus.inactive],
          },
          rentalContract: {
            OR: [
              {
                status: {
                  in: [ContractStatus.expired, ContractStatus.terminated],
                },
              },
              {
                endDate: { lt: todayStart },
              },
            ],
          },
        },
        select: {
          id: true,
          moveOutDate: true,
          apartmentId: true,
          rentalContract: {
            select: {
              endDate: true,
            },
          },
        },
      })) ?? [];

    for (const assignment of expiredAssignments) {
      await this.prisma.userApartment.update({
        where: { id: assignment.id },
        data: {
          status: UserApartmentStatus.moved_out,
          moveOutDate:
            assignment.moveOutDate ??
            (assignment.rentalContract.endDate < todayStart
              ? assignment.rentalContract.endDate
              : todayStart),
        },
      });
    }

    const candidateApartmentIds = new Set<string>();

    const apartmentsNeedingSync =
      (await this.prisma.apartment.findMany({
        where: {
          status: {
            in: [ApartmentStatus.reserved, ApartmentStatus.occupied],
          },
        },
        select: { id: true },
      })) ?? [];

    for (const apartment of apartmentsNeedingSync) {
      candidateApartmentIds.add(apartment.id);
    }

    const liveContracts =
      (await this.prisma.rentalContract.findMany({
        where: {
          OR: [
            {
              status: ContractStatus.active,
              endDate: { gte: todayStart },
            },
            {
              status: {
                in: [ContractStatus.pending, ContractStatus.signed],
              },
              endDate: { gte: todayStart },
              invoices: {
                some: {
                  invoiceType: InvoiceType.contractDeposit,
                  status: InvoiceStatus.paid,
                },
              },
            },
          ],
        },
        select: { apartmentId: true },
      })) ?? [];

    for (const contract of liveContracts) {
      if (typeof contract.apartmentId === 'string' && contract.apartmentId) {
        candidateApartmentIds.add(contract.apartmentId);
      }
    }

    const liveReservations =
      (await this.prisma.reservation.findMany({
        where: {
          OR: [
            {
              status: ReservationStatus.pending,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            {
              status: ReservationStatus.confirmed,
            },
          ],
        },
        select: { apartmentId: true },
      })) ?? [];

    for (const reservation of liveReservations) {
      if (
        typeof reservation.apartmentId === 'string' &&
        reservation.apartmentId
      ) {
        candidateApartmentIds.add(reservation.apartmentId);
      }
    }

    for (const apartmentId of candidateApartmentIds) {
      await this.syncApartmentOccupancyState(apartmentId, todayStart, now);
    }
  }

  private async syncApartmentOccupancyState(
    apartmentId: string,
    todayStart: Date,
    now: Date,
  ): Promise<void> {
    const activeContract = await this.prisma.rentalContract.findFirst({
      where: {
        apartmentId,
        status: ContractStatus.active,
        endDate: { gte: todayStart },
      },
      select: { id: true },
    });

    if (activeContract) {
      await this.prisma.apartment.update({
        where: { id: apartmentId },
        data: { status: ApartmentStatus.occupied },
      });
      return;
    }

    const reservedContract = await this.prisma.rentalContract.findFirst({
      where: {
        apartmentId,
        status: { in: [ContractStatus.pending, ContractStatus.signed] },
        endDate: { gte: todayStart },
        invoices: {
          some: {
            invoiceType: InvoiceType.contractDeposit,
            status: InvoiceStatus.paid,
          },
        },
      },
      select: { id: true },
    });

    const reservedReservation = await this.prisma.reservation.findFirst({
      where: {
        apartmentId,
        OR: [
          {
            status: ReservationStatus.pending,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          {
            status: ReservationStatus.confirmed,
            createdContract: {
              status: { in: [ContractStatus.pending, ContractStatus.signed] },
              endDate: { gte: todayStart },
            },
          },
        ],
      },
      select: { id: true },
    });

    await this.prisma.apartment.update({
      where: { id: apartmentId },
      data: {
        status:
          reservedContract || reservedReservation
            ? ApartmentStatus.reserved
            : ApartmentStatus.available,
      },
    });
  }

  private computeMonthlyBillingPeriod(
    contractStartDate: Date,
    contractEndDate: Date,
    monthOffset: number,
  ): { periodStart: Date; periodEnd: Date } {
    const periodStart = this.addMonthsKeepingContractDay(
      contractStartDate,
      monthOffset,
    );
    const nextPeriodStart = this.addMonthsKeepingContractDay(periodStart, 1);
    const periodEnd = new Date(nextPeriodStart);
    periodEnd.setDate(periodEnd.getDate() - 1);

    if (periodEnd > contractEndDate) {
      return {
        periodStart,
        periodEnd: new Date(contractEndDate),
      };
    }

    return { periodStart, periodEnd };
  }

  private resolveInvoiceDueDate(
    periodStart: Date,
    paymentDueDay: number,
    now: Date,
  ): Date {
    const dueDate = new Date(
      Date.UTC(
        periodStart.getUTCFullYear(),
        periodStart.getUTCMonth(),
        paymentDueDay,
      ),
    );

    if (dueDate.getUTCMonth() !== periodStart.getUTCMonth()) {
      dueDate.setUTCDate(0);
    }

    const todayStart = this.getUtcDayStart(now);
    if (dueDate < todayStart) {
      const adjusted = new Date(todayStart);
      adjusted.setUTCDate(adjusted.getUTCDate() + 1);
      return adjusted;
    }

    return dueDate;
  }

  private resolveDepositInvoiceDueDate(startDate: Date, now: Date): Date {
    const tomorrowStart = this.getUtcDayStart(now);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

    const contractStart = this.getUtcDayStart(startDate);
    return contractStart > tomorrowStart ? contractStart : tomorrowStart;
  }

  private async generateRentInvoiceNumber(refDate: Date): Promise<string> {
    const year = refDate.getFullYear();
    const month = String(refDate.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-REN-${year}${month}`;
    const count = await this.prisma.invoice.count({
      where: {
        invoiceNumber: { startsWith: prefix },
      },
    });

    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateUtilityInvoiceNumber(refDate: Date): Promise<string> {
    const year = refDate.getFullYear();
    const month = String(refDate.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-UTL-${year}${month}`;
    const count = await this.prisma.invoice.count({
      where: {
        invoiceNumber: { startsWith: prefix },
      },
    });

    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

  private resolveUtilityInvoiceDueDate(paymentDueDay: number, now: Date): Date {
    const todayStart = this.getUtcDayStart(now);
    const dueDate = new Date(
      Date.UTC(
        todayStart.getUTCFullYear(),
        todayStart.getUTCMonth(),
        paymentDueDay,
      ),
    );

    if (dueDate.getUTCMonth() !== todayStart.getUTCMonth()) {
      dueDate.setUTCDate(0);
    }

    if (dueDate <= todayStart) {
      const nextMonthDueDate = new Date(
        Date.UTC(
          todayStart.getUTCFullYear(),
          todayStart.getUTCMonth() + 1,
          paymentDueDay,
        ),
      );
      if (nextMonthDueDate.getUTCMonth() !== todayStart.getUTCMonth() + 1) {
        nextMonthDueDate.setUTCDate(0);
      }

      return nextMonthDueDate;
    }

    return dueDate;
  }

  private parseUtilityBoolean(
    value: Prisma.JsonValue | undefined,
    key: string,
  ): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const raw = (value as Record<string, unknown>)[key];
    return raw === true;
  }

  private parseUtilityRate(
    value: Prisma.JsonValue | undefined,
    key: string,
  ): number | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const raw = (value as Record<string, unknown>)[key];
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Number(parsed.toFixed(2));
  }

  private formatUtilityMeterRateText(
    meter: {
      ratePerUnit: Prisma.Decimal | number | string | null;
      unitOfMeasurement: string | null;
    } | null,
    fallbackUnit: string,
  ): string | null {
    if (!meter?.ratePerUnit) {
      return null;
    }

    const rate = Number(meter.ratePerUnit);
    if (!Number.isFinite(rate) || rate <= 0) {
      return null;
    }

    const rateText = this.formatCurrency(rate) ?? String(rate);
    return `${rateText} VND/${meter.unitOfMeasurement ?? fallbackUnit}`;
  }

  private roundTo2(value: number): number {
    return Number(value.toFixed(2));
  }

  private normalizeReadingSnapshot(
    reading: {
      id: string;
      readingDate: Date;
      readingValue: Prisma.Decimal | number;
      previousReadingValue: Prisma.Decimal | number | null;
      consumption: Prisma.Decimal | number | null;
    } | null,
  ): MeterReadingSnapshot | null {
    if (!reading) {
      return null;
    }

    return {
      id: reading.id,
      readingDate: reading.readingDate,
      readingValue: Number(reading.readingValue),
      previousReadingValue:
        reading.previousReadingValue !== null
          ? Number(reading.previousReadingValue)
          : null,
      consumption:
        reading.consumption !== null ? Number(reading.consumption) : null,
    };
  }

  private async resolveBillingSnapshot(params: {
    utilityMeterId: string;
    boundaryDate: Date;
    mode: 'start' | 'end';
  }): Promise<MeterReadingSnapshot | null> {
    const boundaryOperator = params.mode === 'start' ? 'gte' : 'lte';
    const reading = await this.prisma.utilityReading.findFirst({
      where: {
        utilityMeterId: params.utilityMeterId,
        readingDate: {
          [boundaryOperator]: params.boundaryDate,
        },
      },
      orderBy:
        params.mode === 'start'
          ? [{ readingDate: 'asc' }, { createdAt: 'asc' }]
          : [{ readingDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        readingDate: true,
        readingValue: true,
        previousReadingValue: true,
        consumption: true,
      },
    });

    return this.normalizeReadingSnapshot(reading);
  }

  private async ensureBillingSnapshot(params: {
    utilityMeterId: string;
    boundaryDate: Date;
    mode: 'start' | 'end';
  }): Promise<MeterReadingSnapshot | null> {
    return this.resolveBillingSnapshot(params);
  }

  private async buildUtilityChargeItems(params: {
    contractId: string;
    apartmentId: string;
    periodStart: Date;
    periodEnd: Date;
    utilitiesIncluded?: Prisma.JsonValue | null;
  }): Promise<UtilityChargeItem[]> {
    const meters = await this.prisma.utilityMeter.findMany({
      where: {
        apartmentId: params.apartmentId,
        status: MeterStatus.active,
        meterType: { in: [MeterType.electricity, MeterType.water] },
      },
      select: {
        id: true,
        meterType: true,
        meterNumber: true,
        unitOfMeasurement: true,
        ratePerUnit: true,
        readings: { select: { id: true } },
      },
    });

    const utilityItems: UtilityChargeItem[] = [];

    for (const meter of meters) {
      const typeKey = meter.meterType;
      if (
        this.parseUtilityBoolean(params.utilitiesIncluded ?? undefined, typeKey)
      ) {
        continue;
      }

      if (!meter.readings.length) {
        continue;
      }

      const startSnapshot = await this.ensureBillingSnapshot({
        utilityMeterId: meter.id,
        boundaryDate: params.periodStart,
        mode: 'start',
      });
      const endSnapshot = await this.ensureBillingSnapshot({
        utilityMeterId: meter.id,
        boundaryDate: params.periodEnd,
        mode: 'end',
      });

      if (!startSnapshot || !endSnapshot) {
        continue;
      }

      const newReading = endSnapshot.readingValue;
      let oldReading = startSnapshot.readingValue;
      let consumption = newReading - oldReading;

      if (consumption < 0) {
        const fallbackConsumption =
          endSnapshot.consumption ??
          (endSnapshot.previousReadingValue !== null
            ? endSnapshot.readingValue - endSnapshot.previousReadingValue
            : 0);
        if (Number.isFinite(fallbackConsumption) && fallbackConsumption > 0) {
          consumption = fallbackConsumption;
          oldReading = newReading - fallbackConsumption;
        }
      }

      if (!Number.isFinite(consumption) || consumption < 0) {
        consumption = 0;
      }

      if (consumption <= 0) {
        continue;
      }

      if (oldReading === null) {
        oldReading = newReading - consumption;
      }

      const ratePerUnit =
        meter.ratePerUnit !== null ? Number(meter.ratePerUnit) : null;

      if (!ratePerUnit || !Number.isFinite(ratePerUnit) || ratePerUnit <= 0) {
        this.logger.warn(
          `Skipping ${typeKey} utility invoice item for contract ${params.contractId}: missing ratePerUnit`,
        );
        continue;
      }

      const normalizedConsumption = this.roundTo2(consumption);
      const normalizedRate = this.roundTo2(ratePerUnit);
      const amount = this.roundTo2(normalizedConsumption * normalizedRate);
      const meterTypeLabel =
        typeKey === MeterType.electricity ? 'Electricity' : 'Water';
      const unit =
        meter.unitOfMeasurement ??
        (typeKey === MeterType.electricity ? 'kWh' : 'm3');

      utilityItems.push({
        description: `${meterTypeLabel} usage (${meter.meterNumber}): ${normalizedConsumption} ${unit} x ${normalizedRate} VND`,
        amount,
        quantity: normalizedConsumption,
        itemType: `utility_${typeKey}`,
        meterId: meter.id,
        meterType: typeKey,
        meterNumber: meter.meterNumber,
        unit,
        previousReading: this.roundTo2(oldReading),
        currentReading: this.roundTo2(newReading),
        consumption: normalizedConsumption,
        readingStartId: startSnapshot.id,
        readingEndId: endSnapshot.id,
        readingStartDate: startSnapshot.readingDate.toISOString(),
        readingEndDate: endSnapshot.readingDate.toISOString(),
        ratePerUnit: normalizedRate,
      });

      await this.prisma.utilityReading.updateMany({
        where: {
          utilityMeterId: meter.id,
          rentalContractId: null,
          id: { in: [startSnapshot.id, endSnapshot.id] },
        },
        data: {
          rentalContractId: params.contractId,
        },
      });
    }

    return utilityItems;
  }

  private async createRentInvoiceForPeriod(params: {
    contractId: string;
    apartmentId: string;
    contractNumber: string;
    monthlyRent: Prisma.Decimal | number;
    paymentMethod: PaymentMethodType;
    paymentDueDay: number;
    periodStart: Date;
    periodEnd: Date;
    memberUserIds: string[];
  }): Promise<void> {
    const periodMarker = `${params.periodStart.toISOString().slice(0, 10)}`;
    const marker = `RENT_INVOICE_FOR_CONTRACT:${params.contractId}:${periodMarker}`;

    const existingRentInvoice = await this.prisma.invoice.findFirst({
      where: {
        rentalContractId: params.contractId,
        invoiceType: InvoiceType.rent,
        billingPeriodStart: params.periodStart,
        billingPeriodEnd: params.periodEnd,
      },
      select: {
        id: true,
      },
    });

    if (existingRentInvoice) {
      return;
    }

    const now = new Date();
    const dueDate = this.resolveInvoiceDueDate(
      params.periodStart,
      params.paymentDueDay,
      now,
    );
    const rentAmount = Number(params.monthlyRent);
    const invoiceTotal = this.roundTo2(rentAmount);
    const invoiceNumber = await this.generateRentInvoiceNumber(now);
    const rentItems: Prisma.InputJsonArray = [
      {
        description: `Monthly rent for ${params.contractNumber}`,
        amount: rentAmount,
        quantity: 1,
        itemType: 'rent',
      },
    ];
    const invoiceContent: Prisma.InputJsonObject = {
      title: `Rent invoice ${invoiceNumber}`,
      description: `Billing period ${params.periodStart.toISOString().slice(0, 10)} to ${params.periodEnd.toISOString().slice(0, 10)}`,
      items: rentItems,
    };

    const createdInvoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        rentalContract: { connect: { id: params.contractId } },
        invoiceType: InvoiceType.rent,
        invoiceContent,
        billingPeriodStart: params.periodStart,
        billingPeriodEnd: params.periodEnd,
        issueDate: now,
        dueDate,
        baseRent: rentAmount,
        utilityCharges: undefined,
        totalAmount: invoiceTotal,
        paymentMethod: params.paymentMethod,
        status: InvoiceStatus.issued,
        notes: `Auto-created monthly rent invoice. ${marker}`,
      },
      select: {
        id: true,
        invoiceNumber: true,
        dueDate: true,
      },
    });

    if (!createdInvoice) {
      return;
    }

    for (const userId of params.memberUserIds) {
      await this.notifySafely({
        recipientType: ActorType.user,
        recipientId: userId,
        title: 'Hóa đơn tiền nhà mới',
        message: `Hóa đơn ${createdInvoice.invoiceNumber} đã được tạo. Hạn thanh toán: ${this.formatDate(createdInvoice.dueDate)}.`,
        actionUrl: `/invoices/${createdInvoice.id}`,
        actionLabel: 'Thanh toán ngay',
        relatedEntityType: 'Invoice',
        relatedEntityId: createdInvoice.id,
      });
    }
  }

  private async createUtilityInvoiceForPeriod(params: {
    contractId: string;
    apartmentId: string;
    contractNumber: string;
    paymentMethod: PaymentMethodType;
    paymentDueDay: number;
    periodStart: Date;
    periodEnd: Date;
    memberUserIds: string[];
    utilitiesIncluded?: Prisma.JsonValue | null;
  }): Promise<void> {
    const existingUtilityInvoice = await this.prisma.invoice.findFirst({
      where: {
        rentalContractId: params.contractId,
        invoiceType: InvoiceType.utility,
        billingPeriodStart: params.periodStart,
        billingPeriodEnd: params.periodEnd,
      },
      select: { id: true },
    });

    if (existingUtilityInvoice) {
      return;
    }

    const utilityItems = await this.buildUtilityChargeItems({
      contractId: params.contractId,
      apartmentId: params.apartmentId,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      utilitiesIncluded: params.utilitiesIncluded,
    });

    if (utilityItems.length === 0) {
      return;
    }

    const now = new Date();
    const invoiceNumber = await this.generateUtilityInvoiceNumber(now);
    const totalUtilityAmount = this.roundTo2(
      utilityItems.reduce((sum, item) => sum + item.amount, 0),
    );
    const invoiceContent: Prisma.InputJsonObject = {
      title: `Utility invoice ${invoiceNumber}`,
      description: `Utility billing period ${params.periodStart.toISOString().slice(0, 10)} to ${params.periodEnd.toISOString().slice(0, 10)}`,
      items: utilityItems.map((item) => ({
        type: item.meterType,
        description: item.description,
        previousReading: item.previousReading,
        currentReading: item.currentReading,
        quantity: item.consumption,
        unit: item.unit,
        ratePerUnit: item.ratePerUnit,
        amount: item.amount,
      })),
    };
    const electricityItem = utilityItems.find(
      (item) => item.meterType === MeterType.electricity,
    );
    const waterItem = utilityItems.find(
      (item) => item.meterType === MeterType.water,
    );
    const utilityCharges = {
      ...(electricityItem && { electricity: electricityItem }),
      ...(waterItem && { water: waterItem }),
      totalUtilityAmount,
    } as Prisma.InputJsonObject;

    const createdInvoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        rentalContract: { connect: { id: params.contractId } },
        invoiceType: InvoiceType.utility,
        invoiceContent,
        billingMonth: params.periodStart.toISOString().slice(0, 7),
        billingPeriodStart: params.periodStart,
        billingPeriodEnd: params.periodEnd,
        issueDate: now,
        dueDate: this.resolveUtilityInvoiceDueDate(params.paymentDueDay, now),
        baseRent: 0,
        utilityCharges,
        totalAmount: totalUtilityAmount,
        paymentMethod: params.paymentMethod,
        status: InvoiceStatus.issued,
        notes: `Auto-created monthly utility invoice for ${params.contractNumber}.`,
      },
      select: { id: true, invoiceNumber: true, dueDate: true },
    });

    for (const userId of params.memberUserIds) {
      await this.notifySafely({
        recipientType: ActorType.user,
        recipientId: userId,
        title: 'Hoa don dien nuoc moi',
        message: `Hoa don ${createdInvoice.invoiceNumber} da duoc tao. Han thanh toan: ${this.formatDate(createdInvoice.dueDate)}.`,
        actionUrl: `/invoices/${createdInvoice.id}`,
        actionLabel: 'Thanh toan ngay',
        relatedEntityType: 'Invoice',
        relatedEntityId: createdInvoice.id,
      });
    }
  }

  private async generateMissingMonthlyRentInvoicesForContract(
    contractId: string,
    upToDate = this.getUtcDayStart(),
  ): Promise<void> {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        apartmentId: true,
        contractNumber: true,
        startDate: true,
        endDate: true,
        monthlyRent: true,
        paymentMethod: true,
        paymentDueDay: true,
        utilitiesIncluded: true,
        utilitiesCharges: true,
        status: true,
        members: {
          where: { status: MemberStatus.active },
          select: { userId: true },
        },
      },
    });

    if (!contract || contract.status !== ContractStatus.active) {
      return;
    }

    let monthOffset = 0;
    while (true) {
      const { periodStart, periodEnd } = this.computeMonthlyBillingPeriod(
        contract.startDate,
        contract.endDate,
        monthOffset,
      );

      if (periodStart > contract.endDate || periodStart > upToDate) {
        break;
      }

      await this.createRentInvoiceForPeriod({
        contractId: contract.id,
        apartmentId: contract.apartmentId,
        contractNumber: contract.contractNumber,
        monthlyRent: contract.monthlyRent,
        paymentMethod: contract.paymentMethod,
        paymentDueDay: contract.paymentDueDay,
        periodStart,
        periodEnd,
        memberUserIds: (contract.members ?? []).map((member) => member.userId),
      });

      monthOffset += 1;
    }
  }

  private async generateMissingMonthlyUtilityInvoicesForContract(
    contractId: string,
    upToDate = this.getUtcDayStart(),
  ): Promise<void> {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        apartmentId: true,
        contractNumber: true,
        startDate: true,
        endDate: true,
        paymentMethod: true,
        paymentDueDay: true,
        utilitiesIncluded: true,
        status: true,
        members: {
          where: { status: MemberStatus.active },
          select: { userId: true },
        },
      },
    });

    if (!contract || contract.status !== ContractStatus.active) {
      return;
    }

    let monthOffset = 0;
    while (true) {
      const { periodStart, periodEnd } = this.computeMonthlyBillingPeriod(
        contract.startDate,
        contract.endDate,
        monthOffset,
      );

      if (periodStart > contract.endDate || periodEnd >= upToDate) {
        break;
      }

      await this.createUtilityInvoiceForPeriod({
        contractId: contract.id,
        apartmentId: contract.apartmentId,
        contractNumber: contract.contractNumber,
        paymentMethod: contract.paymentMethod,
        paymentDueDay: contract.paymentDueDay,
        periodStart,
        periodEnd,
        memberUserIds: (contract.members ?? []).map((member) => member.userId),
        utilitiesIncluded: contract.utilitiesIncluded,
      });

      monthOffset += 1;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateMonthlyRentInvoices(): Promise<void> {
    const today = this.getUtcDayStart();
    const contracts = await this.prisma.rentalContract.findMany({
      where: {
        status: ContractStatus.active,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      select: {
        id: true,
      },
    });

    for (const contract of contracts) {
      try {
        await this.generateMissingMonthlyRentInvoicesForContract(
          contract.id,
          today,
        );
      } catch (error) {
        this.logger.error(
          `Failed to generate monthly rent invoice for contract ${contract.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  @Cron('0 1 * * *')
  async generateMonthlyUtilityInvoices(): Promise<void> {
    const today = this.getUtcDayStart();
    const contracts = await this.prisma.rentalContract.findMany({
      where: {
        status: ContractStatus.active,
        startDate: { lt: today },
        endDate: { gte: today },
      },
      select: { id: true },
    });

    for (const contract of contracts) {
      try {
        await this.generateMissingMonthlyUtilityInvoicesForContract(
          contract.id,
          today,
        );
      } catch (error) {
        this.logger.error(
          `Failed to generate monthly utility invoice for contract ${contract.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async autoActivateContractsWhenDepositPaid(): Promise<void> {
    await this.syncExpiredContractsByDate();

    const today = this.getUtcDayStart();
    const contracts = await this.prisma.rentalContract.findMany({
      where: {
        status: { in: [ContractStatus.pending, ContractStatus.signed] },
        startDate: { lte: today },
        endDate: { gte: today },
        invoices: {
          some: {
            invoiceType: InvoiceType.contractDeposit,
            status: InvoiceStatus.paid,
          },
        },
      },
      select: {
        id: true,
      },
    });

    for (const contract of contracts) {
      try {
        await this.activateWhenDepositPaid(contract.id);
      } catch (error) {
        this.logger.error(
          `Failed to auto-activate contract ${contract.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async sendExpiringContractRenewalReminders(): Promise<void> {
    const today = this.getUtcDayStart();
    const maxReminderDate = new Date(today);
    maxReminderDate.setUTCDate(
      maxReminderDate.getUTCDate() + this.contractRenewalWindowDays,
    );

    const contracts = await this.prisma.rentalContract.findMany({
      where: {
        status: {
          in: [ContractStatus.active, ContractStatus.signed],
        },
        endDate: {
          gte: today,
          lte: maxReminderDate,
        },
      },
      select: {
        id: true,
        contractNumber: true,
        endDate: true,
        members: {
          where: { status: MemberStatus.active },
          select: {
            userId: true,
          },
        },
      },
    });

    for (const contract of contracts) {
      const daysBeforeEnd = this.getWholeDayDiff(contract.endDate, today);
      if (
        !this.contractExpiryReminderDays.some(
          (value) => value === daysBeforeEnd,
        )
      ) {
        continue;
      }

      for (const member of contract.members) {
        try {
          await this.sendContractExpiryReminder({
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            endDate: contract.endDate,
            recipientId: member.userId,
            daysBeforeEnd,
          });
        } catch (error) {
          this.logger.error(
            `Failed to send contract expiry reminder for contract ${contract.id} to user ${member.userId}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    }
  }

  async regenerateContractPdf(contractId: string): Promise<void> {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNumber: true,
        startDate: true,
        endDate: true,
        monthlyRent: true,
        depositAmount: true,
        paymentDueDay: true,
        paymentMethod: true,
        specialConditions: true,
        contractTerms: true,
        landlordName: true,
        landlordIdNumber: true,
        landlordIdIssueDate: true,
        landlordIdIssuePlace: true,
        landlordAddress: true,
        landlordPhone: true,
        landlordSignature: true,
        tenantSignature: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            buildingName: true,
            totalArea: true,
            usableArea: true,
            numberOfBedrooms: true,
            numberOfBathrooms: true,
          },
        },
        members: {
          where: { status: MemberStatus.active },
          select: {
            memberType: true,
            isPrimaryContact: true,
            user: {
              select: {
                fullName: true,
                phone: true,
                email: true,
                identity: {
                  select: {
                    nationalId: true,
                    issueDate: true,
                    address: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const members = contract.members;
    const primaryMember =
      members.find((m) => m.memberType === 'primary' || m.isPrimaryContact) ||
      members[0];

    const apartmentAddress = [
      contract.apartment?.buildingName,
      contract.apartment?.apartmentNumber,
    ]
      .filter(Boolean)
      .join(' - ');

    const tenantMembers = members.map((member) => ({
      fullName: member.user.fullName || undefined,
      idNumber: member.user.identity?.nationalId || undefined,
      idIssueDate: member.user.identity?.issueDate || undefined,
      address: member.user.identity?.address || undefined,
      phone: member.user.phone || undefined,
      email: member.user.email || undefined,
      memberType: member.memberType,
    }));

    const apartmentId = contract.apartment?.id ?? null;
    const utilityMeters = apartmentId
      ? await this.prisma.utilityMeter.findMany({
          where: {
            apartmentId,
            status: MeterStatus.active,
            meterType: { in: [MeterType.electricity, MeterType.water] },
          },
          select: {
            meterType: true,
            unitOfMeasurement: true,
            ratePerUnit: true,
          },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        })
      : [];
    const electricityRateText = this.formatUtilityMeterRateText(
      utilityMeters.find((meter) => meter.meterType === MeterType.electricity) ??
        null,
      'kWh',
    );
    const waterRateText = this.formatUtilityMeterRateText(
      utilityMeters.find((meter) => meter.meterType === MeterType.water) ?? null,
      'm3',
    );
    const partyAFields = resolveContractPartyAFields({
      landlordName: contract.landlordName,
      landlordIdNumber: contract.landlordIdNumber,
      landlordIdIssueDate: contract.landlordIdIssueDate,
      landlordAddress: contract.landlordAddress,
      landlordPhone: contract.landlordPhone,
    });
    const landlordSignature = contract.landlordSignature
      ? Buffer.from(contract.landlordSignature)
      : await this.getDefaultLandlordSignature();

    const pdfData: ContractPdfData = {
      contractNumber: contract.contractNumber,
      landlordName: partyAFields.landlordName,
      landlordIdNumber: partyAFields.landlordIdNumber,
      landlordIdIssueDate: partyAFields.landlordIdIssueDate,
      landlordIdIssuePlace: contract.landlordIdIssuePlace || undefined,
      landlordAddress: partyAFields.landlordAddress,
      landlordPhone: partyAFields.landlordPhone,
      tenantName: primaryMember?.user.fullName || undefined,
      tenantIdNumber: primaryMember?.user.identity?.nationalId || undefined,
      tenantIdIssueDate: primaryMember?.user.identity?.issueDate || undefined,
      tenantAddress: primaryMember?.user.identity?.address || undefined,
      tenantPhone: primaryMember?.user.phone || undefined,
      tenantEmail: primaryMember?.user.email || undefined,
      tenantMembers,
      apartmentAddress: apartmentAddress || undefined,
      apartmentNumber: contract.apartment?.apartmentNumber || undefined,
      apartmentArea: contract.apartment?.totalArea?.toString() || undefined,
      apartmentUsableArea:
        contract.apartment?.usableArea?.toString() || undefined,
      apartmentBedrooms: contract.apartment?.numberOfBedrooms || undefined,
      apartmentBathrooms: contract.apartment?.numberOfBathrooms || undefined,
      startDate: this.formatDate(contract.startDate),
      endDate: this.formatDate(contract.endDate),
      monthlyRent: this.formatCurrency(contract.monthlyRent),
      depositAmount: this.formatCurrency(contract.depositAmount),
      paymentDueDay: contract.paymentDueDay,
      paymentMethod: contract.paymentMethod,
      specialConditions: contract.specialConditions || undefined,
      contractTerms: contract.contractTerms || undefined,
      electricityRateText: electricityRateText || undefined,
      waterRateText: waterRateText || undefined,
      landlordSignature,
      tenantSignature: contract.tenantSignature
        ? Buffer.from(contract.tenantSignature)
        : null,
    };

    const pdfBuffer =
      await this.contractPdfService.generateContractPdf(pdfData);

    const updateData: Prisma.RentalContractUpdateInput = {
      contractPdfData: new Uint8Array(pdfBuffer),
    };

    if (isMissingContractPartyAField(contract.landlordName)) {
      updateData.landlordName = partyAFields.landlordName;
    }

    if (isMissingContractPartyAField(contract.landlordIdNumber)) {
      updateData.landlordIdNumber = partyAFields.landlordIdNumber;
    }

    if (isMissingContractPartyAField(contract.landlordIdIssueDate)) {
      updateData.landlordIdIssueDate = partyAFields.landlordIdIssueDate;
    }

    if (isMissingContractPartyAField(contract.landlordAddress)) {
      updateData.landlordAddress = partyAFields.landlordAddress;
    }

    if (isMissingContractPartyAField(contract.landlordPhone)) {
      updateData.landlordPhone = partyAFields.landlordPhone;
    }

    if (!contract.landlordSignature && landlordSignature) {
      updateData.landlordSignature = new Uint8Array(landlordSignature);
    }

    await this.prisma.rentalContract.update({
      where: { id: contractId },
      data: updateData,
    });
  }

  private async notifySafely(params: {
    recipientType: ActorType;
    recipientId: string;
    title: string;
    message: string;
    actionUrl?: string;
    actionLabel?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<void> {
    try {
      await this.notificationsService.createAndPush({
        recipientType: params.recipientType,
        recipientId: params.recipientId,
        notificationType: 'info',
        channel: 'in_app',
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
        actionLabel: params.actionLabel,
        priority: 'high',
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId,
      });
    } catch {
      // Do not block contract flow when notification delivery fails.
    }
  }

  private normalizeCommissionPhaseInput(
    phase: CooperationCommissionPhaseInputDto,
  ) {
    const effectiveFrom = new Date(phase.effectiveFrom);
    const effectiveTo = phase.effectiveTo ? new Date(phase.effectiveTo) : null;

    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException(
        `Invalid effectiveFrom for phase ${phase.phaseName}`,
      );
    }

    if (effectiveTo && Number.isNaN(effectiveTo.getTime())) {
      throw new BadRequestException(
        `Invalid effectiveTo for phase ${phase.phaseName}`,
      );
    }

    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException(
        `effectiveTo must be later than effectiveFrom for phase ${phase.phaseName}`,
      );
    }

    return {
      phaseName: phase.phaseName.trim(),
      effectiveFrom,
      effectiveTo,
      commissionRate: phase.commissionRate,
    };
  }

  private validateCommissionPhaseOverlaps(
    phases: Array<{
      phaseName: string;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      commissionRate: number;
    }>,
  ) {
    const sorted = [...phases].sort(
      (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime(),
    );

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const currentEnd = current.effectiveTo;

      if (!currentEnd) {
        if (i < sorted.length - 1) {
          throw new BadRequestException(
            `Open-ended phase ${current.phaseName} must be the last phase`,
          );
        }
        continue;
      }

      const next = sorted[i + 1];
      if (next && next.effectiveFrom <= currentEnd) {
        throw new BadRequestException(
          `Commission phases ${current.phaseName} and ${next.phaseName} are overlapping`,
        );
      }
    }

    return sorted;
  }

  async setGlobalCooperationCommissionPhases(
    dto: SetGlobalCooperationCommissionPhasesDto,
    adminId: string,
  ) {
    const normalizedPhases = dto.phases.map((phase) =>
      this.normalizeCommissionPhaseInput(phase),
    );
    const sortedPhases = this.validateCommissionPhaseOverlaps(normalizedPhases);

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.cooperationCommissionPhase.updateMany({
        where: { isActive: true },
        data: {
          isActive: false,
          updatedByAdminId: adminId,
        },
      });

      await tx.cooperationCommissionPhase.createMany({
        data: sortedPhases.map((phase) => ({
          phaseName: phase.phaseName,
          effectiveFrom: phase.effectiveFrom,
          effectiveTo: phase.effectiveTo,
          commissionRate: phase.commissionRate,
          isActive: true,
          createdByAdminId: adminId,
          updatedByAdminId: adminId,
        })),
      });
    });

    const phases = await this.prisma.cooperationCommissionPhase.findMany({
      where: { isActive: true },
      orderBy: { effectiveFrom: 'asc' },
      select: {
        id: true,
        phaseName: true,
        effectiveFrom: true,
        effectiveTo: true,
        commissionRate: true,
      },
    });

    return {
      phases: phases.map((phase) => ({
        id: phase.id,
        phaseName: phase.phaseName,
        effectiveFrom: phase.effectiveFrom,
        effectiveTo: phase.effectiveTo,
        commissionRate: Number(phase.commissionRate),
      })),
      updatedAt: now,
    };
  }

  /**
   * Generate a signed token for PDF access (valid for 5 minutes)
   */
  generatePdfToken(contractId: string): string {
    const expiry = Date.now() + this.PDF_TOKEN_EXPIRY;
    const data = `${contractId}:${expiry}`;
    const signature = crypto
      .createHmac('sha256', this.PDF_TOKEN_SECRET)
      .update(data)
      .digest('hex');
    return Buffer.from(`${data}:${signature}`).toString('base64url');
  }

  /**
   * Verify PDF token and return contractId if valid
   */
  verifyPdfToken(token: string): string {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const [contractId, expiryStr, signature] = decoded.split(':');
      const expiry = parseInt(expiryStr, 10);

      if (Date.now() > expiry) {
        throw new UnauthorizedException('PDF token expired');
      }

      const expectedSignature = crypto
        .createHmac('sha256', this.PDF_TOKEN_SECRET)
        .update(`${contractId}:${expiryStr}`)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new UnauthorizedException('Invalid PDF token');
      }

      return contractId;
    } catch {
      throw new UnauthorizedException('Invalid PDF token');
    }
  }

  /**
   * Get all contracts with filters
   * Admin/Operator see all, Staff see assigned, User see own
   */
  async findAll(
    currentUser: JwtPayload,
    query?: { status?: ContractStatus; page?: number; limit?: number },
  ) {
    await this.autoActivateContractsWhenDepositPaid();

    const { status, page = 1, limit = 20 } = query ?? {};
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const where: Prisma.RentalContractWhereInput = {
      ...(status && { status }),
    };

    if (currentUser.actorType === 'user') {
      where.members = {
        some: { userId: currentUser.sub },
      };
    }

    const findAllArgs = Prisma.validator<Prisma.RentalContractFindManyArgs>()({
      where,
      select: {
        id: true,
        contractNumber: true,
        startDate: true,
        endDate: true,
        monthlyRent: true,
        depositAmount: true,
        status: true,
        category: true,
        createdAt: true,
        contractPdfData: true,
        terminationReason: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            wardCode: true,
            provinceCode: true,
            buildingName: true,
            streetAddress: true,
            maxOccupants: true,
            numberOfBedrooms: true,
          },
        },
        members: {
          select: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            memberType: true,
            isPrimaryContact: true,
          },
        },
        renewalContracts: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            category: true,
            startDate: true,
            endDate: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          where: {
            invoiceType: InvoiceType.contractDeposit,
            status: InvoiceStatus.paid,
          },
          select: {
            id: true,
            paidAt: true,
          },
          take: 1,
          orderBy: { paidAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    });

    const [contracts, total] = await Promise.all([
      this.prisma.rentalContract.findMany(findAllArgs),
      this.prisma.rentalContract.count({ where }),
    ]);

    const mappedItems = contracts.map(
      ({ contractPdfData, invoices, renewalContracts, ...contract }) => {
        const pdfToken = contractPdfData
          ? this.generatePdfToken(contract.id)
          : null;
        const paidDepositInvoice = invoices?.[0] ?? null;
        const latestRenewal = renewalContracts?.[0] ?? null;

        return {
          ...contract,
          hasPdf: !!contractPdfData,
          pdfUrl: pdfToken ? `/contracts/pdf/view?token=${pdfToken}` : null,
          isDepositPaid: !!paidDepositInvoice,
          depositPaidAt: paidDepositInvoice?.paidAt ?? null,
          isRenewed: !!latestRenewal,
          latestRenewalContractId: latestRenewal?.id ?? null,
          renewalContracts,
        };
      },
    );

    const items = await this.enrichContractApartmentAddress(mappedItems);

    return {
      items,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /**
   * Get contract by ID with full details
   */
  async findOne(id: string, currentUser: JwtPayload) {
    await this.syncExpiredContractsByDate();

    const findOneArgs = Prisma.validator<Prisma.RentalContractFindUniqueArgs>()(
      {
        where: { id },
        include: {
          apartment: {
            select: {
              id: true,
              apartmentNumber: true,
              wardCode: true,
              provinceCode: true,
              buildingName: true,
              streetAddress: true,
              maxOccupants: true,
              numberOfBedrooms: true,
              numberOfBathrooms: true,
              totalArea: true,
              usableArea: true,
            },
          },
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phone: true,
                  identity: {
                    select: {
                      nationalId: true,
                    },
                  },
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
          invoices: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              status: true,
              dueDate: true,
            },
          },
          renewalContracts: {
            select: {
              id: true,
              contractNumber: true,
              status: true,
              category: true,
              startDate: true,
              endDate: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    );

    let contract = await this.prisma.rentalContract.findUnique(findOneArgs);

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Users can only see their own contracts
    if (currentUser.actorType === 'user') {
      const isMember = contract.members.some(
        (m) => m.user.id === currentUser.sub,
      );
      if (!isMember) {
        throw new NotFoundException('Contract not found');
      }
    }

    const todayStart = this.getUtcDayStart();
    const canAutoActivateOnRead =
      (contract.status === ContractStatus.pending ||
        contract.status === ContractStatus.signed) &&
      contract.startDate <= todayStart &&
      contract.endDate >= todayStart;

    const paidDepositInvoice = await this.prisma.invoice.findFirst({
      where: {
        rentalContractId: id,
        invoiceType: InvoiceType.contractDeposit,
        status: InvoiceStatus.paid,
      },
      select: {
        paidAt: true,
      },
      orderBy: { paidAt: 'desc' },
    });

    if (canAutoActivateOnRead && paidDepositInvoice) {
      try {
        await this.activateWhenDepositPaid(id);
        const refreshedContract =
          await this.prisma.rentalContract.findUnique(findOneArgs);
        if (refreshedContract) {
          contract = refreshedContract;
        }
      } catch (error) {
        this.logger.warn(
          `Auto-activation on contract read failed for ${id}`,
          error instanceof Error ? error.message : undefined,
        );
      }
    }

    // Convert binary PDF to base64 for JSON response
    const { contractPdfData, landlordSignature, tenantSignature, ...rest } =
      contract;

    const pdfToken = contractPdfData ? this.generatePdfToken(id) : null;
    const membersWithNationalId = (rest.members ?? []).map((member) => ({
      ...member,
      user: {
        id: member.user.id,
        fullName: member.user.fullName,
        email: member.user.email,
        phone: member.user.phone,
        nationalId: member.user.identity?.nationalId ?? null,
      },
    }));
    const occupancyLimit = rest.apartment?.maxOccupants ?? 0;
    const maxOccupants = occupancyLimit > 0 ? occupancyLimit : 0;
    const currentOccupants = membersWithNationalId.length;
    const maxAddableMembers = Math.max(
      0,
      occupancyLimit > 0 ? occupancyLimit - membersWithNationalId.length : 0,
    );

    const wardAddress =
      typeof rest.apartment?.wardCode === 'number'
        ? await this.resolveWardAddressFromWardCode(rest.apartment.wardCode)
        : null;

    return {
      ...rest,
      apartment: rest.apartment
        ? {
            ...rest.apartment,
            wardName: wardAddress?.wardName ?? null,
            provinceName: wardAddress?.provinceName ?? null,
          }
        : rest.apartment,
      members: membersWithNationalId,
      maxAddableMembers,
      maxOccupants,
      currentOccupants,
      hasPdf: !!contractPdfData,
      pdfUrl: `/contracts/${id}/pdf`,
      publicPdfUrl: pdfToken ? `/contracts/pdf/view?token=${pdfToken}` : null,
      hasLandlordSignature: !!landlordSignature,
      hasTenantSignature: !!tenantSignature,
      isDepositPaid: !!paidDepositInvoice,
      depositPaidAt: paidDepositInvoice?.paidAt ?? null,
      isRenewed: !!rest.renewalContracts?.length,
      latestRenewalContractId: rest.renewalContracts?.[0]?.id ?? null,
      renewalContracts: rest.renewalContracts ?? [],
    };
  }

  /**
   * Get contract PDF data for download
   */
  async getContractPdf(id: string, currentUser: JwtPayload) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      select: {
        id: true,
        contractNumber: true,
        contractPdfData: true,
        members: {
          select: { userId: true },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Users can only access their own contracts
    if (currentUser.actorType === 'user') {
      const isMember = contract.members.some(
        (m) => m.userId === currentUser.sub,
      );
      if (!isMember) {
        throw new NotFoundException('Contract not found');
      }
    }

    if (!contract.contractPdfData) {
      throw new NotFoundException('Contract PDF has not been generated yet');
    }

    return {
      buffer: contract.contractPdfData,
      contractNumber: contract.contractNumber,
    };
  }

  /**
   * Get contract PDF by signed public token
   */
  async getContractPdfByToken(token: string) {
    if (!token || !token.trim()) {
      throw new BadRequestException('PDF token is required');
    }

    const contractId = this.verifyPdfToken(token.trim());
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id: contractId },
      select: {
        contractNumber: true,
        contractPdfData: true,
      },
    });

    if (!contract || !contract.contractPdfData) {
      throw new NotFoundException('Contract or PDF not found');
    }

    return {
      buffer: contract.contractPdfData,
      contractNumber: contract.contractNumber,
    };
  }

  /**
   * Upload signed contract PDF from frontend
   */
  async uploadSignedPdf(
    id: string,
    contractPdf: any,
    currentUser: JwtPayload,
    body?: UploadContractPdfDto,
  ) {
    const validMimeTypes = ['application/pdf'];
    if (!validMimeTypes.includes(contractPdf.mimetype)) {
      throw new BadRequestException(
        `Invalid PDF format. Allowed: application/pdf. Received: ${contractPdf.mimetype}`,
      );
    }

    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      select: {
        id: true,
        contractNumber: true,
        contractPdfData: true,
        startDate: true,
        depositAmount: true,
        paymentMethod: true,
        apartment: {
          select: {
            depositAmount: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const updateData: Prisma.RentalContractUpdateInput = {
      contractPdfData: new Uint8Array(contractPdf.buffer),
      status: ContractStatus.signed,
    };

    if (body?.signedDate) {
      updateData.signedDate = new Date(body.signedDate);
    }

    if (body?.contractDocumentUrl) {
      updateData.contractDocumentUrl = body.contractDocumentUrl;
    }

    await this.prisma.rentalContract.update({
      where: { id },
      data: updateData,
    });

    await this.prisma.reservation.updateMany({
      where: { createdContractId: id },
      data: {
        status: ReservationStatus.confirmed,
        cancelReason: null,
      },
    });

    const depositInvoice =
      await this.createDepositInvoiceForSignedContract(contract);

    if (!depositInvoice) {
      throw new BadRequestException(
        'Cannot create contract deposit invoice because deposit amount is missing or invalid',
      );
    }

    const contractDetail = await this.findOne(id, currentUser);
    return {
      ...contractDetail,
      depositInvoice,
    };
  }

  async signCooperationContract(
    contractId: string,
    currentUser: JwtPayload,
    contractPdf: {
      mimetype: string;
      buffer: Buffer;
    },
    options?: { signedDate?: string; contractDocumentUrl?: string },
  ) {
    if (contractPdf.mimetype !== 'application/pdf') {
      throw new BadRequestException(
        `Invalid PDF format. Allowed: application/pdf. Received: ${contractPdf.mimetype}`,
      );
    }

    const contract = await this.prisma.partnerCooperationContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNumber: true,
        status: true,
        partnerId: true,
        apartmentId: true,
        approvedByOperatorId: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            status: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Cooperation contract not found');
    }

    if (contract.partnerId !== currentUser.sub) {
      throw new UnauthorizedException(
        'You can only sign your own cooperation contract',
      );
    }

    if (contract.apartment.status !== ('pending' as ApartmentStatus)) {
      throw new BadRequestException(
        'Apartment must be pending before partner signs cooperation contract',
      );
    }

    if (
      contract.status === PartnerCooperationContractStatus.cancelled ||
      contract.status === PartnerCooperationContractStatus.terminated ||
      contract.status === PartnerCooperationContractStatus.expired
    ) {
      throw new ConflictException('Cooperation contract cannot be signed');
    }

    const signedDate = options?.signedDate
      ? new Date(options.signedDate)
      : new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const signedContract = await tx.partnerCooperationContract.update({
        where: { id: contract.id },
        data: {
          contractPdfData: new Uint8Array(contractPdf.buffer),
          contractDocumentUrl: options?.contractDocumentUrl,
          signedAt: signedDate,
          status: PartnerCooperationContractStatus.signed,
        },
        select: {
          id: true,
          contractNumber: true,
          status: true,
          signedAt: true,
          contractDocumentUrl: true,
        },
      });

      await tx.user.update({
        where: { id: contract.partnerId },
        data: {
          isPartner: true,
        },
      });

      const updatedApartment = await tx.apartment.update({
        where: { id: contract.apartmentId },
        data: {
          status: ApartmentStatus.available,
        },
        select: {
          id: true,
          apartmentNumber: true,
          status: true,
        },
      });

      return { signedContract, updatedApartment };
    });

    const token = this.generatePdfToken(updated.signedContract.id);

    if (contract.approvedByOperatorId) {
      await this.notifySafely({
        recipientType: ActorType.operator,
        recipientId: contract.approvedByOperatorId,
        title: 'Partner đã ký hợp đồng hợp tác',
        message: `Partner đã ký và tải lên hợp đồng cho căn hộ ${updated.updatedApartment.apartmentNumber}.`,
        actionUrl: `/apartments/${updated.updatedApartment.id}/cooperation-contract`,
        actionLabel: 'Xem hợp đồng',
        relatedEntityType: 'Apartment',
        relatedEntityId: updated.updatedApartment.id,
      });
    }

    return {
      apartmentId: updated.updatedApartment.id,
      apartmentNumber: updated.updatedApartment.apartmentNumber,
      apartmentStatus: updated.updatedApartment.status,
      cooperationContractId: updated.signedContract.id,
      cooperationContractNumber: updated.signedContract.contractNumber,
      cooperationContractStatus: updated.signedContract.status,
      signedDate: updated.signedContract.signedAt,
      contractDocumentUrl: updated.signedContract.contractDocumentUrl,
      cooperationContractPdfUrl: `/apartments/cooperation-contracts/${updated.signedContract.id}/pdf`,
      cooperationContractPublicPdfUrl: `/apartments/cooperation-contracts/pdf/view?token=${token}`,
    };
  }

  async cancelCooperationContract(
    contractId: string,
    currentUser: JwtPayload,
    body?: { reason?: string },
  ) {
    const contract = await this.prisma.partnerCooperationContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNumber: true,
        status: true,
        notes: true,
        partnerId: true,
        approvedByOperatorId: true,
        apartmentId: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Cooperation contract not found');
    }

    if (contract.partnerId !== currentUser.sub) {
      throw new UnauthorizedException(
        'You can only cancel your own cooperation contract',
      );
    }

    if (
      contract.status === PartnerCooperationContractStatus.cancelled ||
      contract.status === PartnerCooperationContractStatus.terminated ||
      contract.status === PartnerCooperationContractStatus.expired
    ) {
      throw new ConflictException('Cooperation contract cannot be cancelled');
    }

    const cancelledAt = new Date();
    const cancelReason = body?.reason?.trim() || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelledContract = await tx.partnerCooperationContract.update({
        where: { id: contract.id },
        data: {
          status: PartnerCooperationContractStatus.cancelled,
          endDate: cancelledAt,
          notes: cancelReason
            ? `${contract.notes ?? ''}${contract.notes ? '\n' : ''}Cancelled by partner: ${cancelReason}`
            : contract.notes,
        },
        select: {
          id: true,
          contractNumber: true,
          status: true,
        },
      });

      const updatedApartment = await tx.apartment.update({
        where: { id: contract.apartmentId },
        data: {
          status: ApartmentStatus.inactive,
        },
        select: {
          id: true,
          apartmentNumber: true,
          status: true,
        },
      });

      return { cancelledContract, updatedApartment };
    });

    if (contract.approvedByOperatorId) {
      await this.notifySafely({
        recipientType: ActorType.operator,
        recipientId: contract.approvedByOperatorId,
        title: 'Partner đã hủy hợp đồng hợp tác',
        message: `Partner đã hủy hợp đồng hợp tác của căn hộ ${updated.updatedApartment.apartmentNumber}.`,
        actionUrl: `/apartments/${updated.updatedApartment.id}/cooperation-contract`,
        actionLabel: 'Xem hợp đồng',
        relatedEntityType: 'Apartment',
        relatedEntityId: updated.updatedApartment.id,
      });
    }

    return {
      apartmentId: updated.updatedApartment.id,
      apartmentNumber: updated.updatedApartment.apartmentNumber,
      apartmentStatus: updated.updatedApartment.status,
      cooperationContractId: updated.cancelledContract.id,
      cooperationContractNumber: updated.cancelledContract.contractNumber,
      cooperationContractStatus: updated.cancelledContract.status,
      cancelledAt,
      cancelReason,
    };
  }

  /**
   * Create new rental contract
   */
  async create(createDto: CreateContractDto, currentUser: JwtPayload) {
    const requestedStartDate = new Date(createDto.startDate);
    const requestedEndDate = new Date(createDto.endDate);

    if (!createDto.members?.length) {
      throw new BadRequestException('At least one contract member is required');
    }

    const normalizedMembers = createDto.members.map((member) => ({
      ...member,
      isPrimaryContact:
        member.isPrimaryContact ?? member.memberType === 'primary',
    }));

    const memberUserIds = normalizedMembers.map((member) => member.userId);
    const uniqueMemberUserIds = new Set(memberUserIds);
    if (uniqueMemberUserIds.size !== memberUserIds.length) {
      throw new BadRequestException(
        'Duplicate userId is not allowed in contract members',
      );
    }

    const primaryMembers = normalizedMembers.filter(
      (member) => member.memberType === MemberType.primary,
    );
    if (primaryMembers.length !== 1) {
      throw new BadRequestException(
        'Contract must have exactly one primary member',
      );
    }

    const primaryContacts = normalizedMembers.filter(
      (member) => member.isPrimaryContact,
    );
    if (primaryContacts.length > 1) {
      throw new BadRequestException(
        'Only one primary contact is allowed in contract members',
      );
    }

    const primaryUserId = primaryMembers[0].userId;
    const primaryContactUserId = primaryContacts[0]?.userId;
    if (primaryContactUserId && primaryContactUserId !== primaryUserId) {
      throw new BadRequestException(
        'Primary contact must be the same user as primary member',
      );
    }

    // Check if apartment is available
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: createDto.apartmentId },
      select: { id: true, status: true },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    if (apartment.status !== ApartmentStatus.available) {
      throw new ConflictException('Apartment is not available for rent');
    }

    await this.assertLeaseTermWithinCooperationContract(
      createDto.apartmentId,
      requestedStartDate,
      requestedEndDate,
    );

    // Check for overlapping contracts
    const overlapping = await this.prisma.rentalContract.findFirst({
      where: {
        apartmentId: createDto.apartmentId,
        status: { in: ['active', 'pending', 'signed'] },
        OR: [
          {
            startDate: { lte: requestedEndDate },
            endDate: { gte: requestedStartDate },
          },
        ],
      },
    });

    if (overlapping) {
      throw new ConflictException('Apartment has an overlapping contract');
    }

    // Generate contract number
    const contractNumber = await this.generateContractNumber();
    const defaultPartyAFields = resolveContractPartyAFields();

    // Create contract with members in transaction
    const createdContract = await this.prisma.$transaction(async (tx) => {
      const contract = await tx.rentalContract.create({
        data: {
          contractNumber,
          apartment: { connect: { id: createDto.apartmentId } },
          startDate: requestedStartDate,
          endDate: requestedEndDate,
          monthlyRent: createDto.monthlyRent,
          depositAmount: createDto.depositAmount,
          paymentDueDay: createDto.paymentDueDay,
          paymentMethod: createDto.paymentMethod,
          utilitiesIncluded: createDto.utilitiesIncluded as any,
          utilitiesCharges: createDto.utilitiesCharges as any,
          contractTerms: createDto.contractTerms,
          specialConditions: createDto.specialConditions,
          ...defaultPartyAFields,
          status: ContractStatus.draft,
          createdByStaff:
            currentUser.actorType === 'staff'
              ? { connect: { id: currentUser.sub } }
              : undefined,
        },
        select: {
          id: true,
          contractNumber: true,
        },
      });

      // Create contract members
      await tx.userContractMember.createMany({
        data: normalizedMembers.map((m) => ({
          userId: m.userId,
          rentalContractId: contract.id,
          memberType: m.memberType,
          isPrimaryContact: m.isPrimaryContact,
          sharePercentage: m.sharePercentage,
          status: MemberStatus.active,
        })),
      });

      return contract;
    });

    return this.findOne(createdContract.id, currentUser);
  }

  /**
   * Update contract
   */
  async update(id: string, updateDto: UpdateContractDto) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Prevent editing active/signed contracts (except status changes)
    if (
      (contract.status === ContractStatus.active ||
        contract.status === ContractStatus.signed) &&
      updateDto.status !== ContractStatus.terminated
    ) {
      throw new ConflictException('Cannot modify active contract');
    }

    const updateData: any = { ...updateDto };

    if (updateDto.startDate) {
      updateData.startDate = new Date(updateDto.startDate);
    }
    if (updateDto.endDate) {
      updateData.endDate = new Date(updateDto.endDate);
    }
    if (updateDto.signedDate) {
      updateData.signedDate = new Date(updateDto.signedDate);
    }
    if (updateDto.terminationDate) {
      updateData.terminationDate = new Date(updateDto.terminationDate);
    }

    if (updateDto.startDate || updateDto.endDate) {
      const nextStartDate = updateDto.startDate
        ? new Date(updateDto.startDate)
        : contract.startDate;
      const nextEndDate = updateDto.endDate
        ? new Date(updateDto.endDate)
        : contract.endDate;

      if (nextStartDate >= nextEndDate) {
        throw new BadRequestException('startDate must be earlier than endDate');
      }

      await this.assertLeaseTermWithinCooperationContract(
        contract.apartmentId,
        nextStartDate,
        nextEndDate,
      );
    }

    return this.prisma.rentalContract.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        contractNumber: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async updateContractPdfContent(
    id: string,
    updateDto: UpdateContractPdfContentDto,
    currentUser: JwtPayload,
  ) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      select: {
        id: true,
        apartmentId: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (
      contract.status === ContractStatus.terminated ||
      contract.status === ContractStatus.expired
    ) {
      throw new ConflictException(
        'Cannot edit PDF content of terminated or expired contract',
      );
    }

    const nextStartDate = updateDto.startDate
      ? new Date(updateDto.startDate)
      : contract.startDate;
    const nextEndDate = updateDto.endDate
      ? new Date(updateDto.endDate)
      : contract.endDate;

    if (nextStartDate >= nextEndDate) {
      throw new BadRequestException('startDate must be earlier than endDate');
    }

    await this.assertLeaseTermWithinCooperationContract(
      contract.apartmentId,
      nextStartDate,
      nextEndDate,
    );

    const updateData: Prisma.RentalContractUpdateInput = {
      ...(updateDto.landlordName !== undefined && {
        landlordName: updateDto.landlordName,
      }),
      ...(updateDto.landlordIdNumber !== undefined && {
        landlordIdNumber: updateDto.landlordIdNumber,
      }),
      ...(updateDto.landlordIdIssueDate !== undefined && {
        landlordIdIssueDate: updateDto.landlordIdIssueDate,
      }),
      ...(updateDto.landlordIdIssuePlace !== undefined && {
        landlordIdIssuePlace: updateDto.landlordIdIssuePlace,
      }),
      ...(updateDto.landlordAddress !== undefined && {
        landlordAddress: updateDto.landlordAddress,
      }),
      ...(updateDto.landlordPhone !== undefined && {
        landlordPhone: updateDto.landlordPhone,
      }),
      ...(updateDto.startDate && { startDate: new Date(updateDto.startDate) }),
      ...(updateDto.endDate && { endDate: new Date(updateDto.endDate) }),
      ...(updateDto.monthlyRent !== undefined && {
        monthlyRent: updateDto.monthlyRent,
      }),
      ...(updateDto.depositAmount !== undefined && {
        depositAmount: updateDto.depositAmount,
      }),
      ...(updateDto.paymentDueDay !== undefined && {
        paymentDueDay: updateDto.paymentDueDay,
      }),
      ...(updateDto.paymentMethod && {
        paymentMethod: updateDto.paymentMethod,
      }),
      ...(updateDto.specialConditions !== undefined && {
        specialConditions: updateDto.specialConditions,
      }),
      ...(updateDto.contractTerms !== undefined && {
        contractTerms: updateDto.contractTerms,
      }),
    };

    await this.prisma.rentalContract.update({
      where: { id },
      data: updateData,
    });

    await this.regenerateContractPdf(id);

    return this.findOne(id, currentUser);
  }

  async cancelByUser(
    id: string,
    cancelDto: CancelContractDto,
    currentUser: JwtPayload,
  ) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      include: {
        members: {
          select: {
            userId: true,
            memberType: true,
            isPrimaryContact: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const currentMember = contract.members.find(
      (member) => member.userId === currentUser.sub,
    );
    if (!currentMember) {
      throw new NotFoundException('Contract not found');
    }

    if (currentMember.memberType !== MemberType.primary) {
      throw new ForbiddenException(
        'Only the primary member can cancel this contract',
      );
    }

    await this.terminateContractForfeitDeposit(
      id,
      `User cancelled: ${cancelDto.reason}`,
      { actorType: currentUser.actorType, actorId: currentUser.sub },
      contract,
    );

    return await this.findOne(id, currentUser);
  }

  async terminateContractForfeitDeposit(
    id: string,
    reason: string,
    _actor?: { actorType: string; actorId: string },
    preloadedContract?: {
      id: string;
      apartmentId: string;
      status: ContractStatus;
      endDate: Date;
      renewedFromContractId: string | null;
    },
  ) {
    const contract =
      preloadedContract ??
      (await this.prisma.rentalContract.findUnique({
        where: { id },
        select: {
          id: true,
          apartmentId: true,
          status: true,
          endDate: true,
          renewedFromContractId: true,
        },
      }));

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (
      contract.status === ContractStatus.terminated ||
      contract.status === ContractStatus.expired
    ) {
      throw new ConflictException('Contract cannot be cancelled');
    }

    const cancelReason = reason;
    const terminatedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      const paidDepositInvoices =
        (await tx.invoice.findMany({
          where: {
            rentalContractId: id,
            invoiceType: {
              in: [InvoiceType.deposit, InvoiceType.contractDeposit],
            },
            status: InvoiceStatus.paid,
            OR: [
              { depositDisposition: null },
              { depositDisposition: DepositDisposition.held },
            ],
          },
          select: {
            id: true,
            notes: true,
          },
        })) ?? [];

      await tx.reservation.updateMany({
        where: { createdContractId: id },
        data: { status: ReservationStatus.cancelled },
      });

      await tx.rentalContract.update({
        where: { id },
        data: {
          status: ContractStatus.terminated,
          terminationDate: terminatedAt,
          terminationReason: cancelReason,
          earlyTerminationFee: null,
          ...(contract.renewedFromContractId && {
            renewedFromContractId: null,
          }),
        },
      });

      await tx.apartment.update({
        where: { id: contract.apartmentId },
        data: { status: ApartmentStatus.available },
      });

      await tx.invoice.updateMany({
        where: {
          rentalContractId: id,
          status: { in: this.cancellableInvoiceStatuses },
        },
        data: {
          status: InvoiceStatus.cancelled,
          cancelledAt: terminatedAt,
          cancellationReason: cancelReason,
        },
      });

      for (const depositInvoice of paidDepositInvoices) {
        await tx.invoice.update({
          where: { id: depositInvoice.id },
          data: {
            depositDisposition: DepositDisposition.forfeited,
            depositDispositionAt: terminatedAt,
            depositDispositionReason: cancelReason,
            notes: this.appendSystemNote(
              depositInvoice.notes,
              `Deposit forfeited on ${terminatedAt.toISOString()} because ${cancelReason}`,
            ),
          },
        });
      }

      await tx.userContractMember.updateMany({
        where: { rentalContractId: id },
        data: { status: MemberStatus.moved_out, moveOutDate: terminatedAt },
      });

      await tx.userApartment.updateMany({
        where: { rentalContractId: id },
        data: {
          status: UserApartmentStatus.moved_out,
          moveOutDate: terminatedAt,
        },
      });
    });
  }

  /**
   * Activate contract when deposit has been paid and contract is still valid.
   * FE test flows can bypass status/deposit/move-in validation by passing
   * `bypassValidation`, while still refusing already expired contracts.
   */
  async activateWhenDepositPaid(
    id: string,
    options?: { bypassValidation?: boolean },
  ) {
    const bypassValidation = options?.bypassValidation === true;

    if (!bypassValidation) {
      await this.syncExpiredContractsByDate();
    }

    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      include: {
        apartment: true,
        members: {
          where: { status: MemberStatus.active },
          select: {
            userId: true,
            memberType: true,
            isPrimaryContact: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (bypassValidation) {
      if (
        contract.status !== ContractStatus.draft &&
        contract.status !== ContractStatus.pending &&
        contract.status !== ContractStatus.signed
      ) {
        throw new ConflictException(
          'Test activation only supports draft, pending, or signed contracts',
        );
      }
    } else if (
      contract.status !== ContractStatus.pending &&
      contract.status !== ContractStatus.signed
    ) {
      throw new ConflictException(
        'Contract must be pending or signed to activate',
      );
    }

    const todayStart = this.getUtcDayStart();
    if (contract.endDate < todayStart) {
      await this.prisma.rentalContract.update({
        where: { id },
        data: { status: ContractStatus.expired },
      });
      throw new ConflictException('Contract already expired');
    }

    if (!bypassValidation && contract.startDate > todayStart) {
      throw new ConflictException(
        'Contract cannot be activated before move-in date',
      );
    }

    const paidDepositInvoice = bypassValidation
      ? null
      : await this.prisma.invoice.findFirst({
          where: {
            rentalContractId: id,
            invoiceType: InvoiceType.contractDeposit,
            status: InvoiceStatus.paid,
          },
          select: { id: true, invoiceNumber: true },
        });

    if (!bypassValidation && !paidDepositInvoice) {
      throw new ConflictException(
        'Contract deposit invoice must be paid before activation',
      );
    }

    const activationPayload = await this.buildUserApartmentActivationOperations(
      {
        id: contract.id,
        apartmentId: contract.apartmentId,
        startDate: contract.startDate,
        endDate: contract.endDate,
        members: contract.members,
      },
    );

    const result = await this.prisma.$transaction([
      this.prisma.rentalContract.update({
        where: { id },
        data: {
          status: ContractStatus.active,
          signedDate: new Date(),
        },
      }),
      this.prisma.apartment.update({
        where: { id: contract.apartmentId },
        data: { status: ApartmentStatus.occupied },
      }),
      ...activationPayload.operations,
    ]);

    if (activationPayload.shouldResetDoorPin) {
      const syncResult = await this.clearApartmentDoorPinHash(
        contract.apartmentId,
        contract.id,
      );

      if (!syncResult.success) {
        this.logger.warn(
          `Skip door password notification for contract ${contract.id} because IoT sync failed: ${syncResult.message}`,
        );
      } else {
        const memberUserIds = (contract.members ?? []).map(
          (member) => member.userId,
        );

        if (memberUserIds.length > 0) {
          await this.notifyMembersDoorFirstPassSetup({
            memberUserIds,
            rentalContractId: contract.id,
            invoiceNumber: paidDepositInvoice?.invoiceNumber,
          });
        }
      }
    }

    const invoiceGenerationDate =
      contract.startDate > todayStart ? contract.startDate : todayStart;

    await this.generateMissingMonthlyRentInvoicesForContract(
      id,
      invoiceGenerationDate,
    );

    return result;
  }

  async addMemberByNationalId(
    contractId: string,
    body: AddContractMemberDto,
    currentUser: JwtPayload,
  ) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        status: true,
        apartment: {
          select: {
            maxOccupants: true,
          },
        },
        members: {
          where: { status: MemberStatus.active },
          select: {
            userId: true,
            memberType: true,
            isPrimaryContact: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (
      contract.status === ContractStatus.signed ||
      contract.status === ContractStatus.active ||
      contract.status === ContractStatus.terminated ||
      contract.status === ContractStatus.expired
    ) {
      throw new ConflictException(
        'Cannot add members after contract is signed',
      );
    }

    if (currentUser.actorType === 'user') {
      const hasPermission = contract.members.some(
        (member) => member.userId === currentUser.sub,
      );
      if (!hasPermission) {
        throw new NotFoundException('Contract not found');
      }
    }

    const occupancyLimit = contract.apartment?.maxOccupants;
    if (
      typeof occupancyLimit === 'number' &&
      occupancyLimit > 0 &&
      contract.members.length >= occupancyLimit
    ) {
      throw new BadRequestException(
        `Contract can have at most ${occupancyLimit} members based on apartment max occupants`,
      );
    }

    if (body.memberType && body.memberType !== MemberType.co_tenant) {
      throw new BadRequestException(
        'Added member must be secondary (co_tenant)',
      );
    }

    if (body.isPrimaryContact === true) {
      throw new BadRequestException('Added member cannot be primary contact');
    }

    const normalizedNationalId = body.nationalId.trim();
    if (!normalizedNationalId) {
      throw new BadRequestException('nationalId is required');
    }

    const identity = await this.prisma.userIdentity.findFirst({
      where: {
        nationalId: normalizedNationalId,
        isVerified: true,
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            isActive: true,
            isVerified: true,
          },
        },
      },
    });

    if (!identity || !identity.user.isActive || !identity.user.isVerified) {
      throw new BadRequestException(
        'No active verified user found for this CCCD number',
      );
    }

    const existedMember = contract.members.some(
      (member) => member.userId === identity.userId,
    );
    if (existedMember) {
      throw new ConflictException('This user is already a contract member');
    }

    await this.prisma.userContractMember.create({
      data: {
        userId: identity.userId,
        rentalContractId: contractId,
        memberType: MemberType.co_tenant,
        isPrimaryContact: false,
        sharePercentage: body.sharePercentage,
        status: MemberStatus.active,
      },
    });

    await this.regenerateContractPdf(contractId);

    return this.findOne(contractId, currentUser);
  }

  async renewContract(
    contractId: string,
    renewDto: RenewContractDto,
    currentUser: JwtPayload,
  ) {
    await this.syncExpiredContractsByDate();

    const sourceContract = await this.prisma.rentalContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNumber: true,
        apartmentId: true,
        startDate: true,
        endDate: true,
        monthlyRent: true,
        depositAmount: true,
        paymentDueDay: true,
        paymentMethod: true,
        utilitiesIncluded: true,
        utilitiesCharges: true,
        contractTerms: true,
        specialConditions: true,
        landlordName: true,
        landlordIdNumber: true,
        landlordIdIssueDate: true,
        landlordAddress: true,
        landlordPhone: true,
        status: true,
        apartment: {
          select: {
            id: true,
            maxOccupants: true,
          },
        },
        members: {
          where: { status: MemberStatus.active },
          select: {
            userId: true,
            memberType: true,
            isPrimaryContact: true,
            sharePercentage: true,
          },
        },
      },
    });

    if (!sourceContract) {
      throw new NotFoundException('Contract not found');
    }

    if (currentUser.actorType !== 'user') {
      throw new UnauthorizedException('Only users can renew rental contracts');
    }

    const isMember = sourceContract.members.some(
      (member) => member.userId === currentUser.sub,
    );
    if (!isMember) {
      throw new NotFoundException('Contract not found');
    }

    if (
      sourceContract.status !== ContractStatus.active &&
      sourceContract.status !== ContractStatus.signed &&
      sourceContract.status !== ContractStatus.expired
    ) {
      throw new ConflictException(
        'Only active/signed/expired contracts can be renewed',
      );
    }

    if (!sourceContract.members.length) {
      throw new BadRequestException('Source contract has no active members');
    }

    if (!sourceContract.apartment?.id) {
      throw new NotFoundException('Apartment not found for source contract');
    }

    const remainingDays = this.getWholeDayDiff(sourceContract.endDate);
    if (remainingDays > this.contractRenewalWindowDays) {
      throw new BadRequestException(
        `Contract renewal is only allowed in the last ${this.contractRenewalWindowDays} days before the contract ends`,
      );
    }

    const occupancyLimit = sourceContract.apartment.maxOccupants ?? 0;
    if (occupancyLimit > 0 && sourceContract.members.length > occupancyLimit) {
      throw new BadRequestException(
        `Source contract exceeds max occupants (${occupancyLimit}) based on apartment max occupants`,
      );
    }

    const renewalOption = renewDto.renewalOption;
    if (!renewalOption) {
      throw new BadRequestException('renewalOption is required');
    }

    const autoStartDate = new Date(sourceContract.endDate);
    autoStartDate.setDate(autoStartDate.getDate() + 1);

    const nextStartDate = autoStartDate;

    let effectiveMonths = renewDto.extensionMonths ?? null;
    let normalizedMembers: Array<{
      userId: string;
      memberType: MemberType;
      isPrimaryContact: boolean;
      sharePercentage: Prisma.Decimal | number | null;
    }> = [];

    if (renewalOption === RenewalOption.KEEP_CURRENT) {
      if (
        renewDto.extensionMonths !== undefined ||
        (renewDto.memberNationalIds?.length ?? 0) > 0
      ) {
        throw new BadRequestException(
          'Do not provide extensionMonths or memberNationalIds when renewalOption is keep_current',
        );
      }

      effectiveMonths = this.getContractDurationMonthsInclusive(
        sourceContract.startDate,
        sourceContract.endDate,
      );

      normalizedMembers = sourceContract.members.map((member) => ({
        userId: member.userId,
        memberType: member.memberType,
        isPrimaryContact: member.isPrimaryContact,
        sharePercentage: member.sharePercentage,
      }));
    } else if (renewalOption === RenewalOption.CUSTOMIZE) {
      if (!renewDto.extensionMonths) {
        throw new BadRequestException(
          'extensionMonths is required when renewalOption is customize',
        );
      }

      effectiveMonths = renewDto.extensionMonths;
      normalizedMembers.push({
        userId: currentUser.sub,
        memberType: MemberType.primary,
        isPrimaryContact: true,
        sharePercentage: 100,
      });

      const trimmedNationalIds = (renewDto.memberNationalIds ?? [])
        .map((nationalId) => nationalId.trim())
        .filter(Boolean);

      const deduplicatedNationalIds = Array.from(new Set(trimmedNationalIds));
      if (deduplicatedNationalIds.length !== trimmedNationalIds.length) {
        throw new BadRequestException(
          'memberNationalIds contains duplicate CCCD numbers',
        );
      }

      for (const nationalId of deduplicatedNationalIds) {
        const identity = await this.prisma.userIdentity.findFirst({
          where: {
            nationalId,
            isVerified: true,
          },
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                isActive: true,
                isVerified: true,
              },
            },
          },
        });

        if (!identity || !identity.user.isActive || !identity.user.isVerified) {
          throw new BadRequestException(
            `No active verified user found for CCCD: ${nationalId}`,
          );
        }

        if (identity.userId === currentUser.sub) {
          throw new BadRequestException(
            `CCCD ${nationalId} belongs to the renewal requester and should not be repeated`,
          );
        }

        normalizedMembers.push({
          userId: identity.userId,
          memberType: MemberType.co_tenant,
          isPrimaryContact: false,
          sharePercentage: null,
        });
      }
    }

    if (!effectiveMonths) {
      throw new BadRequestException('Cannot determine extension months');
    }

    const nextEndDate = this.addMonthsKeepingContractDay(
      nextStartDate,
      effectiveMonths,
    );
    nextEndDate.setDate(nextEndDate.getDate() - 1);

    if (nextEndDate <= nextStartDate) {
      throw new BadRequestException('endDate must be after startDate');
    }

    await this.assertLeaseTermWithinCooperationContract(
      sourceContract.apartmentId,
      nextStartDate,
      nextEndDate,
    );

    if (occupancyLimit > 0 && normalizedMembers.length > occupancyLimit) {
      throw new BadRequestException(
        `Renewed contract can have at most ${occupancyLimit} members based on apartment max occupants`,
      );
    }

    const overlappingContract = await this.prisma.rentalContract.findFirst({
      where: {
        apartmentId: sourceContract.apartmentId,
        id: { not: sourceContract.id },
        status: {
          in: [
            ContractStatus.draft,
            ContractStatus.pending,
            ContractStatus.signed,
            ContractStatus.active,
          ],
        },
        startDate: { lte: nextEndDate },
        endDate: { gte: nextStartDate },
      },
      select: { id: true },
    });

    if (overlappingContract) {
      throw new ConflictException('Apartment has an overlapping contract');
    }

    const primaryMembers = normalizedMembers.filter(
      (member) => member.memberType === MemberType.primary,
    );
    if (primaryMembers.length !== 1) {
      throw new BadRequestException(
        'Renewed contract must have exactly one primary member',
      );
    }

    const primaryContacts = normalizedMembers.filter(
      (member) => member.isPrimaryContact,
    );
    if (primaryContacts.length > 1) {
      throw new BadRequestException(
        'Only one primary contact is allowed in renewed contract members',
      );
    }

    const primaryUserId = primaryMembers[0].userId;
    const primaryContactUserId = primaryContacts[0]?.userId;
    if (primaryContactUserId && primaryContactUserId !== primaryUserId) {
      throw new BadRequestException(
        'Primary contact must be the same user as primary member',
      );
    }

    const contractNumber = await this.generateContractNumber();
    const partyAFields = resolveContractPartyAFields({
      landlordName: sourceContract.landlordName,
      landlordIdNumber: sourceContract.landlordIdNumber,
      landlordIdIssueDate: sourceContract.landlordIdIssueDate,
      landlordAddress: sourceContract.landlordAddress,
      landlordPhone: sourceContract.landlordPhone,
    });

    const renewedContract = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rentalContract.create({
        data: {
          contractNumber,
          apartment: { connect: { id: sourceContract.apartmentId } },
          startDate: nextStartDate,
          endDate: nextEndDate,
          monthlyRent: sourceContract.monthlyRent,
          depositAmount: sourceContract.depositAmount,
          paymentDueDay: sourceContract.paymentDueDay,
          paymentMethod: sourceContract.paymentMethod,
          utilitiesIncluded: sourceContract.utilitiesIncluded as any,
          utilitiesCharges: sourceContract.utilitiesCharges as any,
          contractTerms: sourceContract.contractTerms,
          specialConditions: sourceContract.specialConditions,
          ...partyAFields,
          status: ContractStatus.draft,
          category: 'renewal',
          renewedFromContract: { connect: { id: sourceContract.id } },
        } as any,
        select: { id: true },
      });

      await tx.userContractMember.createMany({
        data: normalizedMembers.map((member) => ({
          userId: member.userId,
          rentalContractId: created.id,
          memberType: member.memberType,
          isPrimaryContact: member.isPrimaryContact,
          sharePercentage: member.sharePercentage,
          status: MemberStatus.active,
        })),
      });

      return created;
    });

    await this.regenerateContractPdf(renewedContract.id);

    const detail = await this.findOne(renewedContract.id, currentUser);

    return {
      sourceContractId: sourceContract.id,
      sourceContractNumber: sourceContract.contractNumber,
      extensionMonths: effectiveMonths,
      renewalOption,
      renewedContract: detail,
    };
  }

  private async generateContractNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.rentalContract.count({
      where: {
        contractNumber: { startsWith: `CTR-${year}` },
      },
    });
    return `CTR-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async createDepositInvoiceForSignedContract(contract: {
    id: string;
    contractNumber: string;
    startDate: Date;
    depositAmount: Prisma.Decimal;
    paymentMethod: PaymentMethodType;
    apartment: { depositAmount: Prisma.Decimal | null } | null;
  }) {
    const marker = `DEPOSIT_INVOICE_FOR_CONTRACT:${contract.id}`;

    const existingDepositInvoice = await this.prisma.invoice.findFirst({
      where: {
        rentalContractId: contract.id,
        notes: {
          contains: marker,
        },
      },
      select: this.depositInvoiceSelect,
    });

    if (existingDepositInvoice) {
      if (existingDepositInvoice.invoiceType === InvoiceType.deposit) {
        const updated = await this.prisma.invoice.update({
          where: { id: existingDepositInvoice.id },
          data: {
            invoiceType: InvoiceType.contractDeposit,
            depositDisposition: DepositDisposition.held,
          },
          select: this.depositInvoiceSelect,
        });
        return updated;
      }
      return existingDepositInvoice;
    }

    const apartmentDeposit = contract.apartment?.depositAmount
      ? Number(contract.apartment.depositAmount)
      : 0;
    const contractDeposit = Number(contract.depositAmount);
    const depositAmount =
      apartmentDeposit > 0 ? apartmentDeposit : contractDeposit;

    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      return null;
    }

    const invoiceNumber = await this.generateDepositInvoiceNumber();
    const now = new Date();
    const dueDate = this.resolveDepositInvoiceDueDate(contract.startDate, now);
    const depositCharge: Prisma.InputJsonArray = [
      {
        description: `Deposit for contract ${contract.contractNumber}`,
        amount: depositAmount,
        quantity: 1,
        itemType: 'contractDeposit',
      },
    ];
    const invoiceContent: Prisma.InputJsonObject = {
      title: `Deposit invoice for ${contract.contractNumber}`,
      description: 'Security deposit payment',
      items: depositCharge,
    };

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        rentalContract: { connect: { id: contract.id } },
        invoiceType: InvoiceType.contractDeposit,
        invoiceContent,
        billingPeriodStart: contract.startDate,
        billingPeriodEnd: contract.startDate,
        issueDate: now,
        dueDate,
        baseRent: 0,
        additionalCharges: depositCharge,
        totalAmount: depositAmount,
        paymentMethod: contract.paymentMethod,
        status: InvoiceStatus.issued,
        depositDisposition: DepositDisposition.held,
        notes: `Auto-created deposit invoice. ${marker}`,
      },
      select: this.depositInvoiceSelect,
    });
  }

  private async generateDepositInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `INV-DEP-${year}${month}`;
    const count = await this.prisma.invoice.count({
      where: {
        invoiceNumber: { startsWith: prefix },
      },
    });

    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }
}
