import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto, CreatePayOSPaymentLinkDto } from './dto';
import {
  InvoiceType,
  PaymentStatus,
  InvoiceStatus,
  ContractStatus,
  ApartmentStatus,
  UserApartmentStatus,
  ActorType,
  Prisma,
} from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PayOS } from '@payos/node';
import type {
  CreatePaymentLinkRequest,
  PaymentLinkItem,
  Webhook,
} from '@payos/node/lib/resources';
import {
  InvoiceContentPayload,
  InvoiceContentItem,
  PaymentInvoiceContent,
} from './types';

@Injectable()
export class PaymentsService {
  private readonly payosClient: PayOS | null;
  private readonly defaultPayOSReturnUrl: string;
  private readonly defaultPayOSCancelUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {
    const clientId = this.configService.get<string>('payos.clientId');
    const apiKey = this.configService.get<string>('payos.apiKey');
    const checksumKey = this.configService.get<string>('payos.checksumKey');
    const baseURL = this.configService.get<string>('payos.baseUrl');

    this.defaultPayOSReturnUrl =
      this.configService.get<string>('payos.returnUrl') ||
      'http://localhost:3000/payments/payos/success';
    this.defaultPayOSCancelUrl =
      this.configService.get<string>('payos.cancelUrl') ||
      'http://localhost:3000/payments/payos/cancel';

    this.payosClient =
      clientId && apiKey && checksumKey
        ? new PayOS({
            clientId,
            apiKey,
            checksumKey,
            ...(baseURL ? { baseURL } : {}),
          })
        : null;
  }

  async findAll(
    currentUser: JwtPayload,
    status?: PaymentStatus,
    invoiceId?: string,
  ) {
    const where: Prisma.PaymentWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (currentUser.actorType === 'user') {
      where.user = { id: currentUser.sub };
    }

    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    const payments = await this.prisma.payment.findMany({
      where,
      select: {
        id: true,
        paymentReference: true,
        amount: true,
        paymentMethod: true,
        status: true,
        paymentDate: true,
        createdAt: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paymentMethod: true,
            issueDate: true,
            createdAt: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also expose unpaid invoices as pending payment entries when no payment exists yet.
    const shouldIncludeSynthetic = !status || status === PaymentStatus.pending;
    if (!shouldIncludeSynthetic) {
      return payments;
    }

    const invoiceIdsWithPayments = new Set(payments.map((p) => p.invoice.id));
    const unpaidStatuses: InvoiceStatus[] = [
      InvoiceStatus.draft,
      InvoiceStatus.issued,
      InvoiceStatus.sent,
      InvoiceStatus.partially_paid,
      InvoiceStatus.overdue,
    ];

    const invoiceWhere: Prisma.InvoiceWhereInput = {
      status: { in: unpaidStatuses },
      ...(invoiceId ? { id: invoiceId } : {}),
      ...(currentUser.actorType === 'user'
        ? { rentalContract: { members: { some: { userId: currentUser.sub } } } }
        : {}),
    };

    const unpaidInvoices = await this.prisma.invoice.findMany({
      where: invoiceWhere,
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        paymentMethod: true,
        issueDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const syntheticPayments = unpaidInvoices
      .filter((invoice) => !invoiceIdsWithPayments.has(invoice.id))
      .map((invoice) => ({
        id: `invoice-pending-${invoice.id}`,
        paymentReference: `PENDING-${invoice.invoiceNumber}`,
        amount: invoice.totalAmount,
        paymentMethod: invoice.paymentMethod || 'bank_transfer',
        status: PaymentStatus.pending,
        paymentDate: invoice.issueDate,
        createdAt: invoice.createdAt,
        isSynthetic: true,
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount,
        },
      }));

    return [...payments, ...syntheticPayments].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  }

  async findByInvoiceId(
    invoiceId: string,
    currentUser: JwtPayload,
    status?: PaymentStatus,
  ) {
    return this.findAll(currentUser, status, invoiceId);
  }

  async findOne(id: string, currentUser: JwtPayload) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            rentalContract: {
              include: {
                members: {
                  include: {
                    user: { select: { id: true, fullName: true } },
                  },
                },
              },
            },
          },
        },
        user: { select: { id: true, fullName: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (currentUser.actorType === 'user') {
      const isMember = payment.invoice.rentalContract.members.some(
        (m) => m.user.id === currentUser.sub,
      );
      if (!isMember) {
        throw new NotFoundException('Payment not found');
      }
    }

    const { invoice, ...paymentData } = payment;
    return {
      ...paymentData,
      invoice: this.buildInvoiceContent(invoice),
    };
  }

  async create(createDto: CreatePaymentDto, currentUser: JwtPayload) {
    // Verify invoice
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: createDto.invoiceId },
      include: {
        rentalContract: {
          include: { members: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.paid) {
      throw new BadRequestException('Invoice already paid');
    }

    if (
      invoice.rentalContract.status !== ContractStatus.signed &&
      invoice.rentalContract.status !== ContractStatus.active
    ) {
      throw new BadRequestException(
        'Only signed or active contracts can receive payments',
      );
    }

    // User can only pay their own invoices
    if (currentUser.actorType === 'user') {
      const isMember = invoice.rentalContract.members.some(
        (m) => m.userId === currentUser.sub,
      );
      if (!isMember) {
        throw new NotFoundException('Invoice not found');
      }
    }

    const payerUserId = this.resolvePayerUserId(invoice, currentUser);

    // Generate payment reference
    const paymentReference =
      createDto.transactionReference ||
      `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const payment = await this.prisma.payment.create({
      data: {
        invoice: { connect: { id: createDto.invoiceId } },
        user: { connect: { id: payerUserId } },
        amount: createDto.amount,
        paymentMethod: createDto.paymentMethod,
        paymentReference,
        paymentDate: new Date(),
        notes: createDto.notes,
        status: PaymentStatus.pending,
      },
      select: {
        id: true,
        paymentReference: true,
        amount: true,
        status: true,
      },
    });

    return payment;
  }

  async confirm(id: string, transactionId?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            rentalContract: {
              select: {
                id: true,
                status: true,
                apartmentId: true,
                startDate: true,
                endDate: true,
                members: {
                  select: {
                    userId: true,
                    memberType: true,
                    isPrimaryContact: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.pending) {
      throw new BadRequestException('Payment already processed');
    }

    const txOperations: Prisma.PrismaPromise<any>[] = [
      this.prisma.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.completed,
          transactionId,
        },
      }),
      this.prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: InvoiceStatus.paid, paidAt: new Date() },
      }),
    ];

    const activationContext = this.appendContractActivationOperations(
      txOperations,
      payment.invoice.invoiceType,
      payment.invoice.invoiceNumber,
      payment.invoice.rentalContract,
    );

    const txResult = await this.prisma.$transaction(txOperations);

    if (
      activationContext.activated &&
      activationContext.apartmentDoorPassword &&
      activationContext.memberUserIds.length > 0
    ) {
      await this.notifyMembersApartmentPassword(
        activationContext.memberUserIds,
        activationContext.apartmentDoorPassword,
        payment.invoice.rentalContract.id,
        payment.invoice.invoiceNumber,
      );
    }

    return txResult;
  }

  async simulateSuccessByInvoice(
    invoiceId: string,
    currentUser: JwtPayload,
    transactionId?: string,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        rentalContract: {
          select: {
            id: true,
            status: true,
            apartmentId: true,
            startDate: true,
            endDate: true,
            members: {
              select: {
                userId: true,
                memberType: true,
                isPrimaryContact: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (currentUser.actorType === 'user') {
      const isMember = invoice.rentalContract.members.some(
        (m) => m.userId === currentUser.sub,
      );
      if (!isMember) {
        throw new NotFoundException('Invoice not found');
      }
    }

    if (
      invoice.rentalContract.status !== ContractStatus.signed &&
      invoice.rentalContract.status !== ContractStatus.active
    ) {
      throw new BadRequestException(
        'Only signed or active contracts can receive payments',
      );
    }

    if (invoice.status === InvoiceStatus.paid) {
      const existingCompleted = await this.prisma.payment.findFirst({
        where: {
          invoiceId,
          status: PaymentStatus.completed,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (existingCompleted) {
        return this.findOne(existingCompleted.id, currentUser);
      }

      throw new BadRequestException('Invoice already paid');
    }

    let payment = await this.prisma.payment.findFirst({
      where: {
        invoiceId,
        status: PaymentStatus.pending,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (!payment) {
      const processingPayment = await this.prisma.payment.findFirst({
        where: {
          invoiceId,
          status: PaymentStatus.processing,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (processingPayment) {
        payment = await this.prisma.payment.update({
          where: { id: processingPayment.id },
          data: {
            status: PaymentStatus.pending,
          },
          select: { id: true },
        });
      }
    }

    if (!payment) {
      const payerUserId = this.resolvePayerUserId(invoice, currentUser);
      const paymentReference = `MOCK-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

      payment = await this.prisma.payment.create({
        data: {
          invoice: { connect: { id: invoiceId } },
          user: { connect: { id: payerUserId } },
          amount: Number(invoice.totalAmount),
          currency: invoice.currency || 'VND',
          paymentMethod: invoice.paymentMethod || 'bank_transfer',
          paymentGateway: 'mock',
          paymentReference,
          paymentDate: new Date(),
          status: PaymentStatus.pending,
          notes: 'Simulated success payment (bypass PayOS)',
        },
        select: { id: true },
      });
    }

    const mockTransactionId = transactionId?.trim() || `MOCK-TX-${Date.now()}`;

    await this.confirm(payment.id, mockTransactionId);

    return this.findOne(payment.id, currentUser);
  }

  async fail(id: string, reason?: string) {
    return this.prisma.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.failed,
        notes: reason,
      },
    });
  }

  async createPayOSPayment(
    createDto: CreatePayOSPaymentLinkDto,
    currentUser: JwtPayload,
  ) {
    const payos = this.ensurePayOSConfigured();

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: createDto.invoiceId },
      include: {
        rentalContract: {
          include: {
            members: {
              include: {
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
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.paid) {
      throw new BadRequestException('Invoice already paid');
    }

    if (
      invoice.rentalContract.status !== ContractStatus.signed &&
      invoice.rentalContract.status !== ContractStatus.active
    ) {
      throw new BadRequestException(
        'Only signed or active contracts can receive payments',
      );
    }

    if (currentUser.actorType === 'user') {
      const isMember = invoice.rentalContract.members.some(
        (m) => m.userId === currentUser.sub,
      );
      if (!isMember) {
        throw new NotFoundException('Invoice not found');
      }
    }

    const amount = Number(invoice.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invoice amount is invalid for PayOS');
    }

    const invoiceContent = this.buildInvoiceContent(invoice);

    const orderCode = this.generatePayOSOrderCode();
    const paymentReference = `PAYOS-${orderCode}`;
    const payerUserId = this.resolvePayerUserId(invoice, currentUser);
    const primaryMember = invoice.rentalContract.members.find(
      (m) => m.memberType === 'primary',
    );

    const createPayment = await this.prisma.payment.create({
      data: {
        invoice: { connect: { id: invoice.id } },
        user: { connect: { id: payerUserId } },
        amount,
        currency: invoice.currency || 'VND',
        paymentMethod: invoice.paymentMethod || 'bank_transfer',
        paymentGateway: 'payos',
        paymentReference,
        paymentDate: new Date(),
        status: PaymentStatus.processing,
        notes: `PayOS orderCode: ${orderCode}`,
      },
      select: {
        id: true,
        invoiceId: true,
        paymentReference: true,
      },
    });

    const description = this.buildPayOSDescription(
      createDto.description,
      invoice.invoiceNumber,
    );

    const payload: CreatePaymentLinkRequest = {
      orderCode,
      amount: Math.round(amount),
      description,
      returnUrl: createDto.returnUrl || this.defaultPayOSReturnUrl,
      cancelUrl: createDto.cancelUrl || this.defaultPayOSCancelUrl,
      items: this.buildPayOSItems(invoiceContent),
      buyerName: primaryMember?.user.fullName || undefined,
      buyerEmail: primaryMember?.user.email || undefined,
      buyerPhone: primaryMember?.user.phone || undefined,
    };

    try {
      const paymentLink = await payos.paymentRequests.create(payload);

      await this.prisma.payment.update({
        where: { id: createPayment.id },
        data: {
          transactionId: paymentLink.paymentLinkId,
          status: PaymentStatus.pending,
          notes: `PayOS orderCode: ${orderCode}; paymentLinkId: ${paymentLink.paymentLinkId}`,
        },
      });

      return {
        paymentId: createPayment.id,
        invoiceId: createPayment.invoiceId,
        paymentReference: createPayment.paymentReference,
        orderCode: paymentLink.orderCode,
        status: paymentLink.status,
        checkoutUrl: paymentLink.checkoutUrl,
        qrCode: paymentLink.qrCode,
        expiredAt: paymentLink.expiredAt ?? null,
        invoice: invoiceContent,
      };
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: createPayment.id },
        data: {
          status: PaymentStatus.failed,
          notes: `PayOS create link failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        },
      });

      throw new BadRequestException(
        `Create PayOS payment link failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async handlePayOSWebhook(webhookData: Webhook) {
    const payos = this.ensurePayOSConfigured();

    let verifiedData;
    try {
      verifiedData = await payos.webhooks.verify(webhookData);
    } catch {
      throw new BadRequestException('Invalid PayOS webhook signature');
    }

    const paymentReference = `PAYOS-${verifiedData.orderCode}`;
    const payment = await this.prisma.payment.findFirst({
      where: {
        paymentReference,
        paymentGateway: 'payos',
      },
      include: {
        invoice: {
          include: {
            rentalContract: {
              select: {
                id: true,
                status: true,
                apartmentId: true,
                startDate: true,
                endDate: true,
                members: {
                  select: {
                    userId: true,
                    memberType: true,
                    isPrimaryContact: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return {
        received: true,
        processed: false,
        reason: 'payment_not_found',
      };
    }

    const isSuccess = verifiedData.code === '00';

    if (isSuccess) {
      if (payment.status === PaymentStatus.completed) {
        return {
          received: true,
          processed: true,
          paymentId: payment.id,
          status: payment.status,
        };
      }

      const txOperations: Prisma.PrismaPromise<any>[] = [
        this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.completed,
            transactionId: verifiedData.reference || payment.transactionId,
            paymentDate: verifiedData.transactionDateTime
              ? new Date(verifiedData.transactionDateTime)
              : new Date(),
            bankName: verifiedData.counterAccountBankName || payment.bankName,
            accountNumber:
              verifiedData.counterAccountNumber || payment.accountNumber,
            notes: [
              payment.notes,
              `PayOS webhook code: ${verifiedData.code}`,
              `PayOS desc: ${verifiedData.desc}`,
            ]
              .filter(Boolean)
              .join(' | '),
          },
        }),
        this.prisma.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            status: InvoiceStatus.paid,
            paidAt: new Date(),
          },
        }),
      ];

      const activationContext = this.appendContractActivationOperations(
        txOperations,
        payment.invoice.invoiceType,
        payment.invoice.invoiceNumber,
        payment.invoice.rentalContract,
      );

      await this.prisma.$transaction(txOperations);

      if (
        activationContext.activated &&
        activationContext.apartmentDoorPassword &&
        activationContext.memberUserIds.length > 0
      ) {
        await this.notifyMembersApartmentPassword(
          activationContext.memberUserIds,
          activationContext.apartmentDoorPassword,
          payment.invoice.rentalContract.id,
          payment.invoice.invoiceNumber,
        );
      }

      return {
        received: true,
        processed: true,
        paymentId: payment.id,
        status: PaymentStatus.completed,
      };
    }

    if (
      payment.status === PaymentStatus.pending ||
      payment.status === PaymentStatus.processing
    ) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.failed,
          notes: [
            payment.notes,
            `PayOS webhook code: ${verifiedData.code}`,
            `PayOS desc: ${verifiedData.desc}`,
          ]
            .filter(Boolean)
            .join(' | '),
        },
      });
    }

    return {
      received: true,
      processed: true,
      paymentId: payment.id,
      status: PaymentStatus.failed,
    };
  }

  private ensurePayOSConfigured(): PayOS {
    if (!this.payosClient) {
      throw new BadRequestException(
        'PayOS is not configured. Please set PAYOS_CLIENT_ID, PAYOS_API_KEY and PAYOS_CHECKSUM_KEY.',
      );
    }
    return this.payosClient;
  }

  private isDepositInvoiceType(invoiceType: InvoiceType): boolean {
    return (
      invoiceType === InvoiceType.deposit ||
      invoiceType === InvoiceType.contractDeposit
    );
  }

  private generateSixDigitPassword(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private getUtcDayStart(date = new Date()): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private appendContractActivationOperations(
    txOperations: Prisma.PrismaPromise<any>[],
    invoiceType: InvoiceType,
    invoiceNumber: string,
    rentalContract: {
      id: string;
      status: ContractStatus;
      apartmentId: string;
      startDate: Date;
      endDate: Date;
      members: Array<{
        userId: string;
        memberType: string;
        isPrimaryContact: boolean;
      }>;
    },
  ): {
    activated: boolean;
    apartmentDoorPassword: string | null;
    memberUserIds: string[];
  } {
    if (
      rentalContract.status !== ContractStatus.signed ||
      !this.isDepositInvoiceType(invoiceType)
    ) {
      return {
        activated: false,
        apartmentDoorPassword: null,
        memberUserIds: [],
      };
    }

    const members = rentalContract.members ?? [];

    const buildUserApartmentUpserts = (
      status: UserApartmentStatus,
      apartmentDoorPassword: string | null,
    ): Prisma.PrismaPromise<any>[] =>
      members.map((member) =>
        this.prisma.userApartment.upsert({
          where: {
            userId_apartmentId_rentalContractId: {
              userId: member.userId,
              apartmentId: rentalContract.apartmentId,
              rentalContractId: rentalContract.id,
            },
          },
          create: {
            user: { connect: { id: member.userId } },
            apartment: {
              connect: { id: rentalContract.apartmentId },
            },
            rentalContract: {
              connect: { id: rentalContract.id },
            },
            moveInDate: rentalContract.startDate,
            apartmentDoorPassword,
            isPrimaryTenant:
              member.memberType === 'primary' || member.isPrimaryContact,
            status,
          },
          update: {
            moveInDate: rentalContract.startDate,
            moveOutDate: null,
            apartmentDoorPassword,
            isPrimaryTenant:
              member.memberType === 'primary' || member.isPrimaryContact,
            status,
          },
        }),
      );

    const todayStart = this.getUtcDayStart();

    if (rentalContract.startDate > todayStart) {
      txOperations.push(
        ...buildUserApartmentUpserts(UserApartmentStatus.inactive, null),
      );

      return {
        activated: false,
        apartmentDoorPassword: null,
        memberUserIds: members.map((member) => member.userId),
      };
    }

    if (rentalContract.endDate < todayStart) {
      txOperations.push(
        this.prisma.rentalContract.update({
          where: { id: rentalContract.id },
          data: { status: ContractStatus.expired },
        }),
      );

      return {
        activated: false,
        apartmentDoorPassword: null,
        memberUserIds: [],
      };
    }

    const apartmentDoorPassword = this.generateSixDigitPassword();

    txOperations.push(
      this.prisma.rentalContract.update({
        where: { id: rentalContract.id },
        data: { status: ContractStatus.active },
      }),
    );

    txOperations.push(
      this.prisma.apartment.update({
        where: { id: rentalContract.apartmentId },
        data: { status: ApartmentStatus.occupied },
      }),
    );

    txOperations.push(
      ...buildUserApartmentUpserts(
        UserApartmentStatus.active,
        apartmentDoorPassword,
      ),
    );

    return {
      activated: true,
      apartmentDoorPassword,
      memberUserIds: members.map((member) => member.userId),
    };
  }

  private async notifyMembersApartmentPassword(
    memberUserIds: string[],
    apartmentDoorPassword: string,
    rentalContractId: string,
    invoiceNumber: string,
  ): Promise<void> {
    await Promise.allSettled(
      memberUserIds.map((memberUserId) =>
        this.notificationsService.createAndPush({
          recipientType: ActorType.user,
          recipientId: memberUserId,
          notificationType: 'info',
          channel: 'in_app',
          title: 'Kích hoạt hợp đồng thành công',
          message: `Hóa đơn đặt cọc ${invoiceNumber} đã thanh toán thành công. Mật khẩu cửa nhà: ${apartmentDoorPassword}`,
          actionUrl: `/contracts/${rentalContractId}`,
          actionLabel: 'Xem hợp đồng',
          priority: 'high',
          relatedEntityType: 'RentalContract',
          relatedEntityId: rentalContractId,
        }),
      ),
    );
  }

  private resolvePayerUserId(
    invoice: {
      rentalContract: {
        members: Array<{ userId: string; memberType?: string | null }>;
      };
    },
    currentUser: JwtPayload,
  ): string {
    if (currentUser.actorType === 'user') {
      return currentUser.sub;
    }

    const primary = invoice.rentalContract.members.find(
      (member) => member.memberType === 'primary',
    );
    if (primary?.userId) {
      return primary.userId;
    }

    const firstMember = invoice.rentalContract.members[0];
    if (firstMember?.userId) {
      return firstMember.userId;
    }

    throw new BadRequestException('Invoice has no tenant to attach payment');
  }

  private generatePayOSOrderCode(): number {
    const timePart = Date.now().toString().slice(-10);
    const randomPart = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return Number(`${timePart}${randomPart}`);
  }

  private buildPayOSDescription(
    customDescription: string | undefined,
    invoiceNumber: string,
  ): string {
    const base = (customDescription || `Thanh toan ${invoiceNumber}`).trim();
    return base.length <= 25 ? base : base.slice(0, 25);
  }

  private buildPayOSItems(
    invoiceContent: PaymentInvoiceContent,
  ): PaymentLinkItem[] {
    if (invoiceContent.items.length > 0) {
      return invoiceContent.items.slice(0, 10).map((item) => ({
        name: this.toPayOSItemName(item.description),
        quantity: item.quantity > 0 ? item.quantity : 1,
        price: Math.round(item.amount),
      }));
    }

    return [
      {
        name: this.toPayOSItemName(`Hoa don ${invoiceContent.invoiceNumber}`),
        quantity: 1,
        price: Math.round(invoiceContent.totalAmount),
      },
    ];
  }

  private toPayOSItemName(name: string): string {
    const normalized = name.trim();
    if (!normalized) {
      return 'Thanh toan';
    }
    return normalized.length <= 80 ? normalized : normalized.slice(0, 80);
  }

  private buildInvoiceContent(invoice: {
    id: string;
    invoiceNumber: string;
    invoiceType?: InvoiceType;
    invoiceContent?: Prisma.JsonValue | null;
    currency: string;
    baseRent: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    additionalCharges?: Prisma.JsonValue | null;
    utilityCharges?: Prisma.JsonValue | null;
  }): PaymentInvoiceContent {
    const parsedContent = this.parseInvoiceContentPayload(
      invoice.invoiceContent,
    );
    const parsedItems = parsedContent?.items ?? [];
    const items =
      parsedItems.length > 0
        ? parsedItems
        : [
            ...this.parseInvoiceItems(invoice.additionalCharges),
            ...this.parseInvoiceItems(invoice.utilityCharges),
          ];

    if (Number(invoice.baseRent) > 0) {
      items.unshift({
        description: 'Base rent',
        amount: Number(invoice.baseRent),
        quantity: 1,
        itemType: 'rent',
      });
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceType: invoice.invoiceType || InvoiceType.other,
      currency: invoice.currency || 'VND',
      baseRent: Number(invoice.baseRent || 0),
      taxAmount: Number(invoice.taxAmount || 0),
      totalAmount: Number(invoice.totalAmount || 0),
      items,
      content: {
        title: parsedContent?.title || `Invoice ${invoice.invoiceNumber}`,
        description:
          parsedContent?.description ||
          `Type: ${invoice.invoiceType || InvoiceType.other}`,
        items,
      },
    };
  }

  private parseInvoiceContentPayload(
    data: Prisma.JsonValue | null | undefined,
  ): InvoiceContentPayload | null {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return null;
    }

    const obj = data as Record<string, unknown>;
    const items = this.parseInvoiceItems(obj.items as Prisma.JsonValue);

    return {
      title:
        typeof obj.title === 'string' && obj.title.trim().length > 0
          ? obj.title.trim()
          : null,
      description:
        typeof obj.description === 'string' && obj.description.trim().length > 0
          ? obj.description.trim()
          : null,
      items,
    };
  }

  private parseInvoiceItems(
    data: Prisma.JsonValue | null | undefined,
  ): InvoiceContentItem[] {
    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data
      .map((raw): InvoiceContentItem | null => {
        if (!raw || typeof raw !== 'object') {
          return null;
        }

        const entry = raw as Record<string, unknown>;
        const description =
          typeof entry.description === 'string' &&
          entry.description.trim().length > 0
            ? entry.description.trim()
            : 'Invoice item';
        const amount =
          typeof entry.amount === 'number'
            ? entry.amount
            : Number(entry.amount ?? 0);
        const quantity =
          typeof entry.quantity === 'number'
            ? entry.quantity
            : Number(entry.quantity ?? 1);
        const itemType =
          typeof entry.itemType === 'string' && entry.itemType.trim().length > 0
            ? entry.itemType.trim()
            : 'other';

        if (!Number.isFinite(amount) || amount <= 0) {
          return null;
        }

        return {
          description,
          amount,
          quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          itemType,
        };
      })
      .filter((item): item is InvoiceContentItem => item !== null);
  }
}
