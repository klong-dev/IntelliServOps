import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  createPrismaMock,
  mockUserJwtPayload,
  mockAdminJwtPayload,
  mockOperatorJwtPayload,
} from '../../test-utils';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto';
import { InvoiceStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: ReturnType<typeof createPrismaMock>;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all invoices for admin', async () => {
      const admin = mockAdminJwtPayload();
      const invoices = [mockInvoice()];
      prisma.invoice.findMany.mockResolvedValue(invoices as any);

      const result = await service.findAll(admin);

      expect(result).toEqual(invoices);
    });

    it('should filter user own invoices', async () => {
      const user = mockUserJwtPayload();
      prisma.invoice.findMany.mockResolvedValue([]);

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
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.findAll(admin, InvoiceStatus.paid);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: InvoiceStatus.paid },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return invoice by ID', async () => {
      const admin = mockAdminJwtPayload();
      const invoice = {
        ...mockInvoice(),
        rentalContract: { members: [{ user: { id: 'user-123' } }] },
      };
      prisma.invoice.findUnique.mockResolvedValue(invoice as any);

      const result = await service.findOne('invoice-123', admin);

      expect(result).toEqual(invoice);
    });

    it('should throw NotFoundException if not found', async () => {
      const admin = mockAdminJwtPayload();
      prisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent', admin)).rejects.toThrow(
        NotFoundException,
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
    it('should mark overdue invoices', async () => {
      prisma.invoice.updateMany.mockResolvedValue({ count: 5 } as any);

      const result = await service.markOverdue();

      expect(result.count).toBe(5);
      expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
        where: {
          status: {
            in: [InvoiceStatus.draft, InvoiceStatus.issued, InvoiceStatus.sent],
          },
          dueDate: { lt: expect.any(Date) },
        },
        data: { status: InvoiceStatus.overdue },
      });
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
