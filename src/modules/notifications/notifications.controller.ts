import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
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
  RegisterFcmTokenDto,
  RemoveFcmTokenDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ============================================================================
  // FCM Token Management
  // ============================================================================

  @Post('fcm-token')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Register FCM device token for push notifications' })
  @ApiResponse({ status: 201, description: 'Token registered' })
  async registerFcmToken(
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: RegisterFcmTokenDto,
  ) {
    return this.notificationsService.registerFcmToken(currentUser, dto);
  }

  @Delete('fcm-token')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Remove FCM device token' })
  @ApiResponse({ status: 200, description: 'Token removed' })
  async removeFcmToken(
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: RemoveFcmTokenDto,
  ) {
    return this.notificationsService.removeFcmToken(currentUser, dto.token);
  }

  // ============================================================================
  // Notifications CRUD
  // ============================================================================

  @Get('my')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get my notifications' })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiJsonResponse(NotificationResponseDto, {
    isArray: true,
    description: 'List of notifications',
  })
  async findMyNotifications(
    @CurrentUser() currentUser: JwtPayload,
    @Query('isRead') isRead?: boolean,
  ) {
    return this.notificationsService.findMyNotifications(currentUser, isRead);
  }

  @Get('unread-count')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get unread notification count' })
  async countUnread(@CurrentUser() currentUser: JwtPayload) {
    return this.notificationsService.countUnread(currentUser);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Gửi thông báo (chỉ admin/operator)' })
  @ApiJsonResponse(NotificationResponseDto, {
    status: 201,
    description: 'Đã gửi thông báo và đẩy FCM',
  })
  async create(@Body() createDto: CreateNotificationDto) {
    return this.notificationsService.create(createDto);
  }

  @Patch(':id/read')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Mark notification as read' })
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
  async markAllAsRead(@CurrentUser() currentUser: JwtPayload) {
    return this.notificationsService.markAllAsRead(currentUser);
  }
}
