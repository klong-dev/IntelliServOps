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
    registerFcmToken: jest.fn(),
    removeFcmToken: jest.fn(),
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
  });

  describe('countUnread', () => {
    it('should return unread count', async () => {
      const currentUser = mockUserJwtPayload();
      mockNotificationsService.countUnread.mockResolvedValue({ unreadCount: 5 });

      const result = await controller.countUnread(currentUser);

      expect(result).toEqual({ unreadCount: 5 });
    });
  });

  describe('create', () => {
    it('should create notification', async () => {
      const createDto = {
        recipientType: ActorType.user,
        recipientId: 'user-123',
        notificationType: 'info' as any,
        channel: 'push' as any,
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

  describe('registerFcmToken', () => {
    it('should register FCM token', async () => {
      const currentUser = mockUserJwtPayload();
      const dto = { token: 'fcm-token-123', device: 'iPhone 15' };
      mockNotificationsService.registerFcmToken.mockResolvedValue({
        id: 'token-id',
        token: dto.token,
        device: dto.device,
      });

      const result = await controller.registerFcmToken(currentUser, dto);

      expect(result.token).toEqual(dto.token);
      expect(mockNotificationsService.registerFcmToken).toHaveBeenCalledWith(currentUser, dto);
    });
  });

  describe('removeFcmToken', () => {
    it('should remove FCM token', async () => {
      const currentUser = mockUserJwtPayload();
      const dto = { token: 'fcm-token-123' };
      mockNotificationsService.removeFcmToken.mockResolvedValue({ message: 'Token removed' });

      const result = await controller.removeFcmToken(currentUser, dto);

      expect(result).toEqual({ message: 'Token removed' });
    });
  });
});
