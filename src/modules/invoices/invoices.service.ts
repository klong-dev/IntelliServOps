import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto';
import { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: JwtPayload, status?: InvoiceStatus) {
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

    return this.prisma.invoice.findMany({
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
          select: {
            id: true,
            contractNumber: true,
            apartment: {
              select: {
                apartmentNumber: true,
                wardCode: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, currentUser: JwtPayload) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        rentalContract: {
          include: {
            apartment: {
              select: {
                apartmentNumber: true,
                wardCode: true,
              },
            },
            members: {
              include: {
                user: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
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

    return invoice;
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
          in: [InvoiceStatus.draft, InvoiceStatus.issued, InvoiceStatus.sent],
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
