import { Test, TestingModule } from '@nestjs/testing';
import { ContractsService } from './contracts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ApartmentsService } from '../apartments/apartments.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  createPrismaMock,
  mockUserJwtPayload,
  mockStaffJwtPayload,
  mockAdminJwtPayload,
  mockOperatorJwtPayload,
} from '../../test-utils';
import { CreateContractDto, UpdateContractDto } from './dto';
import { ContractStatus, ApartmentStatus, MemberStatus } from '@prisma/client';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('ContractsService', () => {
  let service: ContractsService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let apartmentsService: Record<string, jest.Mock>;
  const notificationsService = {
    createAndPush: jest.fn(),
  };

  const mockContract = (overrides = {}) => ({
    id: 'contract-123',
    contractNumber: 'CTR-2026-00001',
    apartmentId: 'apt-123',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    monthlyRent: 10000000,
    depositAmount: 20000000,
    paymentDueDay: 5,
    status: ContractStatus.draft,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();
    apartmentsService = {
      updateStatus: jest.fn(),
    };


    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ApartmentsService, useValue: apartmentsService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all contracts for admin', async () => {
      const admin = mockAdminJwtPayload();
      const contracts = [
        mockContract({ contractPdfData: null }),
        mockContract({
          id: 'contract-124',
          contractPdfData: Buffer.from('pdf'),
        }),
      ];
      prisma.rentalContract.findMany.mockResolvedValue(contracts as any);

      const result = await service.findAll(admin);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'contract-123',
        hasPdf: false,
        pdfUrl: null,
      });
      expect(result[1]).toMatchObject({
        id: 'contract-124',
        hasPdf: true,
      });
      expect(result[1].pdfUrl).toContain('/contracts/pdf/view?token=');
    });

    it('should return only user own contracts', async () => {
      const user = mockUserJwtPayload();
      const contracts = [mockContract({ contractPdfData: Buffer.from('pdf') })];
      prisma.rentalContract.findMany.mockResolvedValue(contracts as any);

      const result = await service.findAll(user);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'contract-123',
        hasPdf: true,
      });
      expect(result[0].pdfUrl).toContain('/contracts/pdf/view?token=');
      expect(prisma.rentalContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            members: { some: { userId: user.sub } },
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      const admin = mockAdminJwtPayload();
      prisma.rentalContract.findMany.mockResolvedValue([]);

      await service.findAll(admin, ContractStatus.active);

      expect(prisma.rentalContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ContractStatus.active }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return contract by ID', async () => {
      const admin = mockAdminJwtPayload();
      const contract = mockContract();
      prisma.rentalContract.findUnique.mockResolvedValue(contract as any);

      const result = await service.findOne('contract-123', admin);

      expect(result).toMatchObject({
        id: 'contract-123',
        hasPdf: false,
        pdfUrl: '/contracts/contract-123/pdf',
        publicPdfUrl: null,
      });
    });

    it('should throw NotFoundException if not found', async () => {
      const admin = mockAdminJwtPayload();
      prisma.rentalContract.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent', admin)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const createDto: CreateContractDto = {
      apartmentId: 'apt-123',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      monthlyRent: 10000000,
      depositAmount: 20000000,
      paymentDueDay: 5,
      members: [{ userId: 'user-123', memberType: 'primary' as any }],
    };

    it('should create contract successfully', async () => {
      const operator = mockOperatorJwtPayload();
      const apartment = { id: 'apt-123', status: ApartmentStatus.available };
      const created = mockContract();

      prisma.apartment.findUnique.mockResolvedValue(apartment as any);
      prisma.rentalContract.findFirst.mockResolvedValue(null);
      prisma.rentalContract.count.mockResolvedValue(0);
      // Service uses callback-style $transaction
      prisma.$transaction.mockImplementation(async (callback) =>
        callback({
          rentalContract: { create: jest.fn().mockResolvedValue(created) },
          userContractMember: { createMany: jest.fn().mockResolvedValue({}) },
        }),
      );

      const result = await service.create(createDto, operator);

      expect(result).toEqual(created);
    });

    it('should throw NotFoundException if apartment not found', async () => {
      const operator = mockOperatorJwtPayload();
      prisma.apartment.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, operator)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if apartment already rented', async () => {
      const operator = mockOperatorJwtPayload();
      const apartment = { id: 'apt-123', status: ApartmentStatus.available };
      const existingContract = mockContract({ status: ContractStatus.active });

      prisma.apartment.findUnique.mockResolvedValue(apartment as any);
      prisma.rentalContract.findFirst.mockResolvedValue(
        existingContract as any,
      );

      await expect(service.create(createDto, operator)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('uploadSignedPdf', () => {
    it('should auto-create deposit invoice when signing contract', async () => {
      const user = mockUserJwtPayload();

      prisma.rentalContract.findUnique
        .mockResolvedValueOnce({
          id: 'contract-123',
          contractNumber: 'CTR-2026-00001',
          contractPdfData: null,
          startDate: new Date('2026-01-01'),
          depositAmount: 20000000,
          paymentMethod: 'bank_transfer',
          apartment: { depositAmount: 25000000 },
        } as any)
        .mockResolvedValueOnce({
          ...mockContract(),
          members: [{ user: { id: user.sub } }],
          apartment: null,
          contractPdfData: null,
          landlordSignature: null,
          tenantSignature: null,
          invoices: [],
        } as any);

      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.invoice.count.mockResolvedValue(0);
      prisma.invoice.create.mockResolvedValue({ id: 'inv-deposit-1' } as any);

      await service.uploadSignedPdf(
        'contract-123',
        { mimetype: 'application/pdf', buffer: Buffer.from('pdf') },
        user,
      );

      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rentalContract: { connect: { id: 'contract-123' } },
            status: 'issued',
            totalAmount: 25000000,
          }),
        }),
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateContractDto = {
      monthlyRent: 12000000,
    };

    it('should update contract', async () => {
      const contract = mockContract();
      const updated = { ...contract, ...updateDto };

      prisma.rentalContract.findUnique.mockResolvedValue(contract as any);
      prisma.rentalContract.update.mockResolvedValue(updated as any);

      const result = await service.update('contract-123', updateDto);

      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('activate', () => {
    it('should activate contract', async () => {
      const contract = mockContract({
        status: ContractStatus.pending,
        apartmentId: 'apt-123',
      });
      const activated = { ...contract, status: ContractStatus.active };

      prisma.rentalContract.findUnique.mockResolvedValue({
        ...contract,
        apartment: { id: 'apt-123' },
      } as any);
      // Service uses array-style $transaction for activate
      prisma.$transaction.mockResolvedValue([activated, {}]);

      const result = await service.activate('contract-123');

      expect(result[0].status).toBe(ContractStatus.active);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(null);

      await expect(service.activate('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if not pending', async () => {
      const contract = mockContract({ status: ContractStatus.active });
      prisma.rentalContract.findUnique.mockResolvedValue({
        ...contract,
        apartment: { id: 'apt-123' },
      } as any);

      await expect(service.activate('contract-123')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('terminate', () => {
    it('should terminate active contract', async () => {
      const contract = mockContract({
        status: ContractStatus.active,
        apartmentId: 'apt-123',
      });
      const terminated = { ...contract, status: ContractStatus.terminated };

      prisma.rentalContract.findUnique.mockResolvedValue({
        ...contract,
        apartment: { id: 'apt-123' },
      } as any);
      // Service uses array-style $transaction for terminate
      prisma.$transaction.mockResolvedValue([terminated, {}, {}]);

      const result = await service.terminate(
        'contract-123',
        'Early termination',
        5000000,
      );

      expect(result[0].status).toBe(ContractStatus.terminated);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(null);

      await expect(service.terminate('non-existent', 'reason')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelByUser', () => {
    it('should cancel contract for member user', async () => {
      const user = mockUserJwtPayload();
      const contract = mockContract({
        status: ContractStatus.signed,
        apartmentId: 'apt-123',
        members: [{ userId: user.sub }],
      });

      prisma.rentalContract.findUnique
        .mockResolvedValueOnce(contract as any)
        .mockResolvedValueOnce({
          ...mockContract({ status: ContractStatus.terminated }),
          members: [{ user: { id: user.sub } }],
          apartment: null,
          createdByStaff: null,
          invoices: [],
          contractPdfData: null,
          landlordSignature: null,
          tenantSignature: null,
        } as any);
      prisma.$transaction.mockImplementation(async (callback) =>
        callback(prisma as any),
      );

      const result = await service.cancelByUser(
        'contract-123',
        { reason: 'Khong thue nua' },
        user,
      );

      expect(result).toBeDefined();
      expect(prisma.rentalContract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'contract-123' },
          data: expect.objectContaining({
            status: ContractStatus.terminated,
          }),
        }),
      );
    });

    it('should throw NotFoundException if user is not member', async () => {
      const user = mockUserJwtPayload();
      const contract = mockContract({
        status: ContractStatus.signed,
        members: [{ userId: 'other-user' }],
      });

      prisma.rentalContract.findUnique.mockResolvedValue(contract as any);

      await expect(
        service.cancelByUser(
          'contract-123',
          { reason: 'Khong thue nua' },
          user,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
