import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto } from './dto';
import { TaskStatus, Priority, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: JwtPayload, status?: TaskStatus) {
    const where: Prisma.TaskWhereInput = {};

    if (status) where.status = status;

    // Staff only sees their assigned tasks
    if (currentUser.actorType === 'staff') {
      where.assignedToStaffId = currentUser.sub;
    }

    // Operator sees tasks they assigned + unassigned
    if (currentUser.actorType === 'operator') {
      where.OR = [
        { assignedByOperatorId: currentUser.sub },
        { assignedToStaffId: null },
      ];
    }

    return this.prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        taskType: true,
        priority: true,
        status: true,
        scheduledDate: true,
        createdAt: true,
        assignedToStaff: {
          select: { id: true, fullName: true },
        },
        assignedByOperator: {
          select: { id: true, fullName: true },
        },
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            wardCode: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { scheduledDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignedToStaff: {
          select: { id: true, fullName: true, phone: true, email: true },
        },
        assignedByOperator: {
          select: { id: true, fullName: true },
        },
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            wardCode: true,
          },
        },
        maintenanceRequest: {
          select: { id: true, title: true, status: true, category: true },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async create(createDto: CreateTaskDto, currentUser: JwtPayload) {
    const data: Prisma.TaskCreateInput = {
      title: createDto.title,
      description: createDto.description,
      taskType: createDto.taskType,
      priority: createDto.priority ?? Priority.medium,
      status: TaskStatus.pending,
      scheduledDate: createDto.scheduledDate
        ? new Date(createDto.scheduledDate)
        : undefined,
      scheduledTime: createDto.scheduledTime
        ? new Date(`1970-01-01T${createDto.scheduledTime}`)
        : undefined,
      estimatedDurationMins: createDto.estimatedDurationMins,
      relatedEntityType: createDto.relatedEntityType,
      relatedEntityId: createDto.relatedEntityId,
    };

    if (createDto.assignedToStaffId) {
      data.assignedToStaff = { connect: { id: createDto.assignedToStaffId } };
      data.status = TaskStatus.assigned;
    }

    if (currentUser.actorType === 'operator') {
      data.assignedByOperator = { connect: { id: currentUser.sub } };
    }

    if (createDto.apartmentId) {
      data.apartment = { connect: { id: createDto.apartmentId } };
    }

    return this.prisma.task.create({
      data,
      select: {
        id: true,
        title: true,
        taskType: true,
        priority: true,
        status: true,
        scheduledDate: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, updateDto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id } });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const data: any = {};

    if (updateDto.title) data.title = updateDto.title;
    if (updateDto.description !== undefined)
      data.description = updateDto.description;
    if (updateDto.priority) data.priority = updateDto.priority;
    if (updateDto.status) data.status = updateDto.status;
    if (updateDto.scheduledDate)
      data.scheduledDate = new Date(updateDto.scheduledDate);
    if (updateDto.estimatedDurationMins !== undefined)
      data.estimatedDurationMins = updateDto.estimatedDurationMins;
    if (updateDto.completionNotes)
      data.completionNotes = updateDto.completionNotes;

    if (updateDto.assignedToStaffId) {
      data.assignedToStaff = { connect: { id: updateDto.assignedToStaffId } };
      if (!updateDto.status) data.status = TaskStatus.assigned;
    }

    return this.prisma.task.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
      },
    });
  }

  async assign(id: string, staffId: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        assignedToStaff: { connect: { id: staffId } },
        status: TaskStatus.assigned,
      },
      select: { id: true, title: true, status: true },
    });
  }

  async start(id: string) {
    return this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.in_progress,
        actualStartTime: new Date(),
      },
      select: { id: true, title: true, status: true },
    });
  }

  async complete(id: string, completionNotes: string) {
    return this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.completed,
        actualEndTime: new Date(),
        completionNotes,
      },
      select: { id: true, title: true, status: true },
    });
  }

  async cancel(id: string) {
    return this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.cancelled },
      select: { id: true, title: true, status: true },
    });
  }
}
