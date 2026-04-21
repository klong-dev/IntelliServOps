import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  createPrismaMock,
  mockUserJwtPayload,
  mockAdminJwtPayload,
} from '../../test-utils';
import { CreatePaymentDto } from './dto';
import {
  PaymentStatus,
  InvoiceStatus,
  ContractStatus,
  InvoiceType,
  UserApartmentStatus,
} from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoTService } from '../iot/iot.service';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let configService: { get: jest.Mock };
  const ioTService = {
    syncApartmentDoorPin: jest.fn(),
  };
  const storageService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
    getPublicUrl: jest.fn(),
  };
  const notificationsService = {
    createAndPush: jest.fn(),
  };

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
    invoice: {
      id: 'invoice-123',
      invoiceNumber: 'INV-2026-00001',
      totalAmount: 10000000,
      paymentMethod: 'bank_transfer',
      issueDate: new Date(),
      createdAt: new Date(),
      status: InvoiceStatus.issued,
    },
    ...overrides,
  });

  const mockInvoice = (overrides = {}) => ({
    id: 'invoice-123',
    invoiceNumber: 'INV-2026-00001',
    invoiceType: InvoiceType.contractDeposit,
    totalAmount: 10000000,
    status: InvoiceStatus.issued,
    rentalContract: {
      id: 'contract-123',
      status: ContractStatus.signed,
      apartmentId: 'apt-123',
      apartment: {
        apartmentNumber: 'A-101',
        buildingName: 'Vinhomes Grand Park',
      },
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      members: [{ userId: 'user-123' }],
    },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();
    configService = {
      get: jest.fn().mockReturnValue(undefined),
    };
    ioTService.syncApartmentDoorPin.mockResolvedValue({
      success: true,
      skipped: false,
      boardId: 'ESP_A101',
      deviceId: 1,
      message: 'Door PIN synced to board successfully.',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
        { provide: IoTService, useValue: ioTService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: SupabaseStorageService, useValue: storageService },
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
      prisma.invoice.findMany.mockResolvedValue([] as any);

      const result = await service.findAll(admin);

      expect(result.items).toEqual(payments);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter user own payments', async () => {
      const user = mockUserJwtPayload();
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.invoice.findMany.mockResolvedValue([] as any);

      await service.findAll(user);

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user: { id: user.sub } },
        }),
      );
    });

    it('should filter by status', async () => {
      const admin = mockAdminJwtPayload();
      prisma.payment.findMany.mockResolvedValue([]);

      await service.findAll(admin, { status: PaymentStatus.completed });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: PaymentStatus.completed },
        }),
      );
    });

    it('should include synthetic pending payment for unpaid invoice without payment record', async () => {
      const admin = mockAdminJwtPayload();
      prisma.payment.findMany.mockResolvedValue([] as any);
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'invoice-999',
          invoiceNumber: 'INV-2026-00999',
          totalAmount: 15000000,
          paymentMethod: 'bank_transfer',
          issueDate: new Date('2026-03-01'),
          createdAt: new Date('2026-03-01'),
        },
      ] as any);

      const result = await service.findAll(admin, {
        status: PaymentStatus.pending,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        id: 'invoice-pending-invoice-999',
        status: PaymentStatus.pending,
        isSynthetic: true,
      });
    });

    it('should filter payments by invoiceId', async () => {
      const admin = mockAdminJwtPayload();
      prisma.payment.findMany.mockResolvedValue([] as any);
      prisma.invoice.findMany.mockResolvedValue([] as any);

      await service.findAll(admin, { invoiceId: 'invoice-123' });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ invoiceId: 'invoice-123' }),
        }),
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

      expect(result).toMatchObject({
        id: payment.id,
        paymentReference: payment.paymentReference,
        invoice: {
          invoiceId: 'invoice-123',
          invoiceNumber: 'INV-2026-00001',
          totalAmount: 10000000,
        },
      });
    });

    it('should throw NotFoundException if not found', async () => {
      const admin = mockAdminJwtPayload();
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent', admin)).rejects.toThrow(
        NotFoundException,
      );
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

      await expect(service.findOne('payment-123', user)).rejects.toThrow(
        NotFoundException,
      );
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

      await expect(service.create(createDto, user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if invoice already paid', async () => {
      const user = mockUserJwtPayload();
      const paidInvoice = mockInvoice({ status: InvoiceStatus.paid });
      prisma.invoice.findUnique.mockResolvedValue(paidInvoice as any);

      await expect(service.create(createDto, user)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if contract is not signed or active', async () => {
      const user = mockUserJwtPayload();
      const draftInvoice = mockInvoice({
        rentalContract: {
          id: 'contract-123',
          status: ContractStatus.draft,
          apartmentId: 'apt-123',
          members: [{ userId: 'user-123' }],
        },
      });
      prisma.invoice.findUnique.mockResolvedValue(draftInvoice as any);

      await expect(service.create(createDto, user)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('confirm', () => {
    it('should confirm pending payment', async () => {
      const payment = mockPayment();
      const confirmed = { ...payment, status: PaymentStatus.completed };

      prisma.payment.findUnique.mockResolvedValue({
        ...payment,
        invoice: mockInvoice(),
      } as any);
      prisma.$transaction.mockResolvedValue([confirmed, {}] as any);

      const result = await service.confirm('payment-123', 'tx-123');

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);

      await expect(service.confirm('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if already processed', async () => {
      const payment = mockPayment({ status: PaymentStatus.completed });
      prisma.payment.findUnique.mockResolvedValue({
        ...payment,
        invoice: mockInvoice(),
      } as any);

      await expect(service.confirm('payment-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should activate signed contract and occupy apartment on successful payment', async () => {
      const payment = mockPayment({ status: PaymentStatus.pending });

      prisma.payment.findUnique.mockResolvedValue({
        ...payment,
        invoice: mockInvoice({
          rentalContract: {
            id: 'contract-123',
            status: ContractStatus.signed,
            apartmentId: 'apt-123',
            apartment: {
              apartmentNumber: 'A-101',
              buildingName: 'Vinhomes Grand Park',
            },
            members: [{ userId: 'user-123' }],
          },
        }),
      } as any);
      prisma.$transaction.mockResolvedValue([] as any);

      await service.confirm('payment-123', 'tx-123');

      expect(prisma.rentalContract.update).toHaveBeenCalledWith({
        where: { id: 'contract-123' },
        data: { status: ContractStatus.active },
      });
      expect(prisma.apartment.update).toHaveBeenCalledWith({
        where: { id: 'apt-123' },
        data: { status: 'occupied' },
      });
      expect(prisma.userApartment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            apartmentDoorPassword: expect.stringMatching(/^\d{6}$/),
          }),
          update: expect.objectContaining({
            apartmentDoorPassword: expect.stringMatching(/^\d{6}$/),
          }),
        }),
      );
      expect(notificationsService.createAndPush).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientType: 'user',
          recipientId: 'user-123',
          notificationType: 'success',
          channel: 'push',
          title: 'Thanh toán thành công',
          message: expect.stringContaining(
            'Thông tin căn hộ: A-101 - Vinhomes Grand Park.',
          ),
        }),
      );
      expect(notificationsService.createAndPush).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/\d{6}/),
        }),
      );
      expect(ioTService.syncApartmentDoorPin).toHaveBeenCalledWith(
        'apt-123',
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('should not activate contract for non-deposit invoice type', async () => {
      const payment = mockPayment({ status: PaymentStatus.pending });

      prisma.payment.findUnique.mockResolvedValue({
        ...payment,
        invoice: mockInvoice({
          invoiceType: InvoiceType.monthlyRent,
          rentalContract: {
            id: 'contract-123',
            status: ContractStatus.signed,
            apartmentId: 'apt-123',
            members: [{ userId: 'user-123' }],
          },
        }),
      } as any);
      prisma.$transaction.mockResolvedValue([] as any);

      await service.confirm('payment-123', 'tx-123');

      expect(prisma.rentalContract.update).not.toHaveBeenCalled();
      expect(prisma.userApartment.upsert).not.toHaveBeenCalled();
    });

    it('should keep contract pending activation but create active userApartment with password before startDate', async () => {
      const payment = mockPayment({ status: PaymentStatus.pending });

      prisma.payment.findUnique.mockResolvedValue({
        ...payment,
        invoice: mockInvoice({
          rentalContract: {
            id: 'contract-123',
            status: ContractStatus.signed,
            apartmentId: 'apt-123',
            startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            apartment: {
              apartmentNumber: 'A-101',
              buildingName: 'Vinhomes Grand Park',
            },
            members: [{ userId: 'user-123' }],
          },
        }),
      } as any);
      prisma.$transaction.mockResolvedValue([] as any);

      await service.confirm('payment-123', 'tx-123');

      expect(prisma.rentalContract.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'contract-123' },
          data: { status: ContractStatus.active },
        }),
      );
      expect(prisma.apartment.update).not.toHaveBeenCalled();
      expect(prisma.userApartment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: UserApartmentStatus.active,
            apartmentDoorPassword: expect.stringMatching(/^\d{6}$/),
          }),
          update: expect.objectContaining({
            status: UserApartmentStatus.active,
            apartmentDoorPassword: expect.stringMatching(/^\d{6}$/),
          }),
        }),
      );
      expect(notificationsService.createAndPush).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientType: 'user',
          recipientId: 'user-123',
          notificationType: 'success',
          channel: 'push',
          title: 'Thanh toán thành công',
          message: expect.stringContaining(
            'Thông tin căn hộ: A-101 - Vinhomes Grand Park.',
          ),
        }),
      );
      expect(notificationsService.createAndPush).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/\d{6}/),
        }),
      );
      expect(ioTService.syncApartmentDoorPin).toHaveBeenCalledWith(
        'apt-123',
        expect.stringMatching(/^\d{6}$/),
      );
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

  describe('simulateSuccessByInvoice', () => {
    it('should create mock pending payment and mark it successful', async () => {
      const user = mockUserJwtPayload();
      const invoice = mockInvoice({
        status: InvoiceStatus.issued,
        currency: 'VND',
        paymentMethod: 'bank_transfer',
      });

      prisma.invoice.findUnique.mockResolvedValue(invoice as any);
      prisma.payment.findFirst
        .mockResolvedValueOnce(null as any)
        .mockResolvedValueOnce(null as any);
      prisma.payment.create.mockResolvedValue({ id: 'payment-123' } as any);

      const confirmSpy = jest
        .spyOn(service, 'confirm')
        .mockResolvedValue([] as any);
      const findOneSpy = jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 'payment-123',
        status: PaymentStatus.completed,
      } as any);

      const result = await service.simulateSuccessByInvoice(
        'invoice-123',
        user,
      );

      expect(confirmSpy).toHaveBeenCalledWith(
        'payment-123',
        expect.stringContaining('MOCK-TX-'),
      );
      expect(findOneSpy).toHaveBeenCalledWith('payment-123', user);
      expect(result).toMatchObject({
        id: 'payment-123',
        status: PaymentStatus.completed,
      });
    });

    it('should return existing completed payment when invoice already paid', async () => {
      const user = mockUserJwtPayload();
      const paidInvoice = mockInvoice({ status: InvoiceStatus.paid });

      prisma.invoice.findUnique.mockResolvedValue(paidInvoice as any);
      prisma.payment.findFirst.mockResolvedValue({ id: 'payment-999' } as any);

      const findOneSpy = jest.spyOn(service, 'findOne').mockResolvedValue({
        id: 'payment-999',
        status: PaymentStatus.completed,
      } as any);

      const result = await service.simulateSuccessByInvoice(
        'invoice-123',
        user,
      );

      expect(findOneSpy).toHaveBeenCalledWith('payment-999', user);
      expect(result).toMatchObject({ id: 'payment-999' });
    });
  });

  describe('PayOS integration', () => {
    it('should throw when PayOS is not configured while creating link', async () => {
      const user = mockUserJwtPayload();

      await expect(
        service.createPayOSPayment({ invoiceId: 'invoice-123' }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('should retry with a new orderCode when PayOS reports duplicate order', async () => {
      const user = mockUserJwtPayload();
      const invoice = mockInvoice({
        currency: 'VND',
        paymentMethod: 'bank_transfer',
        baseRent: 0,
        taxAmount: 0,
        rentalContract: {
          id: 'contract-123',
          status: ContractStatus.signed,
          apartmentId: 'apt-123',
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          members: [
            {
              userId: 'user-123',
              memberType: 'primary',
              isPrimaryContact: true,
              user: {
                fullName: 'Nguyen Van A',
                email: 'tenant@example.com',
                phone: '0901234567',
              },
            },
          ],
        },
      });
      const payosClient = {
        paymentRequests: {
          create: jest
            .fn()
            .mockRejectedValueOnce(
              new Error('HTTP 200, Đơn thanh toán đã tồn tại (code: 231)'),
            )
            .mockResolvedValueOnce({
              paymentLinkId: 'plink-123',
              orderCode: 1776806693805002,
              status: 'PENDING',
              checkoutUrl: 'https://pay.payos.vn/web/abc',
              qrCode: 'qr-code',
              expiredAt: 1776807693,
            }),
        },
      };

      prisma.invoice.findUnique.mockResolvedValue(invoice as any);
      prisma.payment.create.mockResolvedValue({
        id: 'payment-123',
        invoiceId: 'invoice-123',
        paymentReference: 'PAYOS-1776806693805001',
      } as any);
      prisma.payment.update.mockResolvedValue({} as any);

      (service as any).payosClient = payosClient;
      jest
        .spyOn(service as any, 'generatePayOSOrderCode')
        .mockReturnValueOnce(1776806693805001)
        .mockReturnValueOnce(1776806693805002);

      const result = await service.createPayOSPayment(
        {
          invoiceId: 'invoice-123',
          description: 'TT INV-DEP-202604-00006',
        },
        user,
      );

      expect(payosClient.paymentRequests.create).toHaveBeenCalledTimes(2);
      expect(payosClient.paymentRequests.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ orderCode: 1776806693805001 }),
      );
      expect(payosClient.paymentRequests.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ orderCode: 1776806693805002 }),
      );
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
        data: expect.objectContaining({
          paymentReference: 'PAYOS-1776806693805002',
          transactionId: 'plink-123',
          status: PaymentStatus.pending,
        }),
      });
      expect(result).toMatchObject({
        paymentId: 'payment-123',
        invoiceId: 'invoice-123',
        paymentReference: 'PAYOS-1776806693805002',
        orderCode: 1776806693805002,
        checkoutUrl: 'https://pay.payos.vn/web/abc',
      });
    });

    it('should throw when PayOS is not configured while handling webhook', async () => {
      await expect(service.handlePayOSWebhook({} as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
