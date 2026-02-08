import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, mockNotification, mockUserJwtPayload, MockPrisma } from '../../test-utils';
import { CreateNotificationDto } from './dto';
import { ActorType } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all notifications for an actor', async () => {
      const userJwt = mockUserJwtPayload();
      const notifications = [mockNotification({ actorId: userJwt.sub }), mockNotification({ actorId: userJwt.sub, id: 'notif-2' })];
      prisma.notification.findMany.mockResolvedValue(notifications);

      const result = await service.findAll(userJwt);

      expect(result).toEqual(notifications);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { actorType: userJwt.actorType, actorId: userJwt.sub },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return notification by ID', async () => {
      const notification = mockNotification();
      prisma.notification.findUnique.mockResolvedValue(notification);

      const result = await service.findOne(notification.id);

      expect(result).toEqual(notification);
    });

    it('should return null if notification not found', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    const createDto: CreateNotificationDto = {
      actorType: ActorType.user,
      actorId: 'user-123',
      title: 'Test Notification',
      message: 'Test message',
      type: 'info' as any,
    };

    it('should create notification successfully', async () => {
      const createdNotification = mockNotification(createDto);
      prisma.notification.create.mockResolvedValue(createdNotification);

      const result = await service.create(createDto);

      expect(result).toEqual(createdNotification);
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: createDto,
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notification = mockNotification();
      const readNotification = { ...notification, isRead: true, readAt: new Date() };
      prisma.notification.update.mockResolvedValue(readNotification);

      const result = await service.markAsRead(notification.id);

      expect(result.isRead).toBe(true);
      expect(result.readAt).toBeDefined();
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: notification.id },
        data: { isRead: true, readAt: expect.any(Date) },
      });
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for an actor', async () => {
      const userJwt = mockUserJwtPayload();
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead(userJwt);

      expect(result).toEqual({ count: 5 });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          actorType: userJwt.actorType,
          actorId: userJwt.sub,
          isRead: false,
        },
        data: { isRead: true, readAt: expect.any(Date) },
      });
    });
  });

  describe('remove', () => {
    it('should delete notification', async () => {
      const notification = mockNotification();
      prisma.notification.delete.mockResolvedValue(notification);

      const result = await service.remove(notification.id);

      expect(result).toEqual(notification);
      expect(prisma.notification.delete).toHaveBeenCalledWith({
        where: { id: notification.id },
      });
    });
  });
});
