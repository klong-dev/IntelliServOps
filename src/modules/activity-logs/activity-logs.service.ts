import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateActivityLogDto } from './dto';
import { Prisma, ActorType, ActivityStatus } from '@prisma/client';

@Injectable()
export class ActivityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters?: {
    actorType?: ActorType;
    actorId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: Prisma.ActivityLogWhereInput = {};

    if (filters?.actorType) where.actorType = filters.actorType;
    if (filters?.actorId) where.actorId = filters.actorId;
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.entityId) where.entityId = filters.entityId;
    if (filters?.action)
      where.action = { contains: filters.action, mode: 'insensitive' };

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    return this.prisma.activityLog.findMany({
      where,
      select: {
        id: true,
        actorType: true,
        actorId: true,
        action: true,
        entityType: true,
        entityId: true,
        description: true,
        status: true,
        ipAddress: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string) {
    return this.prisma.activityLog.findUnique({
      where: { id },
    });
  }

  /**
   * Log an activity. Used programmatically by other services.
   */
  async log(dto: CreateActivityLogDto) {
    return this.prisma.activityLog.create({
      data: {
        actorType: dto.actorType,
        actorId: dto.actorId,
        action: dto.action,
        entityType: dto.entityType,
        entityId: dto.entityId,
        description: dto.description,
        changes: dto.changes,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        requestId: dto.requestId,
        status: dto.status ?? ActivityStatus.success,
        errorMessage: dto.errorMessage,
        metadata: dto.metadata,
      },
    });
  }

  /**
   * Convenience: log from JWT payload + request context
   */
  async logAction(
    actorType: ActorType,
    actorId: string,
    action: string,
    entityType?: string,
    entityId?: string,
    description?: string,
    changes?: any,
  ) {
    return this.prisma.activityLog.create({
      data: {
        actorType,
        actorId,
        action,
        entityType,
        entityId,
        description,
        changes,
        status: ActivityStatus.success,
      },
    });
  }
}
