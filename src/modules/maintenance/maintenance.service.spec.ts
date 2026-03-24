import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  createPrismaMock,
  mockUserJwtPayload,
  mockStaffJwtPayload,
  mockAdminJwtPayload,
} from '../../test-utils';
import { CreateMaintenanceDto, UpdateMaintenanceDto } from './dto';
import { MaintenanceStatus, Urgency } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const mockMaintenanceRequest = (overrides = {}) => ({
    id: 'maint-123',
    title: 'Leaking Faucet',
    description: 'Bathroom faucet is leaking',
    category: 'plumbing',
    urgency: Urgency.medium,
    status: MaintenanceStatus.submitted,
    userId: 'user-123',
    apartmentId: 'apt-123',
    rentalContractId: 'contract-123',
    roomId: null,
    images: [],
    preferredDate: null,
    completedAt: null,
    completionNotes: null,
    actualCost: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all maintenance requests for admin', async () => {
      const admin = mockAdminJwtPayload();
      const requests = [
        mockMaintenanceRequest(),
        mockMaintenanceRequest({ id: 'maint-124' }),
      ];
      prisma.maintenanceRequest.findMany.mockResolvedValue(requests as any);

      const result = await service.findAll(admin);

      expect(result).toEqual(requests);
      expect(prisma.maintenanceRequest.findMany).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object),
        orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      });
    });

    it('should return only user own requests', async () => {
      const user = mockUserJwtPayload();
      const requests = [mockMaintenanceRequest({ userId: user.sub })];
      prisma.maintenanceRequest.findMany.mockResolvedValue(requests as any);

      const result = await service.findAll(user);

      expect(result).toEqual(requests);
      expect(prisma.maintenanceRequest.findMany).toHaveBeenCalledWith({
        where: { userId: user.sub },
        select: expect.any(Object),
        orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      });
    });

    it('should filter by status', async () => {
      const admin = mockAdminJwtPayload();
      const requests = [
        mockMaintenanceRequest({ status: MaintenanceStatus.completed }),
      ];
      prisma.maintenanceRequest.findMany.mockResolvedValue(requests as any);

      const result = await service.findAll(admin, MaintenanceStatus.completed);

      expect(result).toEqual(requests);
      expect(prisma.maintenanceRequest.findMany).toHaveBeenCalledWith({
        where: { status: MaintenanceStatus.completed },
        select: expect.any(Object),
        orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
      });
    });
  });

  describe('findOne', () => {
    it('should return maintenance request by ID', async () => {
      const request = mockMaintenanceRequest();
      prisma.maintenanceRequest.findUnique.mockResolvedValue(request as any);

      const result = await service.findOne('maint-123');

      expect(result).toEqual(request);
      expect(prisma.maintenanceRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'maint-123' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.maintenanceRequest.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const createDto: CreateMaintenanceDto = {
      apartmentId: 'apt-123',
      title: 'Broken AC',
      description: 'AC not cooling',
      category: 'hvac' as any,
      priority: 'high' as any,
      images: [],
    };

    it('should create maintenance request with active contract', async () => {
      const user = mockUserJwtPayload();
      const activeContract = { id: 'contract-123', apartmentId: 'apt-123' };
      const createdRequest = mockMaintenanceRequest(createDto);

      prisma.rentalContract.findFirst.mockResolvedValue(activeContract as any);
      prisma.maintenanceRequest.create.mockResolvedValue(createdRequest as any);

      const result = await service.create(createDto, user);

      expect(result).toEqual(createdRequest);
      expect(prisma.rentalContract.findFirst).toHaveBeenCalledWith({
        where: {
          apartmentId: createDto.apartmentId,
          members: { some: { userId: user.sub } },
          status: 'active',
        },
      });
      expect(prisma.maintenanceRequest.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if no active contract for user', async () => {
      const user = mockUserJwtPayload();
      prisma.rentalContract.findFirst.mockResolvedValue(null);

      await expect(service.create(createDto, user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create request without contract check for staff', async () => {
      const staff = mockStaffJwtPayload();
      const createdRequest = mockMaintenanceRequest(createDto);

      prisma.rentalContract.findFirst.mockResolvedValue(null);
      prisma.maintenanceRequest.create.mockResolvedValue(createdRequest as any);

      const result = await service.create(createDto, staff);

      expect(result).toEqual(createdRequest);
    });

    it('should include roomId if provided', async () => {
      const user = mockUserJwtPayload();
      const dtoWithRoom = { ...createDto, roomId: 'room-123' };
      const activeContract = { id: 'contract-123' };

      prisma.rentalContract.findFirst.mockResolvedValue(activeContract as any);
      prisma.maintenanceRequest.create.mockResolvedValue(
        mockMaintenanceRequest() as any,
      );

      await service.create(dtoWithRoom, user);

      expect(prisma.maintenanceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            room: { connect: { id: 'room-123' } },
          }),
        }),
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateMaintenanceDto = {
      status: MaintenanceStatus.in_progress,
      priority: 'urgent' as any,
      scheduledDate: '2026-02-10',
    };

    it('should update maintenance request', async () => {
      const request = mockMaintenanceRequest();
      const updated = { ...request, status: MaintenanceStatus.in_progress };

      prisma.maintenanceRequest.findUnique.mockResolvedValue(request as any);
      prisma.maintenanceRequest.update.mockResolvedValue(updated as any);

      const result = await service.update('maint-123', updateDto);

      expect(result).toEqual(updated);
      expect(prisma.maintenanceRequest.update).toHaveBeenCalledWith({
        where: { id: 'maint-123' },
        data: expect.objectContaining({
          status: MaintenanceStatus.in_progress,
        }),
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException if request not found', async () => {
      prisma.maintenanceRequest.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update cost if provided', async () => {
      const request = mockMaintenanceRequest();
      const dtoWithCost = { cost: 150000 };

      prisma.maintenanceRequest.findUnique.mockResolvedValue(request as any);
      prisma.maintenanceRequest.update.mockResolvedValue(request as any);

      await service.update('maint-123', dtoWithCost);

      expect(prisma.maintenanceRequest.update).toHaveBeenCalledWith({
        where: { id: 'maint-123' },
        data: expect.objectContaining({
          actualCost: 150000,
        }),
        select: expect.any(Object),
      });
    });
  });

  describe('complete', () => {
    it('should complete maintenance request', async () => {
      const request = mockMaintenanceRequest();
      const completed = {
        ...request,
        status: MaintenanceStatus.completed,
        completedAt: new Date(),
      };

      prisma.maintenanceRequest.update.mockResolvedValue(completed as any);

      const result = await service.complete(
        'maint-123',
        'Fixed successfully',
        200000,
      );

      expect(result.status).toBe(MaintenanceStatus.completed);
      expect(prisma.maintenanceRequest.update).toHaveBeenCalledWith({
        where: { id: 'maint-123' },
        data: {
          status: MaintenanceStatus.completed,
          completedAt: expect.any(Date),
          completionNotes: 'Fixed successfully',
          actualCost: 200000,
        },
      });
    });

    it('should complete without cost', async () => {
      const completed = {
        ...mockMaintenanceRequest(),
        status: MaintenanceStatus.completed,
      };

      prisma.maintenanceRequest.update.mockResolvedValue(completed as any);

      await service.complete('maint-123', 'Fixed successfully');

      expect(prisma.maintenanceRequest.update).toHaveBeenCalledWith({
        where: { id: 'maint-123' },
        data: expect.objectContaining({
          actualCost: undefined,
        }),
      });
    });
  });
});
