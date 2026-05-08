import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  createPrismaMock,
  mockUserJwtPayload,
  mockAdminJwtPayload,
  mockStaffJwtPayload,
} from '../../test-utils';
import { CreatePaymentDto } from './dto';
import {
  PaymentStatus,
  InvoiceStatus,
  ContractStatus,
  InvoiceType,
  UserApartmentStatus,
  PartnerMonthlyPayoutStatus,
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
    clearApartmentDoorPinHash: jest.fn(),
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
    ioTService.clearApartmentDoorPinHash.mockResolvedValue({
      success: true,
      skipped: false,
      boardId: 'ESP_A101',
      deviceId: 1,
      message: 'Door PIN hash cleared successfully.',
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
            apartmentDoorPassword: null,
          }),
          update: expect.objectContaining({
            apartmentDoorPassword: null,
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
          message: expect.stringContaining(
            'PIN cửa đã được đặt lại. Vui lòng thiết lập PIN mới khi sử dụng lần đầu.',
          ),
        }),
      );
      expect(ioTService.clearApartmentDoorPinHash).toHaveBeenCalledWith(
        'apt-123',
      );
    });

    it('should not activate contract for non-deposit invoice type', async () => {
      const payment = mockPayment({ status: PaymentStatus.pending });

      prisma.payment.findUnique.mockResolvedValue({
        ...payment,
        invoice: mockInvoice({
          invoiceType: InvoiceType.rent,
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

    it('should keep contract pending activation, reserve apartment, and mark first-pass setup before startDate', async () => {
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
      expect(prisma.apartment.update).toHaveBeenCalledWith({
        where: { id: 'apt-123' },
        data: { status: 'reserved' },
      });
      expect(prisma.userApartment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: UserApartmentStatus.active,
            apartmentDoorPassword: null,
          }),
          update: expect.objectContaining({
            status: UserApartmentStatus.active,
            apartmentDoorPassword: null,
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
          message: expect.stringContaining(
            'PIN cửa đã được đặt lại. Vui lòng thiết lập PIN mới khi sử dụng lần đầu.',
          ),
        }),
      );
      expect(ioTService.clearApartmentDoorPinHash).toHaveBeenCalledWith(
        'apt-123',
      );
    });
  });

  describe('payout eligibility', () => {
    it('should hide deposit payout when contract has unpaid utility invoice', async () => {
      const staff = mockStaffJwtPayload();
      prisma.rentalContract.findMany.mockResolvedValue([
        {
          id: 'contract-123',
          contractNumber: 'CNT-001',
          apartmentId: 'apt-123',
          endDate: new Date('2026-04-01T00:00:00.000Z'),
          depositAmount: 10000000,
          apartment: { apartmentNumber: 'A101' },
          members: [
            {
              userId: 'user-123',
              memberType: 'primary',
              isPrimaryContact: true,
              user: {
                id: 'user-123',
                fullName: 'Nguyen Van A',
                phone: '0901234567',
                bankName: 'VCB',
                bankAccountNumber: '0123456789',
              },
            },
          ],
          invoices: [
            {
              id: 'deposit-invoice-123',
              currency: 'VND',
              totalAmount: 10000000,
              payments: [],
            },
          ],
          _count: { invoices: 1 },
        },
      ] as any);

      await expect(
        service.listDueContractDepositPayouts(staff, { month: '2026-04' }),
      ).resolves.toEqual([]);
    });

    it('should show deposit payout after all utility invoices are paid', async () => {
      const staff = mockStaffJwtPayload();
      prisma.rentalContract.findMany.mockResolvedValue([
        {
          id: 'contract-123',
          contractNumber: 'CNT-001',
          apartmentId: 'apt-123',
          endDate: new Date('2026-04-01T00:00:00.000Z'),
          depositAmount: 10000000,
          apartment: { apartmentNumber: 'A101' },
          members: [
            {
              userId: 'user-123',
              memberType: 'primary',
              isPrimaryContact: true,
              user: {
                id: 'user-123',
                fullName: 'Nguyen Van A',
                phone: '0901234567',
                bankName: 'VCB',
                bankAccountNumber: '0123456789',
              },
            },
          ],
          invoices: [
            {
              id: 'deposit-invoice-123',
              currency: 'VND',
              totalAmount: 10000000,
              payments: [],
            },
          ],
          _count: { invoices: 0 },
        },
      ] as any);

      const result = await service.listDueContractDepositPayouts(staff, {
        month: '2026-04',
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        contractId: 'contract-123',
        payoutAmount: '10000000.00',
      });
    });

    it('should reject deposit payout confirmation when contract has unpaid utility invoice', async () => {
      const staff = mockStaffJwtPayload();
      prisma.rentalContract.findUnique.mockResolvedValue({
        id: 'contract-123',
        contractNumber: 'CNT-001',
        endDate: new Date('2026-04-01T00:00:00.000Z'),
        depositAmount: 10000000,
        members: [{ userId: 'user-123', memberType: 'primary' }],
        invoices: [
          {
            id: 'deposit-invoice-123',
            currency: 'VND',
            totalAmount: 10000000,
            paymentMethod: 'bank_transfer',
            payments: [],
          },
        ],
      } as any);
      prisma.invoice.count.mockResolvedValue(1 as any);

      await expect(
        service.confirmContractDepositPayout(
          staff,
          { contractId: 'contract-123' },
          { mimetype: 'image/png', buffer: Buffer.from('proof') },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return materialized pending deposit payout payment id', async () => {
      const staff = mockStaffJwtPayload();
      prisma.rentalContract.findMany.mockResolvedValue([
        {
          id: 'contract-123',
          contractNumber: 'CNT-001',
          apartmentId: 'apt-123',
          endDate: new Date('2026-04-01T00:00:00.000Z'),
          depositAmount: 10000000,
          apartment: { apartmentNumber: 'A101' },
          members: [
            {
              userId: 'user-123',
              memberType: 'primary',
              isPrimaryContact: true,
              user: {
                id: 'user-123',
                fullName: 'Nguyen Van A',
                phone: '0901234567',
                bankName: 'VCB',
                bankAccountNumber: '0123456789',
              },
            },
          ],
          invoices: [
            {
              id: 'deposit-invoice-123',
              currency: 'VND',
              totalAmount: 10000000,
              payments: [
                {
                  id: 'refund-payment-123',
                  status: PaymentStatus.pending,
                  paymentProofUrl: null,
                  transactionId: null,
                  notes: null,
                  refundDate: null,
                  processedByStaffId: null,
                },
              ],
            },
          ],
          _count: { invoices: 0 },
        },
      ] as any);

      const result = await service.listDueContractDepositPayouts(staff, {
        month: '2026-04',
      });

      expect(result[0]).toMatchObject({
        payoutPaymentId: 'refund-payment-123',
        status: PaymentStatus.pending,
      });
    });

    it('should create pending deposit payout after final utility invoice is paid', async () => {
      const payment = mockPayment({ status: PaymentStatus.pending });
      const paidAt = new Date('2026-04-10T00:00:00.000Z');
      prisma.payment.findUnique.mockResolvedValue({
        ...payment,
        invoice: mockInvoice({
          invoiceType: InvoiceType.utility,
          rentalContract: {
            id: 'contract-123',
            status: ContractStatus.expired,
            apartmentId: 'apt-123',
            members: [{ userId: 'user-123' }],
          },
        }),
      } as any);
      prisma.$transaction.mockResolvedValue([] as any);
      prisma.invoice.findUnique
        .mockResolvedValueOnce({
          id: 'invoice-123',
          invoiceType: InvoiceType.utility,
          rentalContract: { apartmentId: 'apt-123' },
        } as any)
        .mockResolvedValueOnce({
          id: 'invoice-123',
          invoiceType: InvoiceType.utility,
          paidAt,
        } as any)
        .mockResolvedValueOnce({
          id: 'invoice-123',
          invoiceType: InvoiceType.utility,
          paidAt,
          rentalContract: {
            id: 'contract-123',
            status: ContractStatus.expired,
            endDate: new Date('2026-04-01T00:00:00.000Z'),
            depositAmount: 10000000,
            members: [{ userId: 'user-123', memberType: 'primary' }],
            invoices: [
              {
                id: 'deposit-invoice-123',
                totalAmount: 10000000,
                currency: 'VND',
                paymentMethod: 'bank_transfer',
                payments: [],
              },
            ],
          },
        } as any);
      prisma.invoice.count.mockResolvedValue(0 as any);

      await service.confirm('payment-123', 'tx-123');

      expect(prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoice: { connect: { id: 'deposit-invoice-123' } },
            user: { connect: { id: 'user-123' } },
            paymentGateway: 'manual_refund',
            status: PaymentStatus.pending,
            refundAmount: 10000000,
          }),
        }),
      );
    });

    it('should not create pending deposit payout while rent or utility remains unpaid', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'invoice-123',
        invoiceType: InvoiceType.utility,
        paidAt: new Date('2026-04-10T00:00:00.000Z'),
        rentalContract: {
          id: 'contract-123',
          status: ContractStatus.expired,
          endDate: new Date('2026-04-01T00:00:00.000Z'),
          depositAmount: 10000000,
          members: [{ userId: 'user-123', memberType: 'primary' }],
          invoices: [
            {
              id: 'deposit-invoice-123',
              totalAmount: 10000000,
              currency: 'VND',
              paymentMethod: 'bank_transfer',
              payments: [],
            },
          ],
        },
      } as any);
      prisma.invoice.count.mockResolvedValue(1 as any);

      await (service as any).createPendingContractDepositPayoutIfEligible(
        'invoice-123',
      );

      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('should update pending deposit payout when staff confirms transfer proof', async () => {
      const staff = mockStaffJwtPayload();
      prisma.rentalContract.findUnique.mockResolvedValue({
        id: 'contract-123',
        contractNumber: 'CNT-001',
        endDate: new Date('2026-04-01T00:00:00.000Z'),
        depositAmount: 10000000,
        members: [{ userId: 'user-123', memberType: 'primary' }],
        invoices: [
          {
            id: 'deposit-invoice-123',
            currency: 'VND',
            totalAmount: 10000000,
            paymentMethod: 'bank_transfer',
            payments: [
              { id: 'refund-payment-123', status: PaymentStatus.pending },
            ],
          },
        ],
      } as any);
      prisma.invoice.count.mockResolvedValue(0 as any);
      storageService.uploadFile.mockResolvedValue('https://proof.local/img.png');
      prisma.payment.update.mockResolvedValue({
        id: 'refund-payment-123',
        status: PaymentStatus.refunded,
        refundDate: new Date('2026-04-11T00:00:00.000Z'),
        processedByStaffId: staff.sub,
      } as any);

      const result = await service.confirmContractDepositPayout(
        staff,
        {
          contractId: 'contract-123',
          transferReference: 'BANK-TX-1',
          transferNote: 'done',
        },
        { mimetype: 'image/png', buffer: Buffer.from('proof') },
      );

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'refund-payment-123' },
          data: expect.objectContaining({
            status: PaymentStatus.refunded,
            transactionId: 'BANK-TX-1',
            paymentProofUrl: 'https://proof.local/img.png',
          }),
        }),
      );
      expect(result.payoutPaymentId).toBe('refund-payment-123');
    });

    it('should create pending partner payout immediately when rent invoice is paid', async () => {
      const payment = mockPayment({ status: PaymentStatus.pending });
      const paidAt = new Date('2026-04-10T00:00:00.000Z');
      prisma.payment.findUnique.mockResolvedValue({
        ...payment,
        invoice: mockInvoice({
          invoiceType: InvoiceType.rent,
          rentalContract: {
            id: 'contract-123',
            status: ContractStatus.active,
            apartmentId: 'apt-123',
            members: [{ userId: 'user-123' }],
          },
        }),
      } as any);
      prisma.$transaction.mockResolvedValue([] as any);
      prisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'invoice-123',
        invoiceType: InvoiceType.rent,
        rentalContract: { apartmentId: 'apt-123' },
      } as any);
      prisma.invoice.findUnique.mockResolvedValueOnce({
        id: 'invoice-123',
        invoiceType: InvoiceType.rent,
        paidAt,
      } as any);
      prisma.partnerCooperationContract.findMany.mockResolvedValue([
        {
          apartmentId: 'apt-123',
          partnerId: 'partner-123',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
          commissionRate: 10,
          partner: {
            id: 'partner-123',
            fullName: 'Partner A',
            companyName: 'Partner Co',
            bankName: 'VCB',
            bankAccountNumber: '9876543210',
            paymentTerms: 'day 5',
          },
        },
      ] as any);
      prisma.invoice.findMany.mockResolvedValue([
        {
          totalAmount: 10000000,
          currency: 'VND',
          paidAt,
          rentalContract: { apartmentId: 'apt-123' },
        },
      ] as any);

      await service.confirm('payment-123', 'tx-123');

      expect(prisma.partnerMonthlyPayout.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            payoutMonth: '2026-04',
            dueDate: paidAt,
            payoutAmount: 9000000,
            status: PartnerMonthlyPayoutStatus.pending,
          }),
        }),
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
