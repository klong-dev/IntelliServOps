import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  InvoiceStatus,
  TicketAction,
  TicketStatus,
  TicketType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../auth/auth.service';
import { IoTService } from '../iot/iot.service';
import { ContractsService } from '../contracts/contracts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ResolveTicketDto, TicketListQueryDto } from './dto';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ioTService: IoTService,
    private readonly contractsService: ContractsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(currentUser: JwtPayload, query: TicketListQueryDto = {}) {
    this.assertStaff(currentUser);
    return this.prisma.ticket.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: true,
        rentalContract: { select: { id: true, contractNumber: true } },
        apartment: { select: { id: true, apartmentNumber: true } },
        resolvedByStaff: { select: { id: true, fullName: true } },
      },
    });
  }

  async findOne(id: string, currentUser: JwtPayload) {
    this.assertStaff(currentUser);
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        invoice: true,
        rentalContract: { select: { id: true, contractNumber: true } },
        apartment: { select: { id: true, apartmentNumber: true } },
        resolvedByStaff: { select: { id: true, fullName: true } },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async resolve(
    id: string,
    dto: ResolveTicketDto,
    imageUrls: string[],
    currentUser: JwtPayload,
  ) {
    this.assertStaff(currentUser);
    if (!dto.note?.trim()) throw new BadRequestException('note is required');
    if (!imageUrls.length) throw new BadRequestException('images are required');

    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { invoice: true, rentalContract: true, apartment: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status !== TicketStatus.open) {
      throw new ConflictException('Ticket is not open');
    }
    if (!ticket.invoiceId || !ticket.apartmentId) {
      throw new BadRequestException(
        'Ticket is not linked to a rent overdue invoice',
      );
    }
    if (
      ticket.type === TicketType.rent_overdue_recovery &&
      dto.action !== TicketAction.tenant_left
    ) {
      throw new BadRequestException(
        'Recovery ticket only supports tenant_left',
      );
    }

    const now = new Date();
    if (dto.action === TicketAction.tenant_left) {
      await this.contractsService.terminateContractForfeitDeposit(
        ticket.rentalContractId,
        `Rent overdue ticket ${ticket.ticketNumber}: ${dto.note.trim()}`,
        { actorType: currentUser.actorType, actorId: currentUser.sub },
      );
    } else if (dto.action === TicketAction.tenant_stays) {
      const graceUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      await this.prisma.invoice.update({
        where: { id: ticket.invoiceId },
        data: {
          rentOverdueGraceUntil: graceUntil,
          rentOverdueGraceCount: { increment: 1 },
        },
      });
      await this.ioTService.resumeBoardsForApartment(ticket.apartmentId);
      await this.notifyMembers(
        ticket.invoiceId,
        'Gia hạn thanh toán tiền nhà được duyệt',
        'Quyền truy cập IoT đã được khôi phục trong 3 ngày. Vui lòng hoàn tất thanh toán.',
      );
    } else {
      throw new BadRequestException('Unsupported ticket action');
    }

    return this.prisma.ticket.update({
      where: { id },
      data: {
        status: TicketStatus.resolved,
        resolutionAction: dto.action,
        resolutionNote: dto.note.trim(),
        resolutionImages: imageUrls,
        resolvedByStaffId: currentUser.sub,
        resolvedAt: now,
        closedAt: now,
      },
    });
  }

  private assertStaff(currentUser: JwtPayload) {
    if (currentUser.actorType !== 'staff') {
      throw new ForbiddenException('Only staff can access tickets');
    }
  }

  private async notifyMembers(
    invoiceId: string,
    title: string,
    message: string,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        rentalContract: { select: { members: { select: { userId: true } } } },
      },
    });
    await Promise.allSettled(
      (invoice?.rentalContract.members ?? []).map((member) =>
        this.notificationsService.createAndPush({
          recipientType: ActorType.user,
          recipientId: member.userId,
          notificationType: 'warning',
          channel: 'in_app',
          priority: 'high',
          title,
          message,
          actionUrl: `/invoices/${invoiceId}`,
          actionLabel: 'Xem hóa đơn',
          relatedEntityType: 'Invoice',
          relatedEntityId: invoiceId,
        }),
      ),
    );
  }
}
