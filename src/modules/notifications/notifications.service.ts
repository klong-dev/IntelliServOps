import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotificationDto } from './dto';
import { Prisma, DeliveryStatus, ActorType } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMyNotifications(currentUser: JwtPayload, isRead?: boolean) {
    const where: Prisma.NotificationWhereInput = {
      recipientType: currentUser.actorType as ActorType,
      recipientId: currentUser.sub,
    };

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    return this.prisma.notification.findMany({
      where,
      select: {
        id: true,
        notificationType: true,
        channel: true,
        title: true,
        message: true,
        actionUrl: true,
        actionLabel: true,
        priority: true,
        isRead: true,
        readAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async countUnread(currentUser: JwtPayload) {
    const count = await this.prisma.notification.count({
      where: {
        recipientType: currentUser.actorType as ActorType,
        recipientId: currentUser.sub,
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  async markAsRead(id: string, currentUser: JwtPayload) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        recipientType: currentUser.actorType as ActorType,
        recipientId: currentUser.sub,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
      select: { id: true, isRead: true, readAt: true },
    });
  }

  async markAllAsRead(currentUser: JwtPayload) {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientType: currentUser.actorType as ActorType,
        recipientId: currentUser.sub,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { markedCount: result.count };
  }

  async create(createDto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        recipientType: createDto.recipientType,
        recipientId: createDto.recipientId,
        notificationType: createDto.notificationType,
        channel: createDto.channel,
        title: createDto.title,
        message: createDto.message,
        actionUrl: createDto.actionUrl,
        actionLabel: createDto.actionLabel,
        priority: createDto.priority,
        relatedEntityType: createDto.relatedEntityType,
        relatedEntityId: createDto.relatedEntityId,
        sentAt: new Date(),
        deliveryStatus: DeliveryStatus.sent,
      },
      select: {
        id: true,
        title: true,
        channel: true,
        deliveryStatus: true,
        createdAt: true,
      },
    });
  }

  /**
   * Send notification to multiple recipients (used by other services)
   */
  async sendBulk(
    recipientType: ActorType,
    recipientIds: string[],
    notification: Omit<CreateNotificationDto, 'recipientType' | 'recipientId'>,
  ) {
    const data = recipientIds.map((recipientId) => ({
      recipientType,
      recipientId,
      notificationType: notification.notificationType,
      channel: notification.channel,
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl,
      actionLabel: notification.actionLabel,
      priority: notification.priority,
      relatedEntityType: notification.relatedEntityType,
      relatedEntityId: notification.relatedEntityId,
      sentAt: new Date(),
      deliveryStatus: DeliveryStatus.sent,
    }));

    const result = await this.prisma.notification.createMany({ data });
    return { sentCount: result.count };
  }

  async findAll(recipientType?: ActorType) {
    const where: Prisma.NotificationWhereInput = {};
    if (recipientType) where.recipientType = recipientType;

    return this.prisma.notification.findMany({
      where,
      select: {
        id: true,
        recipientType: true,
        recipientId: true,
        notificationType: true,
        channel: true,
        title: true,
        message: true,
        isRead: true,
        deliveryStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
