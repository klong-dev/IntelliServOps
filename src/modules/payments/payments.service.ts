import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto';
import { PaymentStatus, InvoiceStatus, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: JwtPayload, status?: PaymentStatus) {
    const where: Prisma.PaymentWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (currentUser.actorType === 'user') {
      where.user = { id: currentUser.sub };
    }

    return this.prisma.payment.findMany({
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
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
        m => m.user.id === currentUser.sub,
      );
      if (!isMember) {
        throw new NotFoundException('Payment not found');
      }
    }

    return payment;
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

    // User can only pay their own invoices
    if (currentUser.actorType === 'user') {
      const isMember = invoice.rentalContract.members.some(
        m => m.userId === currentUser.sub,
      );
      if (!isMember) {
        throw new NotFoundException('Invoice not found');
      }
    }

    // Generate payment reference
    const paymentReference = createDto.transactionReference ||
      `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const payment = await this.prisma.payment.create({
      data: {
        invoice: { connect: { id: createDto.invoiceId } },
        user: { connect: { id: currentUser.sub } },
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
      include: { invoice: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.pending) {
      throw new BadRequestException('Payment already processed');
    }

    // Update payment and invoice in transaction
    return this.prisma.$transaction([
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
    ]);
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

  // PayOS integration stub
  async createPayOSPayment(invoiceId: string, _amount: number) {
    return {
      message: 'PayOS integration not yet implemented',
      invoiceId,
      checkoutUrl: null,
    };
  }

  async handlePayOSWebhook(_webhookData: any) {
    return { received: true };
  }
}
