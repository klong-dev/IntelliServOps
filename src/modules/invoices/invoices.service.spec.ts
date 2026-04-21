import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  createPrismaMock,
  mockUserJwtPayload,
  mockAdminJwtPayload,
  mockOperatorJwtPayload,
} from '../../test-utils';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto';
import { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let paymentsService: { getPartnerPayoutDueBreakdown: jest.Mock };
  let notificationsService: { createAndPush: jest.Mock };

  const mockInvoice = (overrides = {}) => ({
    id: 'invoice-123',
    invoiceNumber: 'INV-202601-00001',
    rentalContractId: 'contract-123',
    totalAmount: 12000000,
    baseRent: 10000000,
    status: InvoiceStatus.draft,
    dueDate: new Date('2026-01-15'),
    issueDate: new Date('2026-01-01'),
    billingPeriodStart: new Date('2026-01-01'),
    billingPeriodEnd: new Date('2026-01-31'),
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();
    paymentsService = {
      getPartnerPayoutDueBreakdown: jest.fn(),
    };
    notificationsService = {
      createAndPush: jest.fn(),
    };
    prisma.invoice.findMany.mockResolvedValue([] as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should mark overdue before listing invoices', async () => {
      const admin = mockAdminJwtPayload();
      prisma.invoice.updateMany.mockResolvedValue({ count: 0 } as any);
      prisma.invoice.findMany.mockResolvedValue([] as any);

      await service.findAll(admin);

      expect(prisma.invoice.updateMany).toHaveBeenCalled();
    });

    it('should return all invoices for admin', async () => {
      const admin = mockAdminJwtPayload();
      prisma.invoice.updateMany.mockResolvedValue({ count: 0 } as any);
      const invoices = [
        {
          ...mockInvoice(),
          rentalContract: {
            id: 'contract-123',
            contractNumber: 'CTR-202601-00001',
            apartment: {
              apartmentNumber: 'A101',
              wardCode: 26728,
            },
          },
        },
      ];
      prisma.invoice.findMany.mockResolvedValue(invoices as any);
      prisma.invoice.count.mockResolvedValue(1 as any);

      const result = await service.findAll(admin);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.items[0]).toMatchObject({
        rentalContract: expect.objectContaining({
          id: invoices[0].rentalContract.id,
          contractNumber: invoices[0].rentalContract.contractNumber,
        }),
        contract: expect.objectContaining({
          id: invoices[0].rentalContract.id,
          contractNumber: invoices[0].rentalContract.contractNumber,
        }),
      });
    });

    it('should filter user own invoices', async () => {
      const user = mockUserJwtPayload();
      prisma.invoice.updateMany.mockResolvedValue({ count: 0 } as any);
      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.invoice.count.mockResolvedValue(0 as any);

      await service.findAll(user);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rentalContract: { members: { some: { userId: user.sub } } },
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      const admin = mockAdminJwtPayload();
      prisma.invoice.updateMany.mockResolvedValue({ count: 0 } as any);
      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.invoice.count.mockResolvedValue(0 as any);

      await service.findAll(admin, { status: InvoiceStatus.paid });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: InvoiceStatus.paid },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should mark overdue before returning invoice detail', async () => {
      const admin = mockAdminJwtPayload();
      prisma.invoice.updateMany.mockResolvedValue({ count: 0 } as any);
      prisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice(),
        rentalContract: {
          id: 'contract-123',
          contractNumber: 'CTR-202601-00001',
          apartment: {
            apartmentNumber: 'A101',
            wardCode: 26728,
          },
          members: [{ user: { id: 'user-123' } }],
        },
        payments: [],
      } as any);

      await service.findOne('invoice-123', admin);

      expect(prisma.invoice.updateMany).toHaveBeenCalled();
    });

    it('should return invoice by ID', async () => {
      const admin = mockAdminJwtPayload();
      prisma.invoice.updateMany.mockResolvedValue({ count: 0 } as any);
      const invoice = {
        ...mockInvoice(),
        rentalContract: {
          id: 'contract-123',
          contractNumber: 'CTR-202601-00001',
          apartment: {
            apartmentNumber: 'A101',
            wardCode: 26728,
          },
          members: [{ user: { id: 'user-123' } }],
        },
      };
      prisma.invoice.findUnique.mockResolvedValue(invoice as any);

      const result = await service.findOne('invoice-123', admin);

      expect(result).toMatchObject({
        rentalContract: invoice.rentalContract,
        contract: invoice.rentalContract,
      });
    });

    it('should throw NotFoundException if not found', async () => {
      const admin = mockAdminJwtPayload();
      prisma.invoice.updateMany.mockResolvedValue({ count: 0 } as any);
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent', admin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should query only the latest payment in invoice detail', async () => {
      const admin = mockAdminJwtPayload();
      prisma.invoice.updateMany.mockResolvedValue({ count: 0 } as any);
      prisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice(),
        rentalContract: {
          id: 'contract-123',
          contractNumber: 'CTR-202601-00001',
          apartment: {
            apartmentNumber: 'A101',
            wardCode: 26728,
          },
          members: [{ user: { id: 'user-123' } }],
        },
        payments: [
          {
            id: 'new-payment',
            amount: 10000,
            paymentMethod: 'bank_transfer',
            status: 'pending',
            paymentDate: new Date('2026-04-18T12:00:00.000Z'),
          },
        ],
      } as any);

      await service.findOne('invoice-123', admin);

      expect(prisma.invoice.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            payments: expect.objectContaining({
              orderBy: { createdAt: 'desc' },
              take: 1,
            }),
          }),
        }),
      );
    });
  });

  describe('findMonthlyUtilityUsage', () => {
    it('should list utility invoices for the current user only', async () => {
      const user = mockUserJwtPayload();
      prisma.invoice.updateMany.mockResolvedValue({ count: 0 } as any);
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'utility-invoice-1',
          invoiceNumber: 'UTIL-202601-T2-1505',
          invoiceType: InvoiceType.utility,
          status: InvoiceStatus.paid,
          billingMonth: '2026-01',
          billingPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
          billingPeriodEnd: new Date('2026-01-31T23:59:59.999Z'),
          issueDate: new Date('2026-02-01T00:00:00.000Z'),
          dueDate: new Date('2026-02-05T00:00:00.000Z'),
          paidAt: new Date('2026-02-03T00:00:00.000Z'),
          totalAmount: new Prisma.Decimal('900000.00'),
          utilityCharges: {
            electricity: {
              previousReading: 1100,
              currentReading: 1250,
              consumption: 150,
              unit: 'kWh',
              ratePerUnit: 3500,
              amount: 525000,
            },
            water: {
              previousReading: 100,
              currentReading: 125,
              consumption: 25,
              unit: 'm3',
              ratePerUnit: 15000,
              amount: 375000,
            },
            totalUtilityAmount: 900000,
          },
          rentalContract: {
            id: 'contract-123',
            contractNumber: 'HD-2026-00001',
            apartment: {
              id: 'apt-123',
              apartmentNumber: 'T2-1505',
            },
          },
        },
      ] as any);
      prisma.invoice.count.mockResolvedValue(1 as any);

      const result = await service.findMonthlyUtilityUsage(user);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            invoiceType: InvoiceType.utility,
            rentalContract: { members: { some: { userId: user.sub } } },
          },
        }),
      );
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          invoiceId: 'utility-invoice-1',
          invoiceNumber: 'UTIL-202601-T2-1505',
          status: InvoiceStatus.paid,
          billingMonth: '2026-01',
          apartment: {
            id: 'apt-123',
            apartmentNumber: 'T2-1505',
          },
          contract: {
            id: 'contract-123',
            contractNumber: 'HD-2026-00001',
          },
          electricity: expect.objectContaining({
            previousReading: '1100.00',
            currentReading: '1250.00',
            consumption: '150.00',
            amount: '525000.00',
          }),
          water: expect.objectContaining({
            previousReading: '100.00',
            currentReading: '125.00',
            consumption: '25.00',
            amount: '375000.00',
          }),
          totalUtilityAmount: '900000.00',
        }),
      );
    });

    it('should paginate utility invoices and sort by billing period descending', async () => {
      const admin = mockAdminJwtPayload();
      prisma.invoice.updateMany.mockResolvedValue({ count: 0 } as any);
      prisma.invoice.findMany.mockResolvedValue([] as any);
      prisma.invoice.count.mockResolvedValue(0 as any);

      await service.findMonthlyUtilityUsage(admin, { page: 2, limit: 5 });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { invoiceType: InvoiceType.utility },
          orderBy: [{ billingPeriodStart: 'desc' }, { createdAt: 'desc' }],
          skip: 5,
          take: 5,
        }),
      );
    });
  });

  describe('create', () => {
    const createDto: CreateInvoiceDto = {
      rentalContractId: 'contract-123',
      dueDate: '2026-01-15',
      billingPeriodStart: '2026-01-01',
      billingPeriodEnd: '2026-01-31',
      items: [
        { description: 'Rent', amount: 10000000 },
        { description: 'Utilities', amount: 2000000 },
      ],
    };

    it('should create invoice', async () => {
      const operator = mockOperatorJwtPayload();
      const contract = { monthlyRent: 10000000 };
      const created = mockInvoice();

      prisma.rentalContract.findUnique.mockResolvedValue(contract as any);
      prisma.invoice.count.mockResolvedValue(0);
      prisma.invoice.create.mockResolvedValue(created as any);

      const result = await service.create(createDto, operator);

      expect(result).toEqual(created);
    });

    it('should throw NotFoundException if contract not found', async () => {
      const operator = mockOperatorJwtPayload();
      prisma.rentalContract.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, operator)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateInvoiceDto = {
      status: InvoiceStatus.issued,
    };

    it('should update invoice', async () => {
      const invoice = mockInvoice();
      const updated = { ...invoice, ...updateDto };

      prisma.invoice.findUnique.mockResolvedValue(invoice as any);
      prisma.invoice.update.mockResolvedValue(updated as any);

      const result = await service.update('invoice-123', updateDto);

      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markOverdue', () => {
    it('should cancel overdue deposit invoices and mark other overdue invoices', async () => {
      prisma.invoice.findMany.mockResolvedValue([] as any);
      prisma.invoice.updateMany
        .mockResolvedValueOnce({ count: 2 } as any)
        .mockResolvedValueOnce({ count: 3 } as any);

      const result = await service.markOverdue();

      expect(result.count).toBe(5);
      expect(prisma.invoice.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          status: {
            in: [
              InvoiceStatus.draft,
              InvoiceStatus.issued,
              InvoiceStatus.sent,
              InvoiceStatus.partially_paid,
            ],
          },
          dueDate: { lt: expect.any(Date) },
          invoiceType: {
            in: [InvoiceType.deposit, InvoiceType.contractDeposit],
          },
        },
        data: { status: InvoiceStatus.cancelled },
      });

      expect(prisma.invoice.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          status: {
            in: [
              InvoiceStatus.draft,
              InvoiceStatus.issued,
              InvoiceStatus.sent,
              InvoiceStatus.partially_paid,
            ],
          },
          dueDate: { lt: expect.any(Date) },
          invoiceType: {
            notIn: [InvoiceType.deposit, InvoiceType.contractDeposit],
          },
        },
        data: { status: InvoiceStatus.overdue },
      });
    });

    it('should push overdue warning notifications for rent and utility invoices', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'invoice-rent-1',
          invoiceNumber: 'INV-202604-00001',
          invoiceType: InvoiceType.rent,
          dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          rentalContract: {
            apartment: { apartmentNumber: 'A101' },
            members: [
              { userId: 'user-1', user: { fullName: 'User One' } },
              { userId: 'user-2', user: { fullName: 'User Two' } },
            ],
          },
        },
      ] as any);
      prisma.invoice.updateMany
        .mockResolvedValueOnce({ count: 0 } as any)
        .mockResolvedValueOnce({ count: 1 } as any);

      await service.markOverdue();

      expect(notificationsService.createAndPush).toHaveBeenCalledTimes(2);
      expect(notificationsService.createAndPush).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientType: 'user',
          recipientId: 'user-1',
          notificationType: 'warning',
        }),
      );
    });
  });

  describe('listOverdueApartmentsAndTenants', () => {
    it('should return overdue apartments and tenant summaries', async () => {
      prisma.invoice.findMany
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([
          {
            id: 'invoice-1',
            invoiceNumber: 'INV-202604-00003',
            invoiceType: InvoiceType.utility,
            dueDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
            rentalContract: {
              apartment: {
                id: 'apt-123',
                apartmentNumber: 'A101',
              },
              members: [
                {
                  userId: 'user-123',
                  user: {
                    fullName: 'Nguyen Van A',
                    email: 'a@example.com',
                    phone: '+84901234567',
                  },
                },
              ],
            },
          },
        ] as any);
      prisma.invoice.updateMany
        .mockResolvedValueOnce({ count: 0 } as any)
        .mockResolvedValueOnce({ count: 1 } as any);

      const result = await service.listOverdueApartmentsAndTenants({
        minOverdueDays: 1,
      });

      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        apartmentId: 'apt-123',
        apartmentNumber: 'A101',
        overdueInvoiceCount: 1,
      });
      expect(result.items[0].tenants[0]).toMatchObject({
        userId: 'user-123',
      });
    });
  });

  describe('autoMarkOverdueInvoices', () => {
    it('should run overdue sync', async () => {
      prisma.invoice.updateMany.mockResolvedValue({ count: 3 } as any);

      await service.autoMarkOverdueInvoices();

      expect(prisma.invoice.updateMany).toHaveBeenCalled();
    });
  });

  describe('generateInvoiceNumber', () => {
    it('should generate unique invoice number', async () => {
      prisma.invoice.count.mockResolvedValue(10);

      const result = await (service as any).generateInvoiceNumber();

      expect(result).toMatch(/^INV-\d{6}-\d{5}$/);
    });
  });
});
