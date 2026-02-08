import { Test, TestingModule } from '@nestjs/testing';
import { ActivityLogsService } from './activity-logs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils';
import { ActorType, ActivityStatus } from '@prisma/client';

describe('ActivityLogsService', () => {
  let service: ActivityLogsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const mockLog = (overrides = {}) => ({
    id: 'log-123',
    actorType: ActorType.user,
    actorId: 'user-123',
    action: 'login',
    entityType: 'session',
    entityId: 'session-123',
    description: 'User logged in',
    status: ActivityStatus.success,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivityLogsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ActivityLogsService>(ActivityLogsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('should return all logs', async () => {
      prisma.activityLog.findMany.mockResolvedValue([mockLog()] as any);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });

    it('should filter by actorType', async () => {
      prisma.activityLog.findMany.mockResolvedValue([]);
      await service.findAll({ actorType: ActorType.admin });
      expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ actorType: ActorType.admin }) })
      );
    });

    it('should filter by date range', async () => {
      prisma.activityLog.findMany.mockResolvedValue([]);
      await service.findAll({ startDate: '2026-01-01', endDate: '2026-01-31' });
      expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ createdAt: expect.any(Object) }) })
      );
    });
  });

  describe('findOne', () => {
    it('should return log by ID', async () => {
      prisma.activityLog.findUnique.mockResolvedValue(mockLog() as any);
      const result = await service.findOne('log-123');
      expect(result?.id).toBe('log-123');
    });
  });

  describe('log', () => {
    it('should create activity log', async () => {
      const dto = {
        actorType: ActorType.user,
        actorId: 'user-123',
        action: 'create_ticket',
        entityType: 'ticket',
        entityId: 'ticket-123',
      };
      prisma.activityLog.create.mockResolvedValue(mockLog(dto) as any);
      const result = await service.log(dto);
      expect(result.action).toBe('create_ticket');
    });
  });

  describe('logAction', () => {
    it('should log action with convenience method', async () => {
      prisma.activityLog.create.mockResolvedValue(mockLog() as any);
      const result = await service.logAction(ActorType.staff, 'staff-123', 'update_apartment', 'apartment', 'apt-123');
      expect(result).toBeDefined();
    });
  });
});
