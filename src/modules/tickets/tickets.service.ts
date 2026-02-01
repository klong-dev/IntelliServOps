import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTicketDto, UpdateTicketDto } from './dto';
import { TicketStatus, Priority, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: JwtPayload, status?: TicketStatus) {
    const where: Prisma.TicketWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (currentUser.actorType === 'user') {
      where.userId = currentUser.sub;
    }

    if (currentUser.actorType === 'staff') {
      where.assignedToStaffId = currentUser.sub;
    }

    return this.prisma.ticket.findMany({
      where,
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        user: {
          select: { fullName: true },
        },
        assignedToStaff: {
          select: { fullName: true },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
        assignedToStaff: {
          select: { id: true, fullName: true },
        },
        rentalContract: {
          select: {
            contractNumber: true,
            apartment: { select: { apartmentNumber: true, address: true } },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  async create(createDto: CreateTicketDto, currentUser: JwtPayload) {
    // Ticket requires rentalContractId - if not provided and user, get their active contract
    let rentalContractId = createDto.rentalContractId;

    if (!rentalContractId && currentUser.actorType === 'user') {
      const activeContract = await this.prisma.rentalContract.findFirst({
        where: {
          members: { some: { userId: currentUser.sub } },
          status: 'active',
        },
      });

      if (!activeContract) {
        throw new BadRequestException('No active contract found. Please provide rentalContractId.');
      }
      rentalContractId = activeContract.id;
    }

    if (!rentalContractId) {
      throw new BadRequestException('rentalContractId is required');
    }

    const ticketNumber = await this.generateTicketNumber();

    return this.prisma.ticket.create({
      data: {
        ticketNumber,
        subject: createDto.subject,
        description: createDto.description,
        category: createDto.category,
        priority: (createDto.priority as Priority) || Priority.medium,
        status: TicketStatus.open,
        user: { connect: { id: currentUser.sub } },
        rentalContract: { connect: { id: rentalContractId } },
      },
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
      },
    });
  }

  async update(id: string, updateDto: UpdateTicketDto) {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const data: any = {};

    if (updateDto.status) {
      data.status = updateDto.status;
    }

    if (updateDto.priority) {
      data.priority = updateDto.priority as Priority;
    }

    if (updateDto.assignedToStaffId) {
      data.assignedToStaff = { connect: { id: updateDto.assignedToStaffId } };
    }

    if (updateDto.resolutionNotes) {
      data.resolutionNotes = updateDto.resolutionNotes;
    }

    if (updateDto.status === TicketStatus.resolved) {
      data.resolvedAt = new Date();
    }

    if (updateDto.status === TicketStatus.closed) {
      data.closedAt = new Date();
    }

    return this.prisma.ticket.update({
      where: { id },
      data,
      select: {
        id: true,
        ticketNumber: true,
        status: true,
      },
    });
  }

  async assign(id: string, staffId: string) {
    return this.prisma.ticket.update({
      where: { id },
      data: {
        assignedToStaff: { connect: { id: staffId } },
        status: TicketStatus.in_progress,
      },
    });
  }

  async resolve(id: string, resolutionNotes: string) {
    return this.prisma.ticket.update({
      where: { id },
      data: {
        status: TicketStatus.resolved,
        resolutionNotes,
        resolvedAt: new Date(),
      },
    });
  }

  async close(id: string) {
    return this.prisma.ticket.update({
      where: { id },
      data: {
        status: TicketStatus.closed,
        closedAt: new Date(),
      },
    });
  }

  private async generateTicketNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.ticket.count({
      where: { ticketNumber: { startsWith: `TKT-${year}` } },
    });
    return `TKT-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
