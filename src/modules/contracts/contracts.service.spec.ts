import { Test, TestingModule } from '@nestjs/testing';
import { ContractsService } from './contracts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ApartmentsService } from '../apartments/apartments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ContractPdfService } from './contract-pdf.service';
import {
  createPrismaMock,
  mockUserJwtPayload,
  mockStaffJwtPayload,
  mockAdminJwtPayload,
  mockOperatorJwtPayload,
} from '../../test-utils';
import { CreateContractDto, UpdateContractDto } from './dto';
import {
  ContractStatus,
  ApartmentStatus,
  MemberStatus,
  ReservationStatus,
} from '@prisma/client';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

describe('ContractsService', () => {
  let service: ContractsService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let apartmentsService: Record<string, jest.Mock>;
  const contractPdfService = {
    generateContractPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
  };
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
        { provide: ContractPdfService, useValue: contractPdfService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should auto-activate eligible contracts before listing', async () => {
      const admin = mockAdminJwtPayload();
      prisma.rentalContract.findMany.mockResolvedValue([] as any);

      const autoActivateSpy = jest
        .spyOn(service, 'autoActivateContractsWhenDepositPaid')
        .mockResolvedValue();

      await service.findAll(admin);

      expect(autoActivateSpy).toHaveBeenCalled();
    });

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

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.items[0]).toMatchObject({
        id: 'contract-123',
        depositAmount: 20000000,
        hasPdf: false,
        pdfUrl: null,
      });
      expect(result.items[1]).toMatchObject({
        id: 'contract-124',
        hasPdf: true,
      });
      expect(result.items[1].pdfUrl).toContain('/contracts/pdf/view?token=');
    });

    it('should return only user own contracts', async () => {
      const user = mockUserJwtPayload();
      const contracts = [mockContract({ contractPdfData: Buffer.from('pdf') })];
      prisma.rentalContract.findMany.mockResolvedValue(contracts as any);

      const result = await service.findAll(user);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        id: 'contract-123',
        hasPdf: true,
      });
      expect(result.items[0].pdfUrl).toContain('/contracts/pdf/view?token=');
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

      await service.findAll(admin, { status: ContractStatus.active });

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
      const contract = {
        ...mockContract(),
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A-101',
          wardCode: null,
          provinceCode: null,
          buildingName: null,
          streetAddress: null,
          maxOccupants: 2,
          numberOfBedrooms: 2,
          numberOfBathrooms: 1,
          totalArea: 75,
          usableArea: 70,
        },
        members: [],
        createdByStaff: null,
        invoices: [],
        renewalContracts: [],
        contractPdfData: null,
        landlordSignature: null,
        tenantSignature: null,
      };
      prisma.rentalContract.findUnique.mockResolvedValue(contract as any);

      const result = await service.findOne('contract-123', admin);

      expect(result).toMatchObject({
        id: 'contract-123',
        hasPdf: false,
        pdfUrl: '/contracts/contract-123/pdf',
        publicPdfUrl: null,
        maxAddableMembers: 2,
        maxOccupants: 2,
        currentOccupants: 0,
      });
    });

    it('should throw NotFoundException if not found', async () => {
      const admin = mockAdminJwtPayload();
      prisma.rentalContract.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent', admin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should auto-activate eligible signed contract when reading detail', async () => {
      const admin = mockAdminJwtPayload();
      const baseContract = {
        ...mockContract({
          status: ContractStatus.signed,
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }),
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A-101',
          wardCode: null,
          provinceCode: null,
          buildingName: null,
          streetAddress: null,
          maxOccupants: 2,
          numberOfBedrooms: 2,
          numberOfBathrooms: 1,
          totalArea: 75,
          usableArea: 70,
        },
        members: [],
        createdByStaff: null,
        invoices: [],
        renewalContracts: [],
        contractPdfData: null,
        landlordSignature: null,
        tenantSignature: null,
      };

      prisma.rentalContract.findUnique
        .mockResolvedValueOnce(baseContract as any)
        .mockResolvedValueOnce({
          ...baseContract,
          status: ContractStatus.active,
        } as any);
      prisma.invoice.findFirst.mockResolvedValue({ paidAt: new Date() } as any);

      const activateSpy = jest
        .spyOn(service, 'activateWhenDepositPaid')
        .mockResolvedValue([] as any);

      const result = await service.findOne('contract-123', admin);

      expect(activateSpy).toHaveBeenCalledWith('contract-123');
      expect(result.status).toBe(ContractStatus.active);
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
      prisma.rentalContract.findUnique.mockResolvedValue({
        ...created,
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A-101',
          wardCode: null,
          numberOfBedrooms: 2,
          numberOfBathrooms: 1,
          totalArea: 75,
        },
        members: [],
        createdByStaff: null,
        invoices: [],
        contractPdfData: null,
        landlordSignature: null,
        tenantSignature: null,
      } as any);
      // Service uses callback-style $transaction
      prisma.$transaction.mockImplementation(async (callback) =>
        callback({
          rentalContract: { create: jest.fn().mockResolvedValue(created) },
          userContractMember: { createMany: jest.fn().mockResolvedValue({}) },
        }),
      );

      const result = await service.create(createDto, operator);

      expect(result).toMatchObject({
        id: created.id,
        contractNumber: created.contractNumber,
        status: created.status,
        pdfUrl: `/contracts/${created.id}/pdf`,
        hasPdf: false,
      });
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

      expect(prisma.reservation.updateMany).toHaveBeenCalledWith({
        where: { createdContractId: 'contract-123' },
        data: {
          status: ReservationStatus.confirmed,
          cancelReason: null,
        },
      });

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

    it('should throw ConflictException when startDate is in the future', async () => {
      const contract = mockContract({
        status: ContractStatus.signed,
        apartmentId: 'apt-123',
        startDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
      });

      prisma.rentalContract.findUnique.mockResolvedValue({
        ...contract,
        apartment: { id: 'apt-123' },
      } as any);

      await expect(service.activate('contract-123')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should mark contract expired and reject activation when endDate has passed', async () => {
      const contract = mockContract({
        status: ContractStatus.signed,
        apartmentId: 'apt-123',
        startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      prisma.rentalContract.findUnique.mockResolvedValue({
        ...contract,
        apartment: { id: 'apt-123' },
      } as any);

      await expect(service.activate('contract-123')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.rentalContract.update).toHaveBeenCalledWith({
        where: { id: 'contract-123' },
        data: { status: ContractStatus.expired },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should upsert userApartment records for active members on activation', async () => {
      const contract = mockContract({
        status: ContractStatus.pending,
        apartmentId: 'apt-123',
      });

      prisma.rentalContract.findUnique.mockResolvedValue({
        ...contract,
        apartment: { id: 'apt-123' },
        members: [
          {
            userId: 'user-1',
            memberType: 'primary',
            isPrimaryContact: true,
          },
        ],
      } as any);
      prisma.$transaction.mockResolvedValue([
        { ...contract, status: ContractStatus.active },
        {},
        {},
      ] as any);

      await service.activate('contract-123');

      expect(prisma.userApartment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_apartmentId_rentalContractId: {
              userId: 'user-1',
              apartmentId: 'apt-123',
              rentalContractId: 'contract-123',
            },
          },
          create: expect.objectContaining({
            status: 'active',
            isPrimaryTenant: true,
          }),
          update: expect.objectContaining({
            status: 'active',
            moveOutDate: contract.endDate,
          }),
        }),
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
      expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ rentalContractId: 'contract-123' }),
          data: expect.objectContaining({ status: 'cancelled' }),
        }),
      );
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
        members: [
          {
            userId: user.sub,
            memberType: 'primary',
            isPrimaryContact: true,
          },
        ],
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
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith({
        where: { createdContractId: 'contract-123' },
        data: { status: ReservationStatus.cancelled },
      });
      expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ rentalContractId: 'contract-123' }),
          data: expect.objectContaining({ status: 'cancelled' }),
        }),
      );
    });

    it('should throw NotFoundException if user is not member', async () => {
      const user = mockUserJwtPayload();
      const contract = mockContract({
        status: ContractStatus.signed,
        members: [
          {
            userId: 'other-user',
            memberType: 'primary',
            isPrimaryContact: true,
          },
        ],
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

    it('should throw ForbiddenException when secondary member cancels contract', async () => {
      const user = mockUserJwtPayload();
      const contract = mockContract({
        status: ContractStatus.signed,
        members: [
          {
            userId: user.sub,
            memberType: 'co_tenant',
            isPrimaryContact: false,
          },
        ],
      });

      prisma.rentalContract.findUnique.mockResolvedValue(contract as any);

      await expect(
        service.cancelByUser(
          'contract-123',
          { reason: 'Khong thue nua' },
          user,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should clear renewedFromContractId when cancelling a renewal contract', async () => {
      const user = mockUserJwtPayload();
      const renewalContract = mockContract({
        status: ContractStatus.signed,
        category: 'renewal',
        renewedFromContractId: 'contract-source-123',
        members: [
          {
            userId: user.sub,
            memberType: 'primary',
            isPrimaryContact: true,
          },
        ],
      });

      prisma.rentalContract.findUnique
        .mockResolvedValueOnce(renewalContract as any)
        .mockResolvedValueOnce({
          ...mockContract({ status: ContractStatus.terminated }),
          members: [{ user: { id: user.sub } }],
          apartment: null,
          createdByStaff: null,
          invoices: [],
          renewalContracts: [],
          contractPdfData: null,
          landlordSignature: null,
          tenantSignature: null,
        } as any);

      prisma.$transaction.mockImplementation(async (callback) =>
        callback(prisma as any),
      );

      await service.cancelByUser(
        'contract-123',
        { reason: 'Khong thue nua' },
        user,
      );

      expect(prisma.rentalContract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'contract-123' },
          data: expect.objectContaining({
            status: ContractStatus.terminated,
            renewedFromContractId: null,
          }),
        }),
      );
    });
  });

  describe('addMemberByNationalId', () => {
    it('should add verified CCCD user and regenerate pdf for draft contract', async () => {
      const user = mockUserJwtPayload();

      prisma.rentalContract.findUnique
        .mockResolvedValueOnce({
          id: 'contract-123',
          status: ContractStatus.draft,
          apartment: { maxOccupants: 2 },
          members: [{ userId: user.sub, memberType: 'primary' }],
        } as any)
        .mockResolvedValueOnce({
          ...mockContract({ status: ContractStatus.draft }),
          members: [{ user: { id: user.sub } }],
          apartment: null,
          createdByStaff: null,
          invoices: [],
          contractPdfData: null,
          landlordSignature: null,
          tenantSignature: null,
        } as any);

      prisma.userIdentity.findFirst.mockResolvedValue({
        userId: 'user-456',
        user: {
          id: 'user-456',
          isActive: true,
          isVerified: true,
        },
      } as any);

      prisma.userContractMember.create.mockResolvedValue({} as any);
      jest.spyOn(service, 'regenerateContractPdf').mockResolvedValue();

      await service.addMemberByNationalId(
        'contract-123',
        { nationalId: '079203001234' },
        user,
      );

      expect(prisma.userContractMember.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-456',
          rentalContractId: 'contract-123',
          memberType: 'co_tenant',
        }),
      });
      expect(service.regenerateContractPdf).toHaveBeenCalledWith(
        'contract-123',
      );
    });

    it('should reject adding member when contract is signed', async () => {
      const user = mockUserJwtPayload();

      prisma.rentalContract.findUnique.mockResolvedValue({
        id: 'contract-123',
        status: ContractStatus.signed,
        apartment: { maxOccupants: 2 },
        members: [{ userId: user.sub, memberType: 'primary' }],
      } as any);

      await expect(
        service.addMemberByNationalId(
          'contract-123',
          { nationalId: '079203001234' },
          user,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject adding member when current member count reaches apartment max occupants limit', async () => {
      const user = mockUserJwtPayload();

      prisma.rentalContract.findUnique.mockResolvedValue({
        id: 'contract-123',
        status: ContractStatus.draft,
        apartment: { maxOccupants: 2 },
        members: [
          { userId: user.sub, memberType: 'primary' },
          { userId: 'user-789', memberType: 'co_tenant' },
        ],
      } as any);

      await expect(
        service.addMemberByNationalId(
          'contract-123',
          { nationalId: '079203001234' },
          user,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.userIdentity.findFirst).not.toHaveBeenCalled();
      expect(prisma.userContractMember.create).not.toHaveBeenCalled();
    });

    it('should reject adding member with non co_tenant memberType', async () => {
      const user = mockUserJwtPayload();

      prisma.rentalContract.findUnique.mockResolvedValue({
        id: 'contract-123',
        status: ContractStatus.draft,
        apartment: { maxOccupants: 3 },
        members: [
          {
            userId: user.sub,
            memberType: 'primary',
            isPrimaryContact: true,
          },
        ],
      } as any);

      await expect(
        service.addMemberByNationalId(
          'contract-123',
          { nationalId: '079203001234', memberType: 'primary' as any },
          user,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.userIdentity.findFirst).not.toHaveBeenCalled();
    });

    it('should reject adding member with isPrimaryContact=true', async () => {
      const user = mockUserJwtPayload();

      prisma.rentalContract.findUnique.mockResolvedValue({
        id: 'contract-123',
        status: ContractStatus.draft,
        apartment: { maxOccupants: 3 },
        members: [
          {
            userId: user.sub,
            memberType: 'primary',
            isPrimaryContact: true,
          },
        ],
      } as any);

      await expect(
        service.addMemberByNationalId(
          'contract-123',
          { nationalId: '079203001234', isPrimaryContact: true },
          user,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.userIdentity.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('renewContract', () => {
    it('should keep old months and members when renewalOption is keep_current', async () => {
      const user = mockUserJwtPayload();

      prisma.rentalContract.findUnique
        .mockResolvedValueOnce({
          id: 'contract-123',
          contractNumber: 'CTR-2026-00001',
          apartmentId: 'apt-123',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
          monthlyRent: 10000000,
          depositAmount: 20000000,
          paymentDueDay: 5,
          paymentMethod: 'bank_transfer',
          utilitiesIncluded: null,
          utilitiesCharges: null,
          contractTerms: null,
          specialConditions: null,
          status: ContractStatus.active,
          apartment: {
            id: 'apt-123',
            maxOccupants: 3,
          },
          members: [
            {
              userId: user.sub,
              memberType: 'primary',
              isPrimaryContact: true,
              sharePercentage: 100,
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          ...mockContract({
            id: 'contract-999',
            contractNumber: 'CTR-2026-00002',
          }),
          members: [{ user: { id: user.sub } }],
          apartment: null,
          createdByStaff: null,
          invoices: [],
          contractPdfData: null,
          landlordSignature: null,
          tenantSignature: null,
        } as any);

      prisma.rentalContract.findFirst.mockResolvedValue(null);
      prisma.rentalContract.count.mockResolvedValue(1);

      prisma.$transaction.mockImplementation(async (callback) =>
        callback({
          rentalContract: {
            create: jest.fn().mockResolvedValue({ id: 'contract-999' }),
          },
          userContractMember: {
            createMany: jest.fn().mockResolvedValue({}),
          },
        }),
      );

      jest.spyOn(service, 'regenerateContractPdf').mockResolvedValue();

      const result = await service.renewContract(
        'contract-123',
        { renewalOption: 'keep_current' as any },
        user,
      );

      expect(result).toMatchObject({
        sourceContractId: 'contract-123',
        sourceContractNumber: 'CTR-2026-00001',
        extensionMonths: 12,
        renewalOption: 'keep_current',
      });

      expect(prisma.rentalContract.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            apartmentId: 'apt-123',
          }),
        }),
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(service.regenerateContractPdf).toHaveBeenCalledWith(
        'contract-999',
      );
    });

    it('should replace members with requester and memberNationalIds when renewalOption is customize', async () => {
      const user = mockUserJwtPayload();

      prisma.rentalContract.findUnique
        .mockResolvedValueOnce({
          id: 'contract-123',
          contractNumber: 'CTR-2026-00001',
          apartmentId: 'apt-123',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
          monthlyRent: 10000000,
          depositAmount: 20000000,
          paymentDueDay: 5,
          paymentMethod: 'bank_transfer',
          utilitiesIncluded: null,
          utilitiesCharges: null,
          contractTerms: null,
          specialConditions: null,
          status: ContractStatus.active,
          apartment: {
            id: 'apt-123',
            maxOccupants: 3,
          },
          members: [
            {
              userId: user.sub,
              memberType: 'primary',
              isPrimaryContact: true,
              sharePercentage: 60,
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          ...mockContract({
            id: 'contract-999',
            contractNumber: 'CTR-2026-00002',
          }),
          members: [{ user: { id: user.sub } }, { user: { id: 'user-456' } }],
          apartment: null,
          createdByStaff: null,
          invoices: [],
          contractPdfData: null,
          landlordSignature: null,
          tenantSignature: null,
        } as any);

      prisma.userIdentity.findFirst.mockResolvedValue({
        userId: 'user-456',
        user: {
          id: 'user-456',
          isActive: true,
          isVerified: true,
        },
      } as any);

      prisma.rentalContract.findFirst.mockResolvedValue(null);
      prisma.rentalContract.count.mockResolvedValue(1);

      const createMany = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation(async (callback) =>
        callback({
          rentalContract: {
            create: jest.fn().mockResolvedValue({ id: 'contract-999' }),
          },
          userContractMember: {
            createMany,
          },
        }),
      );

      jest.spyOn(service, 'regenerateContractPdf').mockResolvedValue();

      await service.renewContract(
        'contract-123',
        {
          renewalOption: 'customize' as any,
          extensionMonths: 6,
          memberNationalIds: ['079203001234'],
        },
        user,
      );

      expect(prisma.userIdentity.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ nationalId: '079203001234' }),
        }),
      );

      expect(createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ userId: user.sub }),
            expect.objectContaining({ userId: 'user-456' }),
          ]),
        }),
      );
    });
  });

  describe('activateWhenDepositPaid', () => {
    it('should activate contract when deposit invoice is paid', async () => {
      const contract = mockContract({
        status: ContractStatus.signed,
        apartmentId: 'apt-123',
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      });

      prisma.rentalContract.findUnique.mockResolvedValue({
        ...contract,
        apartment: { id: 'apt-123' },
      } as any);
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1' } as any);
      prisma.$transaction.mockResolvedValue([
        { ...contract, status: ContractStatus.active },
        {},
      ] as any);

      const result = await service.activateWhenDepositPaid('contract-123');

      expect(result[0].status).toBe(ContractStatus.active);
    });

    it('should reject activation when deposit invoice is not paid', async () => {
      const contract = mockContract({
        status: ContractStatus.signed,
        apartmentId: 'apt-123',
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      });

      prisma.rentalContract.findUnique.mockResolvedValue({
        ...contract,
        apartment: { id: 'apt-123' },
      } as any);
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.activateWhenDepositPaid('contract-123'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should upsert userApartment records when activating after deposit paid', async () => {
      const contract = mockContract({
        status: ContractStatus.signed,
        apartmentId: 'apt-123',
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      });

      prisma.rentalContract.findUnique.mockResolvedValue({
        ...contract,
        apartment: { id: 'apt-123' },
        members: [
          {
            userId: 'user-2',
            memberType: 'co_tenant',
            isPrimaryContact: false,
          },
        ],
      } as any);
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1' } as any);
      prisma.$transaction.mockResolvedValue([
        { ...contract, status: ContractStatus.active },
        {},
        {},
      ] as any);

      await service.activateWhenDepositPaid('contract-123');

      expect(prisma.userApartment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_apartmentId_rentalContractId: {
              userId: 'user-2',
              apartmentId: 'apt-123',
              rentalContractId: 'contract-123',
            },
          },
          create: expect.objectContaining({
            status: 'active',
            isPrimaryTenant: false,
          }),
          update: expect.objectContaining({
            status: 'active',
            moveOutDate: contract.endDate,
          }),
        }),
      );
    });
  });

  describe('autoActivateContractsWhenDepositPaid', () => {
    it('should auto-activate eligible contracts', async () => {
      prisma.rentalContract.updateMany.mockResolvedValue({ count: 0 } as any);
      prisma.rentalContract.findMany.mockResolvedValue([
        { id: 'contract-1' },
        { id: 'contract-2' },
      ] as any);

      const activateSpy = jest
        .spyOn(service, 'activateWhenDepositPaid')
        .mockResolvedValue([] as any);

      await service.autoActivateContractsWhenDepositPaid();

      expect(prisma.rentalContract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: [ContractStatus.pending, ContractStatus.signed],
            },
            invoices: {
              some: {
                invoiceType: 'contractDeposit',
                status: 'paid',
              },
            },
          }),
        }),
      );

      expect(activateSpy).toHaveBeenCalledTimes(2);
      expect(activateSpy).toHaveBeenNthCalledWith(1, 'contract-1');
      expect(activateSpy).toHaveBeenNthCalledWith(2, 'contract-2');
    });

    it('should continue processing when one activation fails', async () => {
      prisma.rentalContract.updateMany.mockResolvedValue({ count: 0 } as any);
      prisma.rentalContract.findMany.mockResolvedValue([
        { id: 'contract-1' },
        { id: 'contract-2' },
      ] as any);

      const loggerErrorSpy = jest.spyOn((service as any).logger, 'error');
      const activateSpy = jest
        .spyOn(service, 'activateWhenDepositPaid')
        .mockRejectedValueOnce(new Error('activation failed'))
        .mockResolvedValueOnce([] as any);

      await service.autoActivateContractsWhenDepositPaid();

      expect(activateSpy).toHaveBeenCalledTimes(2);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('contract-1'),
        expect.any(String),
      );
    });
  });
});
