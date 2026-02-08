import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { mockTask, mockOperatorJwtPayload, mockStaffJwtPayload } from '../../test-utils';
import { CreateTaskDto, UpdateTaskDto } from './dto';
import { TaskStatus, Priority } from '@prisma/client';

describe('TasksController', () => {
  let controller: TasksController;
  let tasksService: TasksService;

  const mockTasksService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    assign: jest.fn(),
    start: jest.fn(),
    complete: jest.fn(),
    cancel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
    tasksService = module.get<TasksService>(TasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all tasks', async () => {
      const currentUser = mockOperatorJwtPayload();
      const tasks = [mockTask(), mockTask({ id: 'task-2' })];
      mockTasksService.findAll.mockResolvedValue(tasks);

      const result = await controller.findAll(currentUser);

      expect(result).toEqual(tasks);
      expect(tasksService.findAll).toHaveBeenCalledWith(currentUser, undefined);
    });

    it('should filter tasks by status', async () => {
      const currentUser = mockOperatorJwtPayload();
      const tasks = [mockTask({ status: TaskStatus.pending })];
      mockTasksService.findAll.mockResolvedValue(tasks);

      const result = await controller.findAll(currentUser, TaskStatus.pending);

      expect(result).toEqual(tasks);
      expect(tasksService.findAll).toHaveBeenCalledWith(currentUser, TaskStatus.pending);
    });
  });

  describe('findOne', () => {
    it('should return task by ID', async () => {
      const task = mockTask();
      mockTasksService.findOne.mockResolvedValue(task);

      const result = await controller.findOne(task.id);

      expect(result).toEqual(task);
      expect(tasksService.findOne).toHaveBeenCalledWith(task.id);
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

    it('should create new task', async () => {
      const currentUser = mockOperatorJwtPayload();
      const createdTask = mockTask(createDto);
      mockTasksService.create.mockResolvedValue(createdTask);

      const result = await controller.create(createDto, currentUser);

      expect(result).toEqual(createdTask);
      expect(tasksService.create).toHaveBeenCalledWith(createDto, currentUser);
    });
  });

  describe('update', () => {
    const updateDto: UpdateTaskDto = {
      title: 'Updated Task',
      priority: Priority.urgent,
    };

    it('should update task', async () => {
      const task = mockTask();
      const updatedTask = { ...task, ...updateDto };
      mockTasksService.update.mockResolvedValue(updatedTask);

      const result = await controller.update(task.id, updateDto);

      expect(result).toEqual(updatedTask);
      expect(tasksService.update).toHaveBeenCalledWith(task.id, updateDto);
    });
  });

  describe('assign', () => {
    it('should assign task to staff', async () => {
      const task = mockTask();
      const assignedTask = { ...task, assignedToStaffId: 'staff-123', status: TaskStatus.assigned };
      mockTasksService.assign.mockResolvedValue(assignedTask);

      const result = await controller.assign(task.id, { staffId: 'staff-123' });

      expect(result).toEqual(assignedTask);
      expect(tasksService.assign).toHaveBeenCalledWith(task.id, 'staff-123');
    });
  });

  describe('start', () => {
    it('should start task', async () => {
      const task = mockTask();
      const startedTask = { ...task, status: TaskStatus.in_progress };
      mockTasksService.start.mockResolvedValue(startedTask);

      const result = await controller.start(task.id);

      expect(result).toEqual(startedTask);
      expect(tasksService.start).toHaveBeenCalledWith(task.id);
    });
  });

  describe('complete', () => {
    it('should complete task', async () => {
      const task = mockTask();
      const completedTask = { ...task, status: TaskStatus.completed };
      const completionDto = { completionNotes: 'Task completed successfully' };
      mockTasksService.complete.mockResolvedValue(completedTask);

      const result = await controller.complete(task.id, completionDto);

      expect(result).toEqual(completedTask);
      expect(tasksService.complete).toHaveBeenCalledWith(task.id, completionDto.completionNotes);
    });
  });

  describe('cancel', () => {
    it('should cancel task', async () => {
      const task = mockTask();
      const cancelledTask = { ...task, status: TaskStatus.cancelled };
      mockTasksService.cancel.mockResolvedValue(cancelledTask);

      const result = await controller.cancel(task.id);

      expect(result).toEqual(cancelledTask);
      expect(tasksService.cancel).toHaveBeenCalledWith(task.id);
    });
  });
});
