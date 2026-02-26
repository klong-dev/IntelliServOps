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
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { TaskStatus } from '@prisma/client';

@ApiTags('Tasks')
@ApiBearerAuth('JWT-auth')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'List tasks' })
  @ApiQuery({ name: 'status', required: false, enum: TaskStatus })
  @ApiJsonResponse(TaskListItemDto, { isArray: true, description: 'List of tasks' })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query('status') status?: TaskStatus,
  ) {
    return this.tasksService.findAll(currentUser, status);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Get task details' })
  @ApiJsonResponse(TaskDetailDto, { description: 'Task details' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Create task' })
  @ApiJsonResponse(TaskDetailDto, { status: 201, description: 'Task created' })
  async create(
    @Body() createDto: CreateTaskDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.tasksService.create(createDto, currentUser);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update task' })
  @ApiJsonResponse(TaskDetailDto, { description: 'Task updated' })
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
  @ApiJsonResponse(TaskDetailDto, { description: 'Task assigned' })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { staffId: string },
  ) {
    return this.tasksService.assign(id, body.staffId);
  }

  @Patch(':id/start')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Start task' })
  @ApiJsonResponse(TaskDetailDto, { description: 'Task started' })
  async start(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.start(id);
  }

  @Patch(':id/complete')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Complete task' })
  @ApiJsonResponse(TaskDetailDto, { description: 'Task completed' })
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { completionNotes: string },
  ) {
    return this.tasksService.complete(id, body.completionNotes);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Cancel task' })
  @ApiJsonResponse(TaskDetailDto, { description: 'Task cancelled' })
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.cancel(id);
  }
}
