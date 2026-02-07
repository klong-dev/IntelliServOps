import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ActivityLogsService } from './activity-logs.service';
import { Roles } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import { ActorType } from '@prisma/client';

@ApiTags('Activity Logs')
@ApiBearerAuth()
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'List activity logs',
    description: 'Filter by actor, entity, action, date range',
  })
  @ApiQuery({ name: 'actorType', required: false, enum: ActorType })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-12-31' })
  @ApiResponse({ status: 200, description: 'List of activity logs' })
  async findAll(
    @Query('actorType') actorType?: ActorType,
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.activityLogsService.findAll({
      actorType,
      actorId,
      entityType,
      entityId,
      action,
      startDate,
      endDate,
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get activity log details' })
  @ApiResponse({ status: 200, description: 'Activity log details' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.activityLogsService.findOne(id);
  }
}
