import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  TaskListItemDto,
  TaskDetailDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { TaskStatus } from '@prisma/client';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'List tasks' })
  @ApiQuery({ name: 'status', required: false, enum: TaskStatus })
  @ApiResponse({ status: 200, description: 'List of tasks', type: [TaskListItemDto] })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query('status') status?: TaskStatus,
  ) {
    return this.tasksService.findAll(currentUser, status);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Get task details' })
  @ApiResponse({ status: 200, description: 'Task details', type: TaskDetailDto })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Create task' })
  @ApiResponse({ status: 201, description: 'Task created', type: TaskDetailDto })
  async create(
    @Body() createDto: CreateTaskDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.tasksService.create(createDto, currentUser);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update task' })
  @ApiResponse({ status: 200, description: 'Task updated', type: TaskDetailDto })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, updateDto);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Assign task to staff' })
  @ApiResponse({ status: 200, description: 'Task assigned', type: TaskDetailDto })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { staffId: string },
  ) {
    return this.tasksService.assign(id, body.staffId);
  }

  @Patch(':id/start')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Start task' })
  @ApiResponse({ status: 200, description: 'Task started', type: TaskDetailDto })
  async start(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.start(id);
  }

  @Patch(':id/complete')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Complete task' })
  @ApiResponse({ status: 200, description: 'Task completed', type: TaskDetailDto })
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { completionNotes: string },
  ) {
    return this.tasksService.complete(id, body.completionNotes);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Cancel task' })
  @ApiResponse({ status: 200, description: 'Task cancelled', type: TaskDetailDto })
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.cancel(id);
  }
}
