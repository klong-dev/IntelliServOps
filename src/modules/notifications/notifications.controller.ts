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
import {
  CreateNotificationDto,
  NotificationResponseDto,
  UnreadCountResponseDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('my')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get my notifications' })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of notifications', type: [NotificationResponseDto] })
  async findMyNotifications(
    @CurrentUser() currentUser: JwtPayload,
    @Query('isRead') isRead?: boolean,
  ) {
    return this.notificationsService.findMyNotifications(currentUser, isRead);
  }

  @Get('unread-count')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count', type: UnreadCountResponseDto })
  async countUnread(@CurrentUser() currentUser: JwtPayload) {
    return this.notificationsService.countUnread(currentUser);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Send notification' })
  @ApiResponse({ status: 201, description: 'Notification sent', type: NotificationResponseDto })
  async create(@Body() createDto: CreateNotificationDto) {
    return this.notificationsService.create(createDto);
  }

  @Patch(':id/read')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read', type: NotificationResponseDto })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.notificationsService.markAsRead(id, currentUser);
  }

  @Patch('read-all')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All marked as read' })
  async markAllAsRead(@CurrentUser() currentUser: JwtPayload) {
    return this.notificationsService.markAllAsRead(currentUser);
  }
}
