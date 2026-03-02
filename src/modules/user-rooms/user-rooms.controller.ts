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
import { UserRoomsService } from './user-rooms.service';
import {
  CreateUserRoomDto,
  UpdateUserRoomDto,
  UserRoomListItemDto,
  UserRoomDetailDto,
  UserRoomMutationResultDto,
} from './dto';
import { ApiJsonResponse } from '../../common/dto';
import { Roles } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import { UserRoomStatus } from '@prisma/client';

@ApiTags('User Rooms')
@ApiBearerAuth('JWT-auth')
@Controller('user-rooms')
export class UserRoomsController {
  constructor(private readonly userRoomsService: UserRoomsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'List user-room assignments',
    description: 'Get all user-room assignments with optional filters',
  })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'roomId', required: false, type: String })
  @ApiQuery({ name: 'rentalContractId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: UserRoomStatus })
  @ApiJsonResponse(UserRoomListItemDto, {
    isArray: true,
    description: 'List of user-room assignments',
  })
  async findAll(
    @Query('userId') userId?: string,
    @Query('roomId') roomId?: string,
    @Query('rentalContractId') rentalContractId?: string,
    @Query('status') status?: UserRoomStatus,
  ) {
    return this.userRoomsService.findAll({
      userId,
      roomId,
      rentalContractId,
      status,
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get user-room assignment details' })
  @ApiJsonResponse(UserRoomDetailDto, {
    description: 'User-room assignment details',
  })
  @ApiResponse({ status: 404, description: 'User-room assignment not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userRoomsService.findOne(id);
  }

  @Get('user/:userId')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Get rooms assigned to a user',
    description: 'Get all room assignments for a specific user',
  })
  @ApiQuery({ name: 'status', required: false, enum: UserRoomStatus })
  @ApiJsonResponse(UserRoomDetailDto, {
    isArray: true,
    description: 'User room assignments',
  })
  async findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('status') status?: UserRoomStatus,
  ) {
    return this.userRoomsService.findByUser(userId, status);
  }

  @Get('room/:roomId')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'Get users assigned to a room',
    description: 'Get all user assignments for a specific room',
  })
  @ApiQuery({ name: 'status', required: false, enum: UserRoomStatus })
  @ApiJsonResponse(UserRoomDetailDto, {
    isArray: true,
    description: 'Room user assignments',
  })
  async findByRoom(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Query('status') status?: UserRoomStatus,
  ) {
    return this.userRoomsService.findByRoom(roomId, status);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'Assign user to room',
    description:
      'Create a new user-room assignment. Validates user, room, and contract consistency.',
  })
  @ApiJsonResponse(UserRoomMutationResultDto, {
    status: 201,
    description: 'User assigned to room',
  })
  @ApiResponse({
    status: 404,
    description: 'User, room, or contract not found',
  })
  @ApiResponse({ status: 409, description: 'Assignment already exists' })
  @ApiResponse({
    status: 400,
    description: 'Validation error (wrong apartment, room full, etc.)',
  })
  async create(@Body() createDto: CreateUserRoomDto) {
    return this.userRoomsService.create(createDto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update user-room assignment' })
  @ApiJsonResponse(UserRoomMutationResultDto, {
    description: 'User-room assignment updated',
  })
  @ApiResponse({ status: 404, description: 'User-room assignment not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateUserRoomDto,
  ) {
    return this.userRoomsService.update(id, updateDto);
  }

  @Patch(':id/move-out')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'Move user out of room',
    description: 'Mark user as moved out from the room',
  })
  @ApiJsonResponse(UserRoomMutationResultDto, {
    description: 'User moved out',
  })
  @ApiResponse({ status: 404, description: 'User-room assignment not found' })
  async moveOut(@Param('id', ParseUUIDPipe) id: string) {
    return this.userRoomsService.moveOut(id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete user-room assignment' })
  @ApiResponse({ status: 200, description: 'Assignment deleted' })
  @ApiResponse({ status: 404, description: 'User-room assignment not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userRoomsService.remove(id);
  }
}
