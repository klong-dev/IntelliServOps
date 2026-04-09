import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseService } from './firebase.service';
import { CreateNotificationDto, RegisterFcmTokenDto } from './dto';
import { Prisma, DeliveryStatus, ActorType } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  // ============================================================================
  // FCM Token Management
  // ============================================================================

  async registerFcmToken(currentUser: JwtPayload, dto: RegisterFcmTokenDto) {
    const existing = await this.prisma.fcmToken.findUnique({
      where: { token: dto.token },
    });

    if (existing) {
      // Update ownership if token already exists (device switched users)
      return this.prisma.fcmToken.update({
        where: { token: dto.token },
        data: {
          actorType: currentUser.actorType,
          actorId: currentUser.sub,
          device: dto.device,
        },
        select: { id: true, token: true, device: true },
      });
    }

    return this.prisma.fcmToken.create({
      data: {
        actorType: currentUser.actorType,
        actorId: currentUser.sub,
        token: dto.token,
        device: dto.device,
      },
      select: { id: true, token: true, device: true },
    });
  }

  async removeFcmToken(currentUser: JwtPayload, token: string) {
    const existing = await this.prisma.fcmToken.findFirst({
      where: {
        token,
        actorType: currentUser.actorType,
        actorId: currentUser.sub,
      },
    });

    if (!existing) {
      throw new NotFoundException('FCM token not found');
    }

    await this.prisma.fcmToken.delete({ where: { id: existing.id } });
    return { message: 'Token removed' };
  }

  // ============================================================================
  // Create Notification + Push
  // ============================================================================

  /**
   * Create notification in DB and send FCM push to all recipient's devices.
   * Used internally by NotificationTriggers.
   */
  async createAndPush(dto: CreateNotificationDto) {
    const actionUrl = this.normalizeActionUrl(dto.actionUrl);

    // 1. Save to DB
    const notification = await this.prisma.notification.create({
      data: {
        recipientType: dto.recipientType,
        recipientId: dto.recipientId,
        notificationType: dto.notificationType ?? 'info',
        channel: dto.channel,
        title: dto.title,
        message: dto.message,
        actionUrl,
        actionLabel: dto.actionLabel,
        priority: dto.priority ?? 'medium',
        relatedEntityType: dto.relatedEntityType,
        relatedEntityId: dto.relatedEntityId,
        sentAt: new Date(),
        deliveryStatus: DeliveryStatus.pending,
      },
    });

    // 2. Fire-and-forget FCM push (don't block the HTTP response)
    if (dto.channel === 'push' || dto.channel === 'in_app') {
      this.pushToRecipient(
        notification.id,
        dto.recipientType,
        dto.recipientId,
        dto.title,
        dto.message,
        {
          notificationId: notification.id,
          type: dto.notificationType ?? 'info',
          actionUrl: actionUrl ?? '',
          relatedEntityType: dto.relatedEntityType ?? '',
          relatedEntityId: dto.relatedEntityId ?? '',
        },
      ).catch((error) => {
        this.logger.error(
          `FCM push failed for ${notification.id}: ${error.message}`,
        );
        this.prisma.notification
          .update({
            where: { id: notification.id },
            data: {
              deliveryStatus: DeliveryStatus.failed,
              failureReason: error.message,
            },
          })
          .catch(() => {}); // Swallow nested DB error
      });
    } else {
      // Non-push channels: mark as sent immediately
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { deliveryStatus: DeliveryStatus.sent },
      });
    }

    return this.stripNotificationActionUrl(notification);
  }

  /**
   * Create notifications for multiple recipients + push to all.
   * Used internally by NotificationTriggers for bulk notifications.
   */
  async createAndPushBulk(
    recipientType: ActorType,
    recipientIds: string[],
    notification: Omit<CreateNotificationDto, 'recipientType' | 'recipientId'>,
  ) {
    const results = await Promise.allSettled(
      recipientIds.map((recipientId) =>
        this.createAndPush({
          ...notification,
          recipientType,
          recipientId,
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(`Bulk push: ${succeeded} sent, ${failed} failed`);
    return { sentCount: succeeded, failedCount: failed };
  }

  // ============================================================================
  // Internal FCM Delivery
  // ============================================================================

  private async pushToRecipient(
    notificationId: string,
    recipientType: ActorType,
    recipientId: string,
    title: string,
    body: string,
    data: Record<string, string>,
  ) {
    // Get all FCM tokens for this recipient
    const tokens = await this.prisma.fcmToken.findMany({
      where: { actorType: recipientType, actorId: recipientId },
      select: { token: true },
    });

    if (tokens.length === 0) {
      this.logger.debug(`No FCM tokens for ${recipientType}:${recipientId}`);
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          deliveryStatus: DeliveryStatus.sent,
          failureReason: 'No FCM tokens registered',
        },
      });
      return;
    }

    const tokenList = tokens.map((t) => t.token);
    const results = await this.firebase.sendToMultipleDevices(
      tokenList,
      title,
      body,
      data,
    );

    const successCount = results.filter((r) => r.success).length;
    const failedTokens = results.filter((r) => !r.success).map((r) => r.token);

    // Clean up invalid tokens
    if (failedTokens.length > 0) {
      await this.prisma.fcmToken.deleteMany({
        where: { token: { in: failedTokens } },
      });
      this.logger.warn(`Removed ${failedTokens.length} invalid FCM tokens`);
    }

    // Update delivery status
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        deliveryStatus:
          successCount > 0 ? DeliveryStatus.delivered : DeliveryStatus.failed,
        failureReason:
          successCount === 0
            ? `All ${tokenList.length} FCM sends failed`
            : undefined,
      },
    });

    this.logger.debug(
      `Push ${notificationId}: ${successCount}/${tokenList.length} delivered`,
    );
  }

  // ============================================================================
  // Read / Query (unchanged from original)
  // ============================================================================

  async findMyNotifications(currentUser: JwtPayload, isRead?: boolean) {
    const where: Prisma.NotificationWhereInput = {
      recipientType: currentUser.actorType,
      recipientId: currentUser.sub,
    };

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    const notifications = await this.prisma.notification.findMany({
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
        deliveryStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return notifications.map((notification) =>
      this.stripNotificationActionUrl(notification),
    );
  }

  async countUnread(currentUser: JwtPayload) {
    const count = await this.prisma.notification.count({
      where: {
        recipientType: currentUser.actorType,
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
        recipientType: currentUser.actorType,
        recipientId: currentUser.sub,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
      select: { id: true, isRead: true, readAt: true },
    });
  }

  async markAllAsRead(currentUser: JwtPayload) {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientType: currentUser.actorType,
        recipientId: currentUser.sub,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    return { markedCount: result.count };
  }

  /**
   * REST-only create (admin/operator manual send via Swagger).
   */
  async create(createDto: CreateNotificationDto) {
    return this.createAndPush(createDto);
  }

  async findAll(recipientType?: ActorType) {
    const where: Prisma.NotificationWhereInput = {};
    if (recipientType) where.recipientType = recipientType;

    const notifications = await this.prisma.notification.findMany({
      where,
      select: {
        id: true,
        recipientType: true,
        recipientId: true,
        notificationType: true,
        channel: true,
        title: true,
        message: true,
        actionUrl: true,
        actionLabel: true,
        isRead: true,
        deliveryStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return notifications.map((notification) =>
      this.stripNotificationActionUrl(notification),
    );
  }

  private normalizeActionUrl(actionUrl?: string | null) {
    if (!actionUrl) {
      return undefined;
    }

    const trimmed = actionUrl.trim();
    if (!trimmed) {
      return undefined;
    }

    try {
      const absoluteUrl = new URL(trimmed);
      const normalizedPath = `${absoluteUrl.pathname}${absoluteUrl.search}${absoluteUrl.hash}`;
      return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
    } catch {
      return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    }
  }

  private mapNotificationActionUrl<T extends { actionUrl?: string | null }>(
    notification: T,
  ): T {
    return {
      ...notification,
      actionUrl: this.normalizeActionUrl(notification.actionUrl) ?? null,
    };
  }

  private stripNotificationActionUrl<T extends { actionUrl?: string | null }>(
    notification: T,
  ): Omit<T, 'actionUrl'> {
    const normalized = this.mapNotificationActionUrl(notification);
    const { actionUrl: _actionUrl, ...rest } = normalized;
    return rest;
  }
}
