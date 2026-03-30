import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import {
  NotificationType,
  NotificationChannel,
  Priority,
  ActorType,
} from '@prisma/client';

/**
 * Centralized notification triggers.
 *
 * WHY THIS FILE EXISTS:
 * Instead of injecting NotificationsService into every module (invoices, contracts,
 * maintenance, etc.), other modules just emit events using EventEmitter2:
 *
 *   this.eventEmitter.emit('invoice.created', { userId, invoiceId, amount });
 *
 * This file listens for those events and creates the appropriate notification.
 * To add a new notification type, just add a new @OnEvent method here.
 */
@Injectable()
export class NotificationTriggers {
  private readonly logger = new Logger(NotificationTriggers.name);

  constructor(private readonly notifications: NotificationsService) {}

  // ============================================================================
  // Invoice Events
  // ============================================================================

  @OnEvent('invoice.created')
  async onInvoiceCreated(payload: {
    userId: string;
    invoiceId: string;
    invoiceCode: string;
    totalAmount: number;
  }) {
    this.logger.log(`Trigger: invoice.created → ${payload.invoiceCode}`);

    await this.notifications.createAndPush({
      recipientType: ActorType.user,
      recipientId: payload.userId,
      notificationType: NotificationType.info,
      channel: NotificationChannel.push,
      title: 'Hóa đơn mới',
      message: `Hóa đơn ${payload.invoiceCode} - ${payload.totalAmount.toLocaleString('vi-VN')}đ đã được tạo.`,
      actionUrl: `/invoices/${payload.invoiceId}`,
      actionLabel: 'Xem hóa đơn',
      priority: Priority.medium,
      relatedEntityType: 'Invoice',
      relatedEntityId: payload.invoiceId,
    });
  }

  @OnEvent('invoice.paid')
  async onInvoicePaid(payload: {
    userId: string;
    invoiceId: string;
    invoiceCode: string;
  }) {
    this.logger.log(`Trigger: invoice.paid → ${payload.invoiceCode}`);

    await this.notifications.createAndPush({
      recipientType: ActorType.user,
      recipientId: payload.userId,
      notificationType: NotificationType.success,
      channel: NotificationChannel.push,
      title: 'Thanh toán thành công',
      message: `Hóa đơn ${payload.invoiceCode} đã được thanh toán.`,
      actionUrl: `/invoices/${payload.invoiceId}`,
      actionLabel: 'Xem hóa đơn',
      priority: Priority.medium,
      relatedEntityType: 'Invoice',
      relatedEntityId: payload.invoiceId,
    });
  }

  // ============================================================================
  // Contract Events
  // ============================================================================

  @OnEvent('contract.signed')
  async onContractSigned(payload: {
    userId: string;
    contractId: string;
    contractCode: string;
  }) {
    this.logger.log(`Trigger: contract.signed → ${payload.contractCode}`);

    await this.notifications.createAndPush({
      recipientType: ActorType.user,
      recipientId: payload.userId,
      notificationType: NotificationType.success,
      channel: NotificationChannel.push,
      title: 'Hợp đồng đã ký',
      message: `Hợp đồng ${payload.contractCode} đã được ký thành công.`,
      actionUrl: `/contracts/${payload.contractId}`,
      actionLabel: 'Xem hợp đồng',
      priority: Priority.high,
      relatedEntityType: 'Contract',
      relatedEntityId: payload.contractId,
    });
  }

  @OnEvent('contract.expiring_soon')
  async onContractExpiringSoon(payload: {
    userId: string;
    contractId: string;
    contractCode: string;
    daysLeft: number;
  }) {
    this.logger.log(
      `Trigger: contract.expiring_soon → ${payload.contractCode}`,
    );

    await this.notifications.createAndPush({
      recipientType: ActorType.user,
      recipientId: payload.userId,
      notificationType: NotificationType.warning,
      channel: NotificationChannel.push,
      title: 'Hợp đồng sắp hết hạn',
      message: `Hợp đồng ${payload.contractCode} sẽ hết hạn sau ${payload.daysLeft} ngày.`,
      actionUrl: `/contracts/${payload.contractId}`,
      actionLabel: 'Xem hợp đồng',
      priority: Priority.high,
      relatedEntityType: 'Contract',
      relatedEntityId: payload.contractId,
    });
  }

  // ============================================================================
  // Maintenance Events
  // ============================================================================

  @OnEvent('maintenance.status_changed')
  async onMaintenanceStatusChanged(payload: {
    userId: string;
    requestId: string;
    requestCode: string;
    newStatus: string;
  }) {
    this.logger.log(
      `Trigger: maintenance.status_changed → ${payload.requestCode}`,
    );

    const statusLabels: Record<string, string> = {
      in_progress: 'đang xử lý',
      completed: 'đã hoàn thành',
      cancelled: 'đã hủy',
    };

    await this.notifications.createAndPush({
      recipientType: ActorType.user,
      recipientId: payload.userId,
      notificationType:
        payload.newStatus === 'completed'
          ? NotificationType.success
          : NotificationType.info,
      channel: NotificationChannel.push,
      title: 'Cập nhật yêu cầu bảo trì',
      message: `Yêu cầu ${payload.requestCode} ${statusLabels[payload.newStatus] || payload.newStatus}.`,
      actionUrl: `/maintenance/${payload.requestId}`,
      actionLabel: 'Xem chi tiết',
      priority: Priority.medium,
      relatedEntityType: 'MaintenanceRequest',
      relatedEntityId: payload.requestId,
    });
  }

  // ============================================================================
  // Ticket Events
  // ============================================================================

  @OnEvent('ticket.replied')
  async onTicketReplied(payload: {
    userId: string;
    ticketId: string;
    ticketCode: string;
    staffName: string;
  }) {
    this.logger.log(`Trigger: ticket.replied → ${payload.ticketCode}`);

    await this.notifications.createAndPush({
      recipientType: ActorType.user,
      recipientId: payload.userId,
      notificationType: NotificationType.info,
      channel: NotificationChannel.push,
      title: 'Phản hồi ticket',
      message: `${payload.staffName} đã trả lời ticket ${payload.ticketCode}.`,
      actionUrl: `/tickets/${payload.ticketId}`,
      actionLabel: 'Xem phản hồi',
      priority: Priority.medium,
      relatedEntityType: 'Ticket',
      relatedEntityId: payload.ticketId,
    });
  }

  // ============================================================================
  // Chat Events
  // ============================================================================

  @OnEvent('chat.new_message')
  async onChatNewMessage(payload: {
    recipientType: ActorType;
    recipientId: string;
    senderName: string;
    conversationId: string;
    preview: string;
  }) {
    await this.notifications.createAndPush({
      recipientType: payload.recipientType,
      recipientId: payload.recipientId,
      notificationType: NotificationType.info,
      channel: NotificationChannel.push,
      title: `Tin nhắn từ ${payload.senderName}`,
      message:
        payload.preview.length > 80
          ? payload.preview.substring(0, 80) + '...'
          : payload.preview,
      actionUrl: `/chat/${payload.conversationId}`,
      actionLabel: 'Mở chat',
      priority: Priority.medium,
      relatedEntityType: 'ChatConversation',
      relatedEntityId: payload.conversationId,
    });
  }

  // ============================================================================
  // Staff Notifications (to staff/operator/admin)
  // ============================================================================

  @OnEvent('staff.new_maintenance_request')
  async onNewMaintenanceRequest(payload: {
    staffIds: string[];
    requestId: string;
    requestCode: string;
    userName: string;
    description: string;
  }) {
    this.logger.log(
      `Trigger: staff.new_maintenance_request → ${payload.requestCode}`,
    );

    await this.notifications.createAndPushBulk(
      ActorType.staff,
      payload.staffIds,
      {
        notificationType: NotificationType.info,
        channel: NotificationChannel.push,
        title: 'Yêu cầu bảo trì mới',
        message: `${payload.userName}: ${payload.description.length > 80 ? payload.description.substring(0, 80) + '...' : payload.description}`,
        actionUrl: `/maintenance/${payload.requestId}`,
        actionLabel: 'Xem yêu cầu',
        priority: Priority.high,
        relatedEntityType: 'MaintenanceRequest',
        relatedEntityId: payload.requestId,
      },
    );
  }

  @OnEvent('payment.received')
  async onPaymentReceived(payload: {
    staffIds: string[];
    paymentId: string;
    invoiceCode: string;
    amount: number;
    userName: string;
  }) {
    this.logger.log(`Trigger: payment.received → ${payload.invoiceCode}`);

    await this.notifications.createAndPushBulk(
      ActorType.staff,
      payload.staffIds,
      {
        notificationType: NotificationType.success,
        channel: NotificationChannel.push,
        title: 'Thanh toán mới',
        message: `${payload.userName} đã thanh toán ${payload.amount.toLocaleString('vi-VN')}đ cho hóa đơn ${payload.invoiceCode}.`,
        actionUrl: `/payments/${payload.paymentId}`,
        actionLabel: 'Xem thanh toán',
        priority: Priority.medium,
        relatedEntityType: 'Payment',
        relatedEntityId: payload.paymentId,
      },
    );
  }

  // ============================================================================
  // Viewing Request Events
  // ============================================================================

  @OnEvent('viewing_request.staff_assigned')
  async onViewingRequestStaffAssigned(payload: {
    staffId: string;
    contactRequestId?: string;
    appointmentId?: string;
    apartmentId: string;
    requesterName: string;
  }) {
    this.logger.log(
      `Trigger: viewing_request.staff_assigned -> ${payload.appointmentId ?? payload.contactRequestId}`,
    );

    await this.notifications.createAndPush({
      recipientType: ActorType.staff,
      recipientId: payload.staffId,
      notificationType: NotificationType.info,
      channel: NotificationChannel.push,
      title: 'Yeu cau xem can ho moi',
      message: `${payload.requesterName} vua tao lich xem can ho.`,
      actionUrl: payload.appointmentId
        ? `/viewing-requests/appointments/${payload.appointmentId}`
        : `/viewing-requests`,
      actionLabel: 'Xem chi tiet',
      priority: Priority.high,
      relatedEntityType: payload.appointmentId
        ? 'Appointment'
        : 'ContactRequest',
      relatedEntityId:
        payload.appointmentId ??
        payload.contactRequestId ??
        payload.apartmentId,
    });
  }

  @OnEvent('viewing_request.user_cancelled')
  async onViewingRequestUserCancelled(payload: {
    staffId: string;
    appointmentId: string;
  }) {
    this.logger.log(
      `Trigger: viewing_request.user_cancelled -> ${payload.appointmentId}`,
    );

    await this.notifications.createAndPush({
      recipientType: ActorType.staff,
      recipientId: payload.staffId,
      notificationType: NotificationType.warning,
      channel: NotificationChannel.push,
      title: 'Lich xem da bi huy',
      message: 'User da huy lich hen xem can ho.',
      actionUrl: `/viewing-requests/appointments/${payload.appointmentId}`,
      actionLabel: 'Xem lich hen',
      priority: Priority.medium,
      relatedEntityType: 'Appointment',
      relatedEntityId: payload.appointmentId,
    });
  }

  @OnEvent('viewing_request.confirmed_by_staff')
  async onViewingRequestConfirmedByStaff(payload: {
    userId: string;
    appointmentId: string;
    apartmentId: string;
  }) {
    this.logger.log(
      `Trigger: viewing_request.confirmed_by_staff -> ${payload.appointmentId}`,
    );

    await this.notifications.createAndPush({
      recipientType: ActorType.user,
      recipientId: payload.userId,
      notificationType: NotificationType.success,
      channel: NotificationChannel.push,
      title: 'Lich xem da duoc xac nhan',
      message: 'Nhan vien da xac nhan lich xem can ho cua ban.',
      actionUrl: `/viewing-requests/appointments/${payload.appointmentId}`,
      actionLabel: 'Xem lich hen',
      priority: Priority.high,
      relatedEntityType: 'Appointment',
      relatedEntityId: payload.appointmentId,
    });
  }

  @OnEvent('viewing_request.denied_by_staff')
  async onViewingRequestDeniedByStaff(payload: {
    userId: string;
    appointmentId: string;
    apartmentId: string;
    reason?: string;
  }) {
    this.logger.log(
      `Trigger: viewing_request.denied_by_staff -> ${payload.appointmentId}`,
    );

    await this.notifications.createAndPush({
      recipientType: ActorType.user,
      recipientId: payload.userId,
      notificationType: NotificationType.warning,
      channel: NotificationChannel.push,
      title: 'Lich xem da bi tu choi',
      message: payload.reason?.trim()
        ? `Nhan vien da tu choi lich xem: ${payload.reason.trim()}`
        : 'Nhan vien da tu choi lich xem can ho cua ban.',
      actionUrl: `/viewing-requests/appointments/${payload.appointmentId}`,
      actionLabel: 'Xem lich hen',
      priority: Priority.high,
      relatedEntityType: 'Appointment',
      relatedEntityId: payload.appointmentId,
    });
  }
}
