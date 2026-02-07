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
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { ActorType } from '@prisma/client';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my notifications' })
  @ApiQuery({
    name: 'isRead',
    required: false,
    type: Boolean,
    description: 'Filter by read status',
  })
  @ApiResponse({ status: 200, description: 'List of notifications' })
  async findMyNotifications(
    @CurrentUser() currentUser: JwtPayload,
    @Query('isRead') isRead?: string,
  ) {
    const read =
      isRead === 'true' ? true : isRead === 'false' ? false : undefined;
    return this.notificationsService.findMyNotifications(currentUser, read);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count unread notifications' })
  @ApiResponse({ status: 200, description: 'Unread count' })
  async countUnread(@CurrentUser() currentUser: JwtPayload) {
    return this.notificationsService.countUnread(currentUser);
  }

  @Get('all')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'List all notifications (admin)' })
  @ApiQuery({ name: 'recipientType', required: false, enum: ActorType })
  @ApiResponse({ status: 200, description: 'All notifications' })
  async findAll(@Query('recipientType') recipientType?: ActorType) {
    return this.notificationsService.findAll(recipientType);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'Send notification',
    description: 'Admin/Operator sends notification to a user',
  })
  @ApiResponse({ status: 201, description: 'Notification sent' })
  async create(@Body() createDto: CreateNotificationDto) {
    return this.notificationsService.create(createDto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Marked as read' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.notificationsService.markAsRead(id, currentUser);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All marked as read' })
  async markAllAsRead(@CurrentUser() currentUser: JwtPayload) {
    return this.notificationsService.markAllAsRead(currentUser);
  }
}
