import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UserListItemDto,
  UserDetailDto,
  UserCreatedDto,
  UserUpdatedDto,
  UserDeletedDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by email, name, or phone' })
  @ApiJsonResponse(UserListItemDto, { isArray: true, description: 'List of users' })
  async findAll(@Query('search') search?: string) {
    return this.usersService.findAll(search);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get my profile' })
  @ApiJsonResponse(UserDetailDto, { description: 'User profile' })
  async getProfile(@CurrentUser() currentUser: JwtPayload) {
    return this.usersService.getProfile(currentUser.sub);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiJsonResponse(UserDetailDto, { description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.usersService.findOne(id, currentUser);
  }

  @Post()
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Create user' })
  @ApiJsonResponse(UserCreatedDto, { status: 201, description: 'User created' })
  @ApiResponse({ status: 409, description: 'Email or national ID already exists' })
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.usersService.create(createUserDto, currentUser.sub);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.USER)
  @ApiOperation({ summary: 'Update user' })
  @ApiJsonResponse(UserUpdatedDto, { description: 'User updated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.usersService.update(id, updateUserDto, currentUser);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete user (soft delete)' })
  @ApiJsonResponse(UserDeletedDto, { description: 'User deactivated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
