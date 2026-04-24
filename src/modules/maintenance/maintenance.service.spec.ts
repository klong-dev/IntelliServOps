import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  createPrismaMock,
  mockUserJwtPayload,
  mockStaffJwtPayload,
  mockAdminJwtPayload,
} from '../../test-utils';
import { CreateMaintenanceDto, UpdateMaintenanceDto } from './dto';
import { MaintenanceStatus, Urgency } from '@prisma/client';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let prisma: ReturnType<typeof createPrismaMock>;
  const notificationsService = {
    createAndPush: jest.fn(),
  };

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
        {
          provide: NotificationsService,
          useValue: notificationsService,
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

    it('should return only assigned requests for staff', async () => {
      const staff = mockStaffJwtPayload();
      prisma.maintenanceRequest.findMany.mockResolvedValue([] as any);

      await service.findAll(staff);

      expect(prisma.maintenanceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            assignedTask: {
              assignedToStaffId: staff.sub,
            },
          },
        }),
      );
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

  describe('findHistory', () => {
    it('should return paginated maintenance history for admin', async () => {
      const admin = mockAdminJwtPayload();
      const items = [
        mockMaintenanceRequest(),
        mockMaintenanceRequest({ id: 'm2' }),
      ];

      prisma.maintenanceRequest.findMany.mockResolvedValue(items as any);
      prisma.maintenanceRequest.count.mockResolvedValue(2);

      const result = await service.findHistory(admin, { page: 1, limit: 10 });

      expect(result).toEqual({
        items,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(prisma.maintenanceRequest.findMany).toHaveBeenCalledWith({
        where: {},
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(prisma.maintenanceRequest.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    it('should apply user scope and filters when querying history', async () => {
      const user = mockUserJwtPayload();
      const fromDate = '2026-01-01T00:00:00.000Z';
      const toDate = '2026-01-31T23:59:59.999Z';

      prisma.maintenanceRequest.findMany.mockResolvedValue([] as any);
      prisma.maintenanceRequest.count.mockResolvedValue(0);

      await service.findHistory(user, {
        status: MaintenanceStatus.completed,
        fromDate,
        toDate,
        page: 2,
        limit: 5,
      });

      expect(prisma.maintenanceRequest.findMany).toHaveBeenCalledWith({
        where: {
          status: MaintenanceStatus.completed,
          userId: user.sub,
          createdAt: {
            gte: new Date(fromDate),
            lte: new Date(toDate),
          },
        },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 5,
        take: 5,
      });
    });

    it('should cap limit at 100', async () => {
      const admin = mockAdminJwtPayload();

      prisma.maintenanceRequest.findMany.mockResolvedValue([] as any);
      prisma.maintenanceRequest.count.mockResolvedValue(0);

      const result = await service.findHistory(admin, { page: 1, limit: 500 });

      expect(prisma.maintenanceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 100,
        }),
      );
      expect(result.limit).toBe(100);
    });
  });

  describe('findOne', () => {
    it('should return maintenance request by ID', async () => {
      const admin = mockAdminJwtPayload();
      const request = mockMaintenanceRequest();
      prisma.maintenanceRequest.findUnique.mockResolvedValue(request as any);

      const result = await service.findOne('maint-123', admin);

      expect(result).toEqual(request);
      expect(prisma.maintenanceRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'maint-123' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if not found', async () => {
      const admin = mockAdminJwtPayload();
      prisma.maintenanceRequest.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent', admin)).rejects.toThrow(
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
      const createdRequest = {
        id: 'maint-123',
        title: createDto.title,
        status: MaintenanceStatus.submitted,
        urgency: Urgency.high,
        assignedTaskId: 'task-123',
      };

      prisma.rentalContract.findFirst.mockResolvedValue(activeContract as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff-maint-1' }] as any);
      prisma.task.findMany.mockResolvedValue([] as any);
      prisma.$transaction.mockImplementation(async (callback) =>
        callback({
          task: {
            create: jest.fn().mockResolvedValue({ id: 'task-123' }),
          },
          maintenanceRequest: {
            create: jest.fn().mockResolvedValue(createdRequest),
          },
        }),
      );

      const result = await service.create(createDto, user);

      expect(result).toEqual(createdRequest);
      expect(prisma.rentalContract.findFirst).toHaveBeenCalledWith({
        where: {
          apartmentId: createDto.apartmentId,
          members: { some: { userId: user.sub } },
          status: 'active',
        },
      });
      expect(notificationsService.createAndPush).toHaveBeenCalled();
    });

    it('should throw NotFoundException if no active contract for user', async () => {
      const user = mockUserJwtPayload();
      prisma.rentalContract.findFirst.mockResolvedValue(null);

      await expect(service.create(createDto, user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject create request for staff', async () => {
      const staff = mockStaffJwtPayload();

      await expect(service.create(createDto, staff)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should ignore roomId if provided', async () => {
      const user = mockUserJwtPayload();
      const dtoWithRoom = { ...createDto, roomId: 'room-123' };
      const activeContract = { id: 'contract-123' };
      const createMaintenanceRequest = jest
        .fn()
        .mockResolvedValue(mockMaintenanceRequest());

      prisma.rentalContract.findFirst.mockResolvedValue(activeContract as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff-maint-1' }] as any);
      prisma.task.findMany.mockResolvedValue([] as any);
      prisma.$transaction.mockImplementation(async (callback) =>
        callback({
          task: {
            create: jest.fn().mockResolvedValue({ id: 'task-123' }),
          },
          maintenanceRequest: {
            create: createMaintenanceRequest,
          },
        }),
      );

      await service.create(dtoWithRoom, user);

      expect(createMaintenanceRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            room: expect.anything(),
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
      const staff = mockStaffJwtPayload();
      const request = mockMaintenanceRequest();
      const completed = {
        ...request,
        status: MaintenanceStatus.completed,
        completedAt: new Date(),
      };

      prisma.maintenanceRequest.findUnique.mockResolvedValue({
        id: 'maint-123',
        userId: 'user-123',
        status: MaintenanceStatus.in_progress,
        assignedTask: {
          id: 'task-123',
          assignedToStaffId: staff.sub,
        },
      } as any);
      prisma.$transaction.mockResolvedValue([completed, {}] as any);

      const result = await service.complete(
        'maint-123',
        staff,
        'Fixed successfully',
        200000,
      );

      expect(result.status).toBe(MaintenanceStatus.completed);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(notificationsService.createAndPush).toHaveBeenCalled();
    });

    it('should complete without cost', async () => {
      const staff = mockStaffJwtPayload();
      const completed = {
        ...mockMaintenanceRequest(),
        status: MaintenanceStatus.completed,
      };

      prisma.maintenanceRequest.findUnique.mockResolvedValue({
        id: 'maint-123',
        userId: 'user-123',
        status: MaintenanceStatus.in_progress,
        assignedTask: {
          id: 'task-123',
          assignedToStaffId: staff.sub,
        },
      } as any);
      prisma.$transaction.mockResolvedValue([completed, {}] as any);

      await service.complete('maint-123', staff, 'Fixed successfully');

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
