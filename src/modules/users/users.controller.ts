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
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateIdentityCardDto,
  UserListItemDto,
  UserDetailDto,
  UserCreatedDto,
  UserUpdatedDto,
  UserVerifiedDto,
  UserDeletedDto,
  UserIdentityCardDto,
  UserIdentityDetailDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { FileUploadPipe } from '../../common/pipes';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by email, name, or phone',
  })
  @ApiJsonResponse(UserListItemDto, {
    isArray: true,
    description: 'List of users',
  })
  async findAll(@Query('search') search?: string) {
    return this.usersService.findAll(search);
  }

  @Get('profile')
  @Roles(Role.USER, Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Get my profile' })
  @ApiJsonResponse(UserDetailDto, { description: 'User profile' })
  async getProfile(@CurrentUser() currentUser: JwtPayload) {
    return this.usersService.getProfile(currentUser.sub);
  }

  @Get('profile/identity')
  @Roles(Role.USER, Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Get my identity information' })
  @ApiJsonResponse(UserIdentityDetailDto, {
    description: 'User identity information',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfileIdentity(@CurrentUser() currentUser: JwtPayload) {
    const user = await this.usersService.getProfile(currentUser.sub);
    return user?.identity || null;
  }

  @Patch('profile/identity-card')
  @Roles(Role.USER, Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @UsePipes(FileUploadPipe)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'identityCardFront', maxCount: 1 },
      { name: 'identityCardBack', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Identity card images upload (front and back) - JPEG, PNG, or WebP format',
    schema: {
      type: 'object',
      properties: {
        identityCardFront: {
          type: 'string',
          format: 'binary',
          description: 'Front image of identity card (required) - JPEG, PNG, or WebP',
        },
        identityCardBack: {
          type: 'string',
          format: 'binary',
          description: 'Back image of identity card (optional) - JPEG, PNG, or WebP',
        },
      },
      required: ['identityCardFront'],
    },
  })
  @ApiOperation({
    summary: 'Update identity card images (front and back)',
    description:
      'Upload identity card front and back images in JPEG, PNG, or WebP format. AI will verify the ID card and extract information.',
  })
  @ApiResponse({
    status: 200,
    description: 'Identity card images uploaded and verified',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'user-123' },
        identity: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            nationalId: { type: 'string' },
            isVerified: { type: 'boolean' },
            verifiedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid image files or unsupported format' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateIdentityCard(
    @UploadedFiles()
    files: {
      identityCardFront?: any[];
      identityCardBack?: any[];
    },
    @CurrentUser() currentUser: JwtPayload,
  ) {
    // Files validation happens in service layer
    if (!files || !files.identityCardFront || !files.identityCardFront[0]) {
      throw new BadRequestException('Front identity card image is required');
    }

    return await this.usersService.updateIdentityCard(
      currentUser.sub,
      files.identityCardFront?.[0],
      files.identityCardBack?.[0],
    );
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

  @Get(':id/identity')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get user identity by user ID' })
  @ApiJsonResponse(UserIdentityDetailDto, {
    description: 'User identity information',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findIdentity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    const user = await this.usersService.findOne(id, currentUser);
    return user?.identity || null;
  }

  @Post()
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Create user' })
  @ApiJsonResponse(UserCreatedDto, { status: 201, description: 'User created' })
  @ApiResponse({
    status: 409,
    description: 'Email or national ID already exists',
  })
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.usersService.create(createUserDto, currentUser.sub);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.USER, Role.STAFF)
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

  @Patch(':id/verify')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Verify user identity (staff confirms user info)' })
  @ApiJsonResponse(UserVerifiedDto, {
    description: 'User verified successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User is already verified' })
  async verifyUser(@Param('id', ParseUUIDPipe) id: string) {
    return await this.usersService.verifyUser(id);
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
