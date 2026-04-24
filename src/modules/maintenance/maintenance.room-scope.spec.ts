import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { createPrismaMock, mockAdminJwtPayload, mockUserJwtPayload } from '../../test-utils';
import { MaintenanceStatus, Urgency } from '@prisma/client';

describe('MaintenanceService room scope', () => {
  let service: MaintenanceService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const notificationsService = {
    createAndPush: jest.fn(),
  };

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);
    jest.clearAllMocks();
  });

  it('ignores roomId when creating a maintenance request', async () => {
    const user = mockUserJwtPayload();
    const createMaintenanceRequest = jest.fn().mockResolvedValue({
      id: 'maint-123',
      title: 'Broken AC',
      status: MaintenanceStatus.submitted,
      urgency: Urgency.high,
      assignedTaskId: 'task-123',
    });

    prisma.rentalContract.findFirst.mockResolvedValue({
      id: 'contract-123',
      apartmentId: 'apt-123',
    } as any);
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

    await service.create(
      {
        apartmentId: 'apt-123',
        roomId: 'room-legacy-123',
        title: 'Broken AC',
        description: 'AC not cooling',
        category: 'hvac' as any,
        priority: 'high' as any,
        images: [],
      },
      user,
    );

    expect(createMaintenanceRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          room: expect.anything(),
        }),
      }),
    );
  });

  it('omits room fields from maintenance detail responses', async () => {
    prisma.maintenanceRequest.findUnique.mockResolvedValue({
      id: 'maint-123',
      userId: 'user-123',
      rentalContractId: 'contract-123',
      apartmentId: 'apt-123',
      roomId: 'room-legacy-123',
      title: 'Broken AC',
      description: 'AC not cooling',
      category: 'hvac',
      urgency: Urgency.medium,
      status: MaintenanceStatus.submitted,
      images: [],
      completionImages: [],
      tenantRating: null,
      preferredDate: null,
      preferredTimeSlot: null,
      isTenantPresentRequired: false,
      assignedTaskId: 'task-123',
      completionNotes: null,
      tenantFeedback: null,
      costEstimate: null,
      actualCost: null,
      costCoveredBy: null,
      completedAt: null,
      createdAt: new Date('2026-04-24T00:00:00.000Z'),
      updatedAt: new Date('2026-04-24T00:00:00.000Z'),
      apartment: {
        apartmentNumber: 'A101',
        wardCode: null,
        streetAddress: '123 Nguyen Hue',
      },
      room: {
        roomNumber: 'R01',
        roomType: 'bedroom',
      },
      user: {
        id: 'user-123',
        fullName: 'Nguyen Van A',
        phone: '0901234567',
      },
      assignedTask: {
        id: 'task-123',
        assignedToStaffId: 'staff-123',
        status: 'assigned',
        assignedToStaff: {
          id: 'staff-123',
          fullName: 'Staff One',
          employeeCode: 'EMP001',
        },
      },
    } as any);

    const result = await service.findOne('maint-123', mockAdminJwtPayload());

    expect(result).not.toHaveProperty('roomId');
    expect(result).not.toHaveProperty('room');
    expect(result).toMatchObject({
      id: 'maint-123',
      apartmentId: 'apt-123',
      apartment: {
        apartmentNumber: 'A101',
        streetAddress: '123 Nguyen Hue',
      },
    });
  });
});
