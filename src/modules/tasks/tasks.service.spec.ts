import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  createPrismaMock,
  mockTask,
  mockUserJwtPayload,
  mockStaffJwtPayload,
  mockOperatorJwtPayload,
  MockPrisma,
} from '../../test-utils';
import { CreateTaskDto, UpdateTaskDto } from './dto';
import { TaskStatus, Priority, ActorType } from '@prisma/client';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all tasks for admin', async () => {
      const tasks = [mockTask(), mockTask({ id: 'task-2' })];
      const adminUser = mockUserJwtPayload({ actorType: ActorType.admin });
      prisma.task.findMany.mockResolvedValue(tasks);

      const result = await service.findAll(adminUser);

      expect(result).toEqual(tasks);
      expect(prisma.task.findMany).toHaveBeenCalled();
    });

    it('should filter tasks by status', async () => {
      const tasks = [mockTask({ status: TaskStatus.pending })];
      const adminUser = mockUserJwtPayload({ actorType: ActorType.admin });
      prisma.task.findMany.mockResolvedValue(tasks);

      const result = await service.findAll(adminUser, TaskStatus.pending);

      expect(result).toEqual(tasks);
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: TaskStatus.pending }),
        }),
      );
    });

    it('should return only assigned tasks for staff', async () => {
      const staffUser = mockStaffJwtPayload();
      const tasks = [mockTask({ assignedToStaffId: staffUser.sub })];
      prisma.task.findMany.mockResolvedValue(tasks);

      await service.findAll(staffUser);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedToStaffId: staffUser.sub }),
        }),
      );
    });

    it('should return created and unassigned tasks for operator', async () => {
      const operatorUser = mockOperatorJwtPayload();
      const tasks = [mockTask({ assignedByOperatorId: operatorUser.sub })];
      prisma.task.findMany.mockResolvedValue(tasks);

      await service.findAll(operatorUser);

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { assignedByOperatorId: operatorUser.sub },
              { assignedToStaffId: null },
            ]),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return task with relations', async () => {
      const task = mockTask();
      prisma.task.findUnique.mockResolvedValue(task);

      const result = await service.findOne(task.id);

      expect(result).toEqual(task);
      expect(prisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: task.id },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const createDto: CreateTaskDto = {
      title: 'Test Task',
      description: 'Task description',
      taskType: 'maintenance' as any,
      priority: Priority.high,
      scheduledDate: '2026-02-10',
    };

    it('should create a task successfully', async () => {
      const operatorUser = mockOperatorJwtPayload();
      const createdTask = mockTask(createDto);
      prisma.task.create.mockResolvedValue(createdTask);

      const result = await service.create(createDto, operatorUser);

      expect(result).toEqual(createdTask);
      expect(prisma.task.create).toHaveBeenCalled();
    });

    it('should assign task to staff if staffId provided', async () => {
      const assignDto = { ...createDto, assignedToStaffId: 'staff-123' };
      const operatorUser = mockOperatorJwtPayload();
      const assignedTask = mockTask({
        ...createDto,
        assignedToStaffId: 'staff-123',
        status: TaskStatus.assigned,
      });
      prisma.task.create.mockResolvedValue(assignedTask);

      const result = await service.create(assignDto, operatorUser);

      expect(result.status).toBe(TaskStatus.assigned);
    });

    it('should link operator as creator', async () => {
      const operatorUser = mockOperatorJwtPayload();
      const task = mockTask({ assignedByOperatorId: operatorUser.sub });
      prisma.task.create.mockResolvedValue(task);

      await service.create(createDto, operatorUser);

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignedByOperator: { connect: { id: operatorUser.sub } },
          }),
        }),
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateTaskDto = {
      title: 'Updated Task',
      priority: Priority.urgent,
    };

    it('should update task successfully', async () => {
      const task = mockTask();
      const updatedTask = { ...task, ...updateDto };
      prisma.task.findUnique.mockResolvedValue(task);
      prisma.task.update.mockResolvedValue(updatedTask);

      const result = await service.update(task.id, updateDto);

      expect(result).toEqual(updatedTask);
      expect(prisma.task.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update status to assigned when assigning staff', async () => {
      const task = mockTask();
      const assignDto = { assignedToStaffId: 'staff-123' };
      prisma.task.findUnique.mockResolvedValue(task);
      prisma.task.update.mockResolvedValue({
        ...task,
        ...assignDto,
        status: TaskStatus.assigned,
      });

      await service.update(task.id, assignDto);

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: TaskStatus.assigned }),
        }),
      );
    });
  });

  describe('assign', () => {
    it('should assign task to staff', async () => {
      const task = mockTask();
      const assignedTask = {
        ...task,
        assignedToStaffId: 'staff-123',
        status: TaskStatus.assigned,
      };
      prisma.task.findUnique.mockResolvedValue(task);
      prisma.task.update.mockResolvedValue(assignedTask);

      const result = await service.assign(task.id, 'staff-123');

      expect(result.status).toBe(TaskStatus.assigned);
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: task.id },
        data: {
          assignedToStaff: { connect: { id: 'staff-123' } },
          status: TaskStatus.assigned,
        },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException if task not found', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.assign('non-existent', 'staff-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('start', () => {
    it('should start task and set actualStartTime', async () => {
      const task = mockTask();
      const startedTask = {
        ...task,
        status: TaskStatus.in_progress,
        actualStartTime: new Date(),
      };
      prisma.task.update.mockResolvedValue(startedTask);

      const result = await service.start(task.id);

      expect(result.status).toBe(TaskStatus.in_progress);
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: task.id },
        data: {
          status: TaskStatus.in_progress,
          actualStartTime: expect.any(Date),
        },
        select: expect.any(Object),
      });
    });
  });

  describe('complete', () => {
    it('should complete task with completion notes', async () => {
      const task = mockTask();
      const completionNotes = 'Task completed successfully';
      const completedTask = {
        ...task,
        status: TaskStatus.completed,
        actualEndTime: new Date(),
        completionNotes,
      };
      prisma.task.update.mockResolvedValue(completedTask);

      const result = await service.complete(task.id, completionNotes);

      expect(result.status).toBe(TaskStatus.completed);
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: task.id },
        data: {
          status: TaskStatus.completed,
          actualEndTime: expect.any(Date),
          completionNotes,
        },
        select: expect.any(Object),
      });
    });
  });

  describe('cancel', () => {
    it('should cancel task', async () => {
      const task = mockTask();
      const cancelledTask = { ...task, status: TaskStatus.cancelled };
      prisma.task.update.mockResolvedValue(cancelledTask);

      const result = await service.cancel(task.id);

      expect(result.status).toBe(TaskStatus.cancelled);
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: task.id },
        data: { status: TaskStatus.cancelled },
        select: expect.any(Object),
      });
    });
  });
});
