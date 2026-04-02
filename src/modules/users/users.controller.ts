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
  ForbiddenException,
  NotFoundException,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UsersService, type UpdateIdentityCardResult } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  SearchUserDto,
  SearchUserByNationalIdDto,
  SearchUserByNationalIdResponseDto,
  UserListItemDto,
  UserDetailDto,
  UserCreatedDto,
  UserUpdatedDto,
  UserDeletedDto,
  UserIdentityDetailDto,
  UserIdentityCardDto,
  CreatePartnerRequestDto,
  UpdatePartnerRequestDto,
  ReviewPartnerRequestDto,
  PartnerRequestListItemDto,
  PartnerRequestDetailDto,
  PartnerRequestMutationResultDto,
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
  @ApiJsonResponse(UserListItemDto, {
    isArray: true,
    isPaginated: true,
    description: 'Paginated list of users',
  })
  async findAll(@Query() query: SearchUserDto) {
    return this.usersService.findAll(query);
  }

  @Get('profile')
  @Roles(Role.USER, Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({ summary: 'Get my profile' })
  @ApiJsonResponse(UserDetailDto, {
    description: 'User/Staff/Operator/Admin profile',
  })
  @ApiResponse({
    status: 200,
    description: 'User/Staff/Operator/Admin profile',
  })
  async getProfile(@CurrentUser() currentUser: JwtPayload) {
    return this.usersService.getProfile(currentUser);
  }

  @Get('profile/identity')
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Get my identity information' })
  @ApiJsonResponse(UserIdentityDetailDto, {
    description: 'User identity information',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfileIdentity(@CurrentUser() currentUser: JwtPayload) {
    const user = await this.usersService.findOne(currentUser.sub, currentUser);
    return user?.identity || null;
  }

  @Get('search/by-national-id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Search user by national ID',
    description: 'Search one user by CCCD/CMND number from identity data.',
  })
  @ApiQuery({
    name: 'nationalId',
    required: true,
    description: 'CCCD/CMND number',
    example: '079203001234',
  })
  @ApiJsonResponse(SearchUserByNationalIdResponseDto, {
    description: 'Matched user by national ID',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found for this national ID',
  })
  searchByNationalId(@Query() query: SearchUserByNationalIdDto) {
    return this.usersService.searchByNationalId(query);
  }

  @Post('profile/verify-identity')
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
    description:
      'Upload front and back identity card images for AI to extract information. Images are NOT stored.',
    schema: {
      type: 'object',
      properties: {
        identityCardFront: {
          type: 'string',
          format: 'binary',
          description:
            'Front image of identity card (required) - JPEG, PNG, or WebP',
        },
        identityCardBack: {
          type: 'string',
          format: 'binary',
          description:
            'Back image of identity card (required) - JPEG, PNG, or WebP',
        },
      },
      required: ['identityCardFront', 'identityCardBack'],
    },
  })
  @ApiOperation({
    summary: 'Verify identity card via AI (front + back)',
    description:
      'Upload front and back identity card images. AI will extract information from both sides and store extracted data. Images are NOT saved.',
  })
  @ApiJsonResponse(UserIdentityCardDto, {
    status: 201,
    description: 'Identity card verified and extracted info returned',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid image files or unsupported format',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async verifyIdentityCard(
    @UploadedFiles()
    files: {
      identityCardFront?: any[];
      identityCardBack?: any[];
    },
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UpdateIdentityCardResult> {
    if (currentUser.actorType === 'staff') {
      throw new ForbiddenException('Staff cannot verify identity cards');
    }
    if (currentUser.actorType !== 'user') {
      throw new ForbiddenException('Only users can verify identity cards');
    }
    if (!files?.identityCardFront?.[0]) {
      throw new BadRequestException('Front identity card image is required');
    }
    if (!files?.identityCardBack?.[0]) {
      throw new BadRequestException('Back identity card image is required');
    }

    return this.usersService.updateIdentityCard(
      currentUser.sub,
      files.identityCardFront[0],
      files.identityCardBack[0],
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
    if (user?.identity == null) {
      throw new NotFoundException('User chưa xác minh danh tính');
    }
    return user.identity;
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

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete user (soft delete)' })
  @ApiJsonResponse(UserDeletedDto, { description: 'User deactivated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  // ─── Partner Requests (merged from PartnersController) ────────────

  @Get('partner-requests/all')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'List all partner requests' })
  @ApiJsonResponse(PartnerRequestListItemDto, {
    isArray: true,
    description: 'All partner requests',
  })
  async findAllPartnerRequests() {
    return this.usersService.findAllPartnerRequests();
  }

  @Get('partner-requests/my')
  @Roles(Role.USER)
  @ApiOperation({ summary: 'List own partner requests' })
  @ApiJsonResponse(PartnerRequestListItemDto, {
    isArray: true,
    description: 'Current user partner requests',
  })
  async findMyPartnerRequests(@CurrentUser() currentUser: JwtPayload) {
    return this.usersService.findMyPartnerRequests(currentUser);
  }

  @Get('partner-requests/:id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.USER)
  @ApiOperation({ summary: 'Get partner request details' })
  @ApiJsonResponse(PartnerRequestDetailDto, {
    description: 'Partner request details',
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async findOnePartnerRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOnePartnerRequest(id);
  }

  @Post('partner-requests')
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Submit partner request' })
  @ApiJsonResponse(PartnerRequestMutationResultDto, {
    status: 201,
    description: 'Partner request submitted',
  })
  async createPartnerRequest(
    @Body() createDto: CreatePartnerRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.usersService.createPartnerRequest(createDto, currentUser);
  }

  @Patch('partner-requests/:id')
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Update partner request' })
  @ApiJsonResponse(PartnerRequestMutationResultDto, {
    description: 'Partner request updated',
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async updatePartnerRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePartnerRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.usersService.updatePartnerRequest(id, updateDto, currentUser);
  }

  @Patch('partner-requests/:id/review')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Review partner request (approve/reject)' })
  @ApiJsonResponse(PartnerRequestMutationResultDto, {
    description: 'Partner request reviewed',
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async reviewPartnerRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reviewDto: ReviewPartnerRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.usersService.reviewPartnerRequest(id, reviewDto, currentUser);
  }
}
