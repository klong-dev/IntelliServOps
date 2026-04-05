import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
  MaintenanceHistoryQueryDto,
} from './dto';
import { MaintenanceStatus, Urgency, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: JwtPayload, status?: MaintenanceStatus) {
    const where: Prisma.MaintenanceRequestWhereInput = {};

    if (status) {
      where.status = status;
    }

    // Users see only their own requests
    if (currentUser.actorType === 'user') {
      where.userId = currentUser.sub;
    }

    return this.prisma.maintenanceRequest.findMany({
      where,
      select: {
        id: true,
        title: true,
        category: true,
        urgency: true,
        status: true,
        createdAt: true,
        preferredDate: true,
        apartment: {
          select: {
            apartmentNumber: true,
            wardCode: true,
          },
        },
      },
      orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findHistory(
    currentUser: JwtPayload,
    query: MaintenanceHistoryQueryDto,
  ) {
    const { status, fromDate, toDate, page = 1, limit = 20 } = query;
    const safeLimit = Math.min(limit, 100);

    const where: Prisma.MaintenanceRequestWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (fromDate || toDate) {
      where.createdAt = {
        ...(fromDate ? { gte: new Date(fromDate) } : {}),
        ...(toDate ? { lte: new Date(toDate) } : {}),
      };
    }

    if (currentUser.actorType === 'user') {
      where.userId = currentUser.sub;
    }

    const skip = (page - 1) * safeLimit;

    const [items, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where,
        select: {
          id: true,
          title: true,
          category: true,
          urgency: true,
          status: true,
          createdAt: true,
          completedAt: true,
          updatedAt: true,
          apartment: {
            select: {
              apartmentNumber: true,
              wardCode: true,
            },
          },
          room: {
            select: {
              roomNumber: true,
              roomType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findOne(id: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        apartment: {
          select: {
            apartmentNumber: true,
            wardCode: true,
          },
        },
        room: {
          select: { roomNumber: true, roomType: true },
        },
        user: {
          select: { id: true, fullName: true, phone: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    return request;
  }

  async create(createDto: CreateMaintenanceDto, currentUser: JwtPayload) {
    // Need both userId and rentalContractId - get the active contract
    const activeContract = await this.prisma.rentalContract.findFirst({
      where: {
        apartmentId: createDto.apartmentId,
        members: { some: { userId: currentUser.sub } },
        status: 'active',
      },
    });

    if (!activeContract && currentUser.actorType === 'user') {
      throw new NotFoundException(
        'No active contract found for this apartment',
      );
    }

    return this.prisma.maintenanceRequest.create({
      data: {
        apartment: { connect: { id: createDto.apartmentId } },
        user: { connect: { id: currentUser.sub } },
        rentalContract: { connect: { id: activeContract?.id } },
        ...(createDto.roomId && {
          room: { connect: { id: createDto.roomId } },
        }),
        title: createDto.title,
        description: createDto.description,
        category: createDto.category,
        urgency: (createDto.priority as Urgency) || Urgency.medium,
        images: createDto.images as any,
        status: MaintenanceStatus.submitted,
      },
      select: {
        id: true,
        title: true,
        status: true,
        urgency: true,
      },
    });
  }

  async update(id: string, updateDto: UpdateMaintenanceDto) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    const data: any = {};

    if (updateDto.status) {
      data.status = updateDto.status;
    }

    if (updateDto.priority) {
      data.urgency = updateDto.priority;
    }

    if (updateDto.scheduledDate) {
      data.preferredDate = new Date(updateDto.scheduledDate);
    }

    if (updateDto.completedAt) {
      data.completedAt = new Date(updateDto.completedAt);
    }

    if (updateDto.resolutionNotes) {
      data.completionNotes = updateDto.resolutionNotes;
    }

    if (updateDto.cost !== undefined) {
      data.actualCost = updateDto.cost;
    }

    return this.prisma.maintenanceRequest.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        status: true,
      },
    });
  }

  async complete(id: string, resolutionNotes: string, cost?: number) {
    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceStatus.completed,
        completedAt: new Date(),
        completionNotes: resolutionNotes,
        actualCost: cost,
      },
    });
  }
}
