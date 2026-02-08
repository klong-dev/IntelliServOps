import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { mockNotification, mockUserJwtPayload } from '../../test-utils';
import { CreateNotificationDto } from './dto';
import { ActorType } from '@prisma/client';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: NotificationsService;

  const mockNotificationsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    notificationsService = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all notifications for current user', async () => {
      const currentUser = mockUserJwtPayload();
      const notifications = [
        mockNotification({ actorId: currentUser.sub }),
        mockNotification({ actorId: currentUser.sub, id: 'notif-2' }),
      ];
      mockNotificationsService.findAll.mockResolvedValue(notifications);

      const result = await controller.findAll(currentUser);

      expect(result).toEqual(notifications);
      expect(notificationsService.findAll).toHaveBeenCalledWith(currentUser);
    });
  });

  describe('findOne', () => {
    it('should return notification by ID', async () => {
      const notification = mockNotification();
      mockNotificationsService.findOne.mockResolvedValue(notification);

      const result = await controller.findOne(notification.id);

      expect(result).toEqual(notification);
      expect(notificationsService.findOne).toHaveBeenCalledWith(notification.id);
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

    it('should create new notification', async () => {
      const createdNotification = mockNotification(createDto);
      mockNotificationsService.create.mockResolvedValue(createdNotification);

      const result = await controller.create(createDto);

      expect(result).toEqual(createdNotification);
      expect(notificationsService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const notification = mockNotification({ isRead: true, readAt: new Date() });
      mockNotificationsService.markAsRead.mockResolvedValue(notification);

      const result = await controller.markAsRead('notif-123');

      expect(result).toEqual(notification);
      expect(result.isRead).toBe(true);
      expect(notificationsService.markAsRead).toHaveBeenCalledWith('notif-123');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for current user', async () => {
      const currentUser = mockUserJwtPayload();
      const updateResult = { count: 5 };
      mockNotificationsService.markAllAsRead.mockResolvedValue(updateResult);

      const result = await controller.markAllAsRead(currentUser);

      expect(result).toEqual(updateResult);
      expect(notificationsService.markAllAsRead).toHaveBeenCalledWith(currentUser);
    });
  });

  describe('remove', () => {
    it('should delete notification', async () => {
      const notification = mockNotification();
      mockNotificationsService.remove.mockResolvedValue(notification);

      const result = await controller.remove('notif-123');

      expect(result).toEqual(notification);
      expect(notificationsService.remove).toHaveBeenCalledWith('notif-123');
    });
  });
});
