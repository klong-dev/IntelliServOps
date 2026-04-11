import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMaintenanceDto, MaintenanceHistoryQueryDto } from './dto';
import {
  MaintenanceStatus,
  Urgency,
  Prisma,
  StaffRole,
  TaskStatus,
  TaskType,
  Priority,
  ActorType,
} from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import axios from 'axios';

type WardLookupResponse = {
  name?: string;
  district_name?: string;
  province_name?: string;
};

type WardAddressInfo = {
  wardName: string | null;
  provinceName: string | null;
  fullAddress: string | null;
};

@Injectable()
export class MaintenanceService {
  private readonly provincesBaseUrl = 'https://provinces.open-api.vn';
  private readonly wardAddressCache = new Map<number, WardAddressInfo | null>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private normalizeWardName(value: string | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async resolveWardAddressFromWardCode(
    wardCode: number,
  ): Promise<WardAddressInfo | null> {
    if (this.wardAddressCache.has(wardCode)) {
      return this.wardAddressCache.get(wardCode) ?? null;
    }

    try {
      const response = await axios.get<WardLookupResponse>(
        `${this.provincesBaseUrl}/api/v2/w/${wardCode}`,
        { timeout: 15000 },
      );

      const data = response.data;
      const wardName = this.normalizeWardName(data.name);
      const districtName = this.normalizeWardName(data.district_name);
      const provinceName = this.normalizeWardName(data.province_name);

      const fullAddressParts = [wardName, districtName, provinceName].filter(
        (part): part is string => typeof part === 'string',
      );

      const address: WardAddressInfo = {
        wardName,
        provinceName,
        fullAddress:
          fullAddressParts.length > 0 ? fullAddressParts.join(', ') : null,
      };

      this.wardAddressCache.set(wardCode, address);
      return address;
    } catch {
      this.wardAddressCache.set(wardCode, null);
      return null;
    }
  }

  private async resolveWardAddressMap(
    wardCodes: Array<number | null | undefined>,
  ): Promise<Map<number, WardAddressInfo | null>> {
    const uniqueWardCodes = Array.from(
      new Set(
        wardCodes.filter((code): code is number => typeof code === 'number'),
      ),
    );

    const resolvedEntries = await Promise.all(
      uniqueWardCodes.map(async (wardCode) => {
        return [
          wardCode,
          await this.resolveWardAddressFromWardCode(wardCode),
        ] as const;
      }),
    );

    return new Map<number, WardAddressInfo | null>(resolvedEntries);
  }

  private mapMaintenanceApartmentWithAddress(
    apartment: {
      apartmentNumber: string;
      wardCode: number | null;
      streetAddress: string | null;
    },
    wardAddress: WardAddressInfo | null,
  ) {
    return {
      ...apartment,
      wardName: wardAddress?.wardName ?? null,
      provinceName: wardAddress?.provinceName ?? null,
      fullAddress: wardAddress?.fullAddress ?? null,
      address: apartment.streetAddress ?? wardAddress?.fullAddress ?? null,
    };
  }

  private mapUrgencyToTaskPriority(urgency: Urgency): Priority {
    switch (urgency) {
      case Urgency.low:
        return Priority.low;
      case Urgency.medium:
        return Priority.medium;
      case Urgency.high:
        return Priority.high;
      case Urgency.emergency:
        return Priority.urgent;
      default:
        return Priority.medium;
    }
  }

  private async findBestMaintenanceStaffId(): Promise<string> {
    const maintenanceStaff = await this.prisma.staff.findMany({
      where: {
        role: StaffRole.maintenance,
        isActive: true,
      },
      select: { id: true },
    });

    if (!maintenanceStaff.length) {
      throw new BadRequestException(
        'No active maintenance staff available for assignment',
      );
    }

    const staffIds = maintenanceStaff.map((staff) => staff.id);
    const activeTasks = await this.prisma.task.findMany({
      where: {
        assignedToStaffId: { in: staffIds },
        status: {
          in: [TaskStatus.pending, TaskStatus.assigned, TaskStatus.in_progress],
        },
      },
      select: {
        assignedToStaffId: true,
      },
    });

    const loadMap = new Map<string, number>(
      staffIds.map((staffId) => [staffId, 0]),
    );

    for (const task of activeTasks) {
      if (!task.assignedToStaffId) {
        continue;
      }
      loadMap.set(
        task.assignedToStaffId,
        (loadMap.get(task.assignedToStaffId) ?? 0) + 1,
      );
    }

    const sorted = [...staffIds].sort((a, b) => {
      const diff = (loadMap.get(a) ?? 0) - (loadMap.get(b) ?? 0);
      if (diff !== 0) {
        return diff;
      }
      return a.localeCompare(b);
    });

    return sorted[0];
  }

  private ensureStaffAccess(request: any, currentUser: JwtPayload): void {
    if (currentUser.actorType !== 'staff') {
      throw new ForbiddenException('Only staff can perform this action');
    }

    const assignedTo = request.assignedTask?.assignedToStaffId ?? null;
    if (assignedTo !== currentUser.sub) {
      throw new ForbiddenException('This request is not assigned to you');
    }
  }

  async findAll(currentUser: JwtPayload, status?: MaintenanceStatus) {
    const where: Prisma.MaintenanceRequestWhereInput = {};

    if (status) {
      where.status = status;
    }

    // Users see only their own requests
    if (currentUser.actorType === 'user') {
      where.userId = currentUser.sub;
    }

    if (currentUser.actorType === 'staff') {
      where.assignedTask = {
        assignedToStaffId: currentUser.sub,
      };
    }

    const items = await this.prisma.maintenanceRequest.findMany({
      where,
      select: {
        id: true,
        title: true,
        category: true,
        urgency: true,
        status: true,
        tenantRating: true,
        createdAt: true,
        preferredDate: true,
        apartment: {
          select: {
            apartmentNumber: true,
            wardCode: true,
            streetAddress: true,
          },
        },
        assignedTask: {
          select: {
            id: true,
            assignedToStaffId: true,
            status: true,
          },
        },
      },
      orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
    });

    const wardAddressMap = await this.resolveWardAddressMap(
      items.map((item) => item.apartment.wardCode),
    );

    return items.map((item) => {
      const wardAddress =
        typeof item.apartment.wardCode === 'number'
          ? (wardAddressMap.get(item.apartment.wardCode) ?? null)
          : null;

      const { tenantRating, ...rest } = item;
      return {
        ...rest,
        isRated: tenantRating !== null,
        apartment: this.mapMaintenanceApartmentWithAddress(
          item.apartment,
          wardAddress,
        ),
      };
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

    if (currentUser.actorType === 'staff') {
      where.assignedTask = {
        assignedToStaffId: currentUser.sub,
      };
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
          tenantRating: true,
          createdAt: true,
          completedAt: true,
          updatedAt: true,
          apartment: {
            select: {
              apartmentNumber: true,
              wardCode: true,
              streetAddress: true,
            },
          },
          room: {
            select: {
              roomNumber: true,
              roomType: true,
            },
          },
          assignedTask: {
            select: {
              id: true,
              assignedToStaffId: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    const wardAddressMap = await this.resolveWardAddressMap(
      items.map((item) => item.apartment.wardCode),
    );

    const enrichedItems = items.map((item) => {
      const wardAddress =
        typeof item.apartment.wardCode === 'number'
          ? (wardAddressMap.get(item.apartment.wardCode) ?? null)
          : null;

      const { tenantRating, ...rest } = item;
      return {
        ...rest,
        isRated: tenantRating !== null,
        apartment: this.mapMaintenanceApartmentWithAddress(
          item.apartment,
          wardAddress,
        ),
      };
    });

    return {
      items: enrichedItems,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findOne(id: string, currentUser?: JwtPayload) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        apartment: {
          select: {
            apartmentNumber: true,
            wardCode: true,
            streetAddress: true,
          },
        },
        room: {
          select: { roomNumber: true, roomType: true },
        },
        user: {
          select: { id: true, fullName: true, phone: true },
        },
        assignedTask: {
          select: {
            id: true,
            assignedToStaffId: true,
            status: true,
            assignedToStaff: {
              select: {
                id: true,
                fullName: true,
                employeeCode: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    if (!currentUser) {
      return request;
    }

    if (
      currentUser.actorType === 'user' &&
      request.userId !== currentUser.sub
    ) {
      throw new NotFoundException('Maintenance request not found');
    }

    if (
      currentUser.actorType === 'staff' &&
      request.assignedTask?.assignedToStaffId !== currentUser.sub
    ) {
      throw new NotFoundException('Maintenance request not found');
    }

    const wardAddress =
      typeof request.apartment.wardCode === 'number'
        ? await this.resolveWardAddressFromWardCode(request.apartment.wardCode)
        : null;

    return {
      ...request,
      isRated: request.tenantRating !== null,
      apartment: this.mapMaintenanceApartmentWithAddress(
        request.apartment,
        wardAddress,
      ),
    };
  }

  async create(createDto: CreateMaintenanceDto, currentUser: JwtPayload) {
    if (currentUser.actorType !== 'user') {
      throw new ForbiddenException(
        'Only users can create maintenance requests',
      );
    }

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

    const assignedStaffId = await this.findBestMaintenanceStaffId();
    const urgency = (createDto.priority as Urgency) || Urgency.medium;

    const created = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          title: `Maintenance: ${createDto.title}`,
          description: createDto.description,
          taskType: TaskType.maintenance,
          priority: this.mapUrgencyToTaskPriority(urgency),
          status: TaskStatus.assigned,
          assignedToStaff: { connect: { id: assignedStaffId } },
          apartment: { connect: { id: createDto.apartmentId } },
          attachments: createDto.images as any,
        },
        select: { id: true },
      });

      return tx.maintenanceRequest.create({
        data: {
          apartment: { connect: { id: createDto.apartmentId } },
          user: { connect: { id: currentUser.sub } },
          rentalContract: { connect: { id: activeContract!.id } },
          ...(createDto.roomId && {
            room: { connect: { id: createDto.roomId } },
          }),
          assignedTask: { connect: { id: task.id } },
          title: createDto.title,
          description: createDto.description,
          category: createDto.category,
          urgency,
          images: createDto.images as any,
          status: MaintenanceStatus.submitted,
        },
        select: {
          id: true,
          title: true,
          status: true,
          urgency: true,
          assignedTaskId: true,
        },
      });
    });

    await this.notificationsService.createAndPush({
      recipientType: ActorType.staff,
      recipientId: assignedStaffId,
      title: 'Yeu cau bao tri moi',
      message: `Yeu cau "${createDto.title}" da duoc giao cho ban.`,
      channel: 'in_app',
      priority: 'high',
      notificationType: 'info',
      actionUrl: `/maintenance/${created.id}`,
      actionLabel: 'Xem chi tiet',
      relatedEntityType: 'MaintenanceRequest',
      relatedEntityId: created.id,
    });

    return created;
  }

  async accept(id: string, currentUser: JwtPayload, note?: string) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        assignedTask: {
          select: {
            id: true,
            assignedToStaffId: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    this.ensureStaffAccess(request, currentUser);

    if (request.status === MaintenanceStatus.cancelled) {
      throw new ConflictException('Cancelled request cannot be accepted');
    }

    if (request.status === MaintenanceStatus.completed) {
      throw new ConflictException('Completed request cannot be accepted');
    }

    const result = await this.prisma.$transaction([
      this.prisma.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceStatus.in_progress,
          ...(note !== undefined ? { completionNotes: note } : {}),
        },
        select: {
          id: true,
          title: true,
          status: true,
        },
      }),
      ...(request.assignedTask?.id
        ? [
            this.prisma.task.update({
              where: { id: request.assignedTask.id },
              data: {
                status: TaskStatus.in_progress,
              },
            }),
          ]
        : []),
    ]);

    return result[0];
  }

  async reject(
    id: string,
    currentUser: JwtPayload,
    reason: string,
    images?: string[],
  ) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        assignedTask: {
          select: {
            id: true,
            assignedToStaffId: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    this.ensureStaffAccess(request, currentUser);

    if (request.status === MaintenanceStatus.completed) {
      throw new ConflictException('Completed request cannot be rejected');
    }

    const result = await this.prisma.$transaction([
      this.prisma.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceStatus.cancelled,
          completionNotes: reason,
          completionImages: images as any,
          completedAt: new Date(),
        },
        select: {
          id: true,
          title: true,
          status: true,
        },
      }),
      ...(request.assignedTask?.id
        ? [
            this.prisma.task.update({
              where: { id: request.assignedTask.id },
              data: {
                status: TaskStatus.cancelled,
                completionNotes: reason,
                attachments: images as any,
              },
            }),
          ]
        : []),
    ]);

    return result[0];
  }

  async complete(
    id: string,
    currentUser: JwtPayload,
    resolutionNotes: string,
    cost?: number,
    completionImages?: string[],
  ) {
    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        assignedTask: {
          select: {
            id: true,
            assignedToStaffId: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    this.ensureStaffAccess(request, currentUser);

    if (
      request.status !== MaintenanceStatus.in_progress &&
      request.status !== MaintenanceStatus.acknowledged &&
      request.status !== MaintenanceStatus.scheduled
    ) {
      throw new ConflictException('Request is not in a completable status');
    }

    const result = await this.prisma.$transaction([
      this.prisma.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceStatus.completed,
          completedAt: new Date(),
          completionNotes: resolutionNotes,
          completionImages: completionImages as any,
          actualCost: cost,
        },
      }),
      ...(request.assignedTask?.id
        ? [
            this.prisma.task.update({
              where: { id: request.assignedTask.id },
              data: {
                status: TaskStatus.completed,
                completionNotes: resolutionNotes,
              },
            }),
          ]
        : []),
    ]);

    await this.notificationsService.createAndPush({
      recipientType: ActorType.user,
      recipientId: request.userId,
      title: 'Yeu cau bao tri da hoan tat',
      message: 'Vui long danh gia chat luong ho tro cua nhan vien bao tri.',
      channel: 'in_app',
      priority: 'high',
      notificationType: 'info',
      actionUrl: `/maintenance/${id}`,
      actionLabel: 'Danh gia ngay',
      relatedEntityType: 'MaintenanceRequest',
      relatedEntityId: id,
    });

    return result[0];
  }

  async rate(
    id: string,
    currentUser: JwtPayload,
    rating: number,
    feedback?: string,
  ) {
    if (currentUser.actorType !== 'user') {
      throw new ForbiddenException('Only users can rate maintenance support');
    }

    const request = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        tenantRating: true,
        title: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    if (request.userId !== currentUser.sub) {
      throw new NotFoundException('Maintenance request not found');
    }

    if (request.status !== MaintenanceStatus.completed) {
      throw new ConflictException('Only completed requests can be rated');
    }

    if (request.tenantRating !== null) {
      throw new ConflictException('This maintenance request was already rated');
    }

    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        tenantRating: rating,
        tenantFeedback: feedback,
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });
  }
}
