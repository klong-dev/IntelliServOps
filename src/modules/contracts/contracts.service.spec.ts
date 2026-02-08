import { Test, TestingModule } from '@nestjs/testing';
import { ContractsService } from './contracts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, mockUserJwtPayload, mockStaffJwtPayload, mockAdminJwtPayload, mockOperatorJwtPayload } from '../../test-utils';
import { CreateContractDto, UpdateContractDto } from './dto';
import { ContractStatus, ApartmentStatus, MemberStatus } from '@prisma/client';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('ContractsService', () => {
  let service: ContractsService;
  let prisma: ReturnType<typeof createPrismaMock>;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: PrismaService, useValue: prisma },
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
      const contracts = [mockContract(), mockContract({ id: 'contract-124' })];
      prisma.rentalContract.findMany.mockResolvedValue(contracts as any);

      const result = await service.findAll(admin);

      expect(result).toEqual(contracts);
    });

    it('should return only user own contracts', async () => {
      const user = mockUserJwtPayload();
      const contracts = [mockContract()];
      prisma.rentalContract.findMany.mockResolvedValue(contracts as any);

      const result = await service.findAll(user);

      expect(result).toEqual(contracts);
      expect(prisma.rentalContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            members: { some: { userId: user.sub } },
          }),
        })
      );
    });

    it('should filter by status', async () => {
      const admin = mockAdminJwtPayload();
      prisma.rentalContract.findMany.mockResolvedValue([]);

      await service.findAll(admin, ContractStatus.active);

      expect(prisma.rentalContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ContractStatus.active }),
        })
      );
    });
  });

  describe('findOne', () => {
    it('should return contract by ID', async () => {
      const admin = mockAdminJwtPayload();
      const contract = mockContract();
      prisma.rentalContract.findUnique.mockResolvedValue(contract as any);

      const result = await service.findOne('contract-123', admin);

      expect(result).toEqual(contract);
    });

    it('should throw NotFoundException if not found', async () => {
      const admin = mockAdminJwtPayload();
      prisma.rentalContract.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent', admin)).rejects.toThrow(NotFoundException);
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
      prisma.$transaction.mockImplementation(async (callback) => callback({
        rentalContract: { create: jest.fn().mockResolvedValue(created) },
        userContractMember: { createMany: jest.fn().mockResolvedValue({}) },
      }));

      const result = await service.create(createDto, operator);

      expect(result).toEqual(created);
    });

    it('should throw NotFoundException if apartment not found', async () => {
      const operator = mockOperatorJwtPayload();
      prisma.apartment.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, operator)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if apartment already rented', async () => {
      const operator = mockOperatorJwtPayload();
      const apartment = { id: 'apt-123', status: ApartmentStatus.available };
      const existingContract = mockContract({ status: ContractStatus.active });

      prisma.apartment.findUnique.mockResolvedValue(apartment as any);
      prisma.rentalContract.findFirst.mockResolvedValue(existingContract as any);

      await expect(service.create(createDto, operator)).rejects.toThrow(ConflictException);
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

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('activate', () => {
    it('should activate contract', async () => {
      const contract = mockContract({ status: ContractStatus.pending, apartmentId: 'apt-123' });
      const activated = { ...contract, status: ContractStatus.active };

      prisma.rentalContract.findUnique.mockResolvedValue({ ...contract, apartment: { id: 'apt-123' } } as any);
      // Service uses array-style $transaction for activate
      prisma.$transaction.mockResolvedValue([activated, {}]);

      const result = await service.activate('contract-123');

      expect(result[0].status).toBe(ContractStatus.active);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(null);

      await expect(service.activate('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if not pending', async () => {
      const contract = mockContract({ status: ContractStatus.active });
      prisma.rentalContract.findUnique.mockResolvedValue({ ...contract, apartment: { id: 'apt-123' } } as any);

      await expect(service.activate('contract-123')).rejects.toThrow(ConflictException);
    });
  });

  describe('terminate', () => {
    it('should terminate active contract', async () => {
      const contract = mockContract({ status: ContractStatus.active, apartmentId: 'apt-123' });
      const terminated = { ...contract, status: ContractStatus.terminated };

      prisma.rentalContract.findUnique.mockResolvedValue({ ...contract, apartment: { id: 'apt-123' } } as any);
      // Service uses array-style $transaction for terminate
      prisma.$transaction.mockResolvedValue([terminated, {}, {}]);

      const result = await service.terminate('contract-123', 'Early termination', 5000000);

      expect(result[0].status).toBe(ContractStatus.terminated);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(null);

      await expect(service.terminate('non-existent', 'reason')).rejects.toThrow(NotFoundException);
    });
  });
});
