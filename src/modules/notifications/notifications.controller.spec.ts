import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { mockUserJwtPayload } from '../../test-utils';
import { ActorType } from '@prisma/client';

describe('NotificationsController', () => {
  let controller: NotificationsController;

  const mockNotificationsService = {
    findMyNotifications: jest.fn(),
    countUnread: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };

  const mockNotification = (overrides = {}) => ({
    id: 'notif-123',
    recipientType: ActorType.user,
    recipientId: 'user-123',
    title: 'Test Notification',
    message: 'Test message',
    isRead: false,
    readAt: null,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    jest.clearAllMocks();
  });

  describe('findMyNotifications', () => {
    it('should return notifications for current user', async () => {
      const currentUser = mockUserJwtPayload();
      const notifications = [mockNotification({ recipientId: currentUser.sub })];
      mockNotificationsService.findMyNotifications.mockResolvedValue(notifications);

      const result = await controller.findMyNotifications(currentUser);

      expect(result).toEqual(notifications);
      expect(mockNotificationsService.findMyNotifications).toHaveBeenCalledWith(currentUser, undefined);
    });

    it('should filter by read status', async () => {
      const currentUser = mockUserJwtPayload();
      mockNotificationsService.findMyNotifications.mockResolvedValue([]);

      await controller.findMyNotifications(currentUser, 'true');

      expect(mockNotificationsService.findMyNotifications).toHaveBeenCalledWith(currentUser, true);
    });
  });

  describe('countUnread', () => {
    it('should return unread count', async () => {
      const currentUser = mockUserJwtPayload();
      mockNotificationsService.countUnread.mockResolvedValue({ unreadCount: 5 });

      const result = await controller.countUnread(currentUser);

      expect(result).toEqual({ unreadCount: 5 });
    });
  });

  describe('findAll', () => {
    it('should return all notifications (admin)', async () => {
      const notifications = [mockNotification()];
      mockNotificationsService.findAll.mockResolvedValue(notifications);

      const result = await controller.findAll();

      expect(result).toEqual(notifications);
    });

    it('should filter by recipientType', async () => {
      mockNotificationsService.findAll.mockResolvedValue([]);

      await controller.findAll(ActorType.user);

      expect(mockNotificationsService.findAll).toHaveBeenCalledWith(ActorType.user);
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
      mockNotificationsService.create.mockResolvedValue(created);

      const result = await controller.create(createDto);

      expect(result).toBeDefined();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const currentUser = mockUserJwtPayload();
      const readNotif = { id: 'notif-123', isRead: true, readAt: new Date() };
      mockNotificationsService.markAsRead.mockResolvedValue(readNotif);

      const result = await controller.markAsRead('notif-123', currentUser);

      expect(result.isRead).toBe(true);
      expect(mockNotificationsService.markAsRead).toHaveBeenCalledWith('notif-123', currentUser);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      const currentUser = mockUserJwtPayload();
      mockNotificationsService.markAllAsRead.mockResolvedValue({ markedCount: 5 });

      const result = await controller.markAllAsRead(currentUser);

      expect(result).toEqual({ markedCount: 5 });
    });
  });
});
