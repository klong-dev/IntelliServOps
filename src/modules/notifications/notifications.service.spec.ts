import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, mockUserJwtPayload, MockPrisma } from '../../test-utils';
import { ActorType, DeliveryStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: MockPrisma;

  const mockNotification = (overrides = {}) => ({
    id: 'notif-123',
    recipientType: ActorType.user,
    recipientId: 'user-123',
    notificationType: 'general',
    channel: 'in_app',
    title: 'Test Notification',
    message: 'Test message',
    isRead: false,
    readAt: null,
    deliveryStatus: DeliveryStatus.sent,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findMyNotifications', () => {
    it('should return notifications for current user', async () => {
      const user = mockUserJwtPayload();
      const notifications = [mockNotification({ recipientId: user.sub })];
      prisma.notification.findMany.mockResolvedValue(notifications as any);

      const result = await service.findMyNotifications(user);

      expect(result).toEqual(notifications);
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { recipientType: user.actorType, recipientId: user.sub },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should filter by read status', async () => {
      const user = mockUserJwtPayload();
      prisma.notification.findMany.mockResolvedValue([]);

      await service.findMyNotifications(user, false);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { recipientType: user.actorType, recipientId: user.sub, isRead: false },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('countUnread', () => {
    it('should return unread count', async () => {
      const user = mockUserJwtPayload();
      prisma.notification.count.mockResolvedValue(5);

      const result = await service.countUnread(user);

      expect(result).toEqual({ unreadCount: 5 });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const user = mockUserJwtPayload();
      const notification = mockNotification({ recipientId: user.sub });
      const readNotif = { id: notification.id, isRead: true, readAt: new Date() };

      prisma.notification.findFirst.mockResolvedValue(notification as any);
      prisma.notification.update.mockResolvedValue(readNotif as any);

      const result = await service.markAsRead(notification.id, user);

      expect(result.isRead).toBe(true);
    });

    it('should throw NotFoundException if not found', async () => {
      const user = mockUserJwtPayload();
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead('non-existent', user)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const user = mockUserJwtPayload();
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead(user);

      expect(result).toEqual({ markedCount: 5 });
    });
  });

  describe('create', () => {
    it('should create notification', async () => {
      const createDto = {
        recipientType: ActorType.user,
        recipientId: 'user-123',
        notificationType: 'general' as any,
        channel: 'in_app' as any,
        title: 'Test',
        message: 'Test message',
      };
      const created = mockNotification();
      prisma.notification.create.mockResolvedValue(created as any);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return all notifications', async () => {
      const notifications = [mockNotification()];
      prisma.notification.findMany.mockResolvedValue(notifications as any);

      const result = await service.findAll();

      expect(result).toEqual(notifications);
    });

    it('should filter by recipientType', async () => {
      prisma.notification.findMany.mockResolvedValue([]);

      await service.findAll(ActorType.user);

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { recipientType: ActorType.user },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });
  });
});
