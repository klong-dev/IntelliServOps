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
import { CreateTaskDto, UpdateTaskDto } from './dto';
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
  @ApiOperation({
    summary: 'List tasks',
    description: 'Staff sees assigned tasks. Operators see tasks they created.',
  })
  @ApiQuery({ name: 'status', required: false, enum: TaskStatus })
  @ApiResponse({ status: 200, description: 'List of tasks' })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query('status') status?: TaskStatus,
  ) {
    return this.tasksService.findAll(currentUser, status);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Get task details' })
  @ApiResponse({ status: 200, description: 'Task details' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'Create task',
    description:
      'Operator or Admin creates a task and optionally assigns to staff.',
  })
  @ApiResponse({ status: 201, description: 'Task created' })
  async create(
    @Body() createDto: CreateTaskDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.tasksService.create(createDto, currentUser);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update task' })
  @ApiResponse({ status: 200, description: 'Task updated' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, updateDto);
  }

  @Patch(':id/assign')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Assign task to staff' })
  @ApiResponse({ status: 200, description: 'Task assigned' })
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { staffId: string },
  ) {
    return this.tasksService.assign(id, body.staffId);
  }

  @Patch(':id/start')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Start task' })
  @ApiResponse({ status: 200, description: 'Task started' })
  async start(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.start(id);
  }

  @Patch(':id/complete')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Complete task' })
  @ApiResponse({ status: 200, description: 'Task completed' })
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { completionNotes: string },
  ) {
    return this.tasksService.complete(id, body.completionNotes);
  }

  @Patch(':id/cancel')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Cancel task' })
  @ApiResponse({ status: 200, description: 'Task cancelled' })
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.cancel(id);
  }
}
