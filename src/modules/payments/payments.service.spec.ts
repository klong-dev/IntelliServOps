import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, mockUserJwtPayload, mockAdminJwtPayload } from '../../test-utils';
import { CreatePaymentDto } from './dto';
import { PaymentStatus, InvoiceStatus } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const mockPayment = (overrides = {}) => ({
    id: 'payment-123',
    paymentReference: 'PAY-123456',
    invoiceId: 'invoice-123',
    userId: 'user-123',
    amount: 10000000,
    paymentMethod: 'bank_transfer',
    status: PaymentStatus.pending,
    paymentDate: new Date(),
    createdAt: new Date(),
    ...overrides,
  });

  const mockInvoice = (overrides = {}) => ({
    id: 'invoice-123',
    invoiceNumber: 'INV-2026-00001',
    totalAmount: 10000000,
    status: InvoiceStatus.issued,
    rentalContract: {
      members: [{ userId: 'user-123' }],
    },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all payments for admin', async () => {
      const admin = mockAdminJwtPayload();
      const payments = [mockPayment()];
      prisma.payment.findMany.mockResolvedValue(payments as any);

      const result = await service.findAll(admin);

      expect(result).toEqual(payments);
    });

    it('should filter user own payments', async () => {
      const user = mockUserJwtPayload();
      prisma.payment.findMany.mockResolvedValue([]);

      await service.findAll(user);

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user: { id: user.sub } },
        })
      );
    });

    it('should filter by status', async () => {
      const admin = mockAdminJwtPayload();
      prisma.payment.findMany.mockResolvedValue([]);

      await service.findAll(admin, PaymentStatus.completed);

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: PaymentStatus.completed },
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return payment by ID', async () => {
      const admin = mockAdminJwtPayload();
      const payment = {
        ...mockPayment(),
        invoice: mockInvoice(),
      };
      prisma.payment.findUnique.mockResolvedValue(payment as any);

      const result = await service.findOne('payment-123', admin);

      expect(result).toEqual(payment);
    });

    it('should throw NotFoundException if not found', async () => {
      const admin = mockAdminJwtPayload();
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent', admin)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user not member', async () => {
      const user = mockUserJwtPayload();
      const payment = {
        ...mockPayment(),
        invoice: {
          ...mockInvoice(),
          rentalContract: { members: [{ user: { id: 'other-user' } }] },
        },
      };
      prisma.payment.findUnique.mockResolvedValue(payment as any);

      await expect(service.findOne('payment-123', user)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto: CreatePaymentDto = {
      invoiceId: 'invoice-123',
      amount: 10000000,
      paymentMethod: 'bank_transfer' as any,
    };

    it('should create payment', async () => {
      const user = mockUserJwtPayload();
      const invoice = mockInvoice();
      const created = mockPayment();

      prisma.invoice.findUnique.mockResolvedValue(invoice as any);
      prisma.payment.create.mockResolvedValue(created as any);

      const result = await service.create(createDto, user);

      expect(result).toEqual(created);
    });

    it('should throw NotFoundException if invoice not found', async () => {
      const user = mockUserJwtPayload();
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, user)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if invoice already paid', async () => {
      const user = mockUserJwtPayload();
      const paidInvoice = mockInvoice({ status: InvoiceStatus.paid });
      prisma.invoice.findUnique.mockResolvedValue(paidInvoice as any);

      await expect(service.create(createDto, user)).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirm', () => {
    it('should confirm pending payment', async () => {
      const payment = mockPayment();
      const confirmed = { ...payment, status: PaymentStatus.completed };

      prisma.payment.findUnique.mockResolvedValue({ ...payment, invoice: mockInvoice() } as any);
      prisma.$transaction.mockResolvedValue([confirmed, {}] as any);

      const result = await service.confirm('payment-123', 'tx-123');

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.confirm('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if already processed', async () => {
      const payment = mockPayment({ status: PaymentStatus.completed });
      prisma.payment.findUnique.mockResolvedValue({ ...payment, invoice: mockInvoice() } as any);

      await expect(service.confirm('payment-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('fail', () => {
    it('should mark payment as failed', async () => {
      const failed = mockPayment({ status: PaymentStatus.failed });
      prisma.payment.update.mockResolvedValue(failed as any);

      const result = await service.fail('payment-123', 'Insufficient funds');

      expect(result.status).toBe(PaymentStatus.failed);
    });
  });

  describe('PayOS integration', () => {
    it('should return stub for createPayOSPayment', async () => {
      const result = await service.createPayOSPayment('invoice-123', 10000000);

      expect(result.message).toContain('not yet implemented');
    });

    it('should handle webhook', async () => {
      const result = await service.handlePayOSWebhook({});

      expect(result.received).toBe(true);
    });
  });
});
