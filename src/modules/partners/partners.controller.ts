import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
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
import { PartnersService } from './partners.service';
import {
  CreatePartnerRequestDto,
  UpdatePartnerRequestDto,
  UpdatePartnerProfileDto,
  ReviewPartnerRequestDto,
  PartnerResponseDto,
  PartnerRequestResponseDto,
  PartnerIdentityDetailDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { FileUploadPipe } from '../../common/pipes';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('Partners')
@ApiBearerAuth('JWT-auth')
@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  // ─── Partner Management ─────────────────────────────────────────

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'List all partners' })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiJsonResponse(PartnerResponseDto, {
    isArray: true,
    description: 'List of partners',
  })
  async findAllPartners(@Query('isActive') isActive?: string) {
    return this.partnersService.findAllPartners(isActive);
  }

  @Get('profile')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'Get own partner profile' })
  @ApiJsonResponse(PartnerResponseDto, { description: 'Partner profile' })
  async getMyProfile(@CurrentUser() currentUser: JwtPayload) {
    return this.partnersService.getMyProfile(currentUser);
  }

  @Patch('profile')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'Update own partner profile' })
  @ApiJsonResponse(PartnerResponseDto, {
    description: 'Updated partner profile',
  })
  @ApiResponse({ status: 404, description: 'Partner not found' })
  @ApiResponse({ status: 409, description: 'Email or tax code already in use' })
  async updateProfile(
    @Body() updateDto: UpdatePartnerProfileDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.partnersService.updateProfile(updateDto, currentUser);
  }

  @Get('profile/identity')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'Get own identity information' })
  @ApiJsonResponse(PartnerIdentityDetailDto, {
    description: 'Partner identity information',
  })
  @ApiResponse({ status: 404, description: 'Partner not found' })
  async getProfileIdentity(@CurrentUser() currentUser: JwtPayload) {
    const partner = await this.partnersService.findOnePartner(currentUser.sub);
    return partner?.identity || null;
  }

  @Post('profile/verify-identity')
  @Roles(Role.PARTNER)
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
  @ApiResponse({
    status: 201,
    description: 'Identity card verified and info extracted from both sides',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid image files or unsupported format',
  })
  @ApiResponse({
    status: 409,
    description: 'National ID already used by another account',
  })
  @ApiResponse({ status: 404, description: 'Partner not found' })
  async verifyIdentityCard(
    @UploadedFiles()
    files: {
      identityCardFront?: any[];
      identityCardBack?: any[];
    },
    @CurrentUser() currentUser: JwtPayload,
  ) {
    if (!files?.identityCardFront?.[0]) {
      throw new BadRequestException('Front identity card image is required');
    }
    if (!files?.identityCardBack?.[0]) {
      throw new BadRequestException('Back identity card image is required');
    }

    return await this.partnersService.updateIdentityCard(
      currentUser.sub,
      files.identityCardFront[0],
      files.identityCardBack[0],
    );
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get partner by ID' })
  @ApiJsonResponse(PartnerResponseDto, { description: 'Partner details' })
  @ApiResponse({ status: 404, description: 'Partner not found' })
  async findOnePartner(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnersService.findOnePartner(id);
  }

  // ─── Partner Requests ───────────────────────────────────────────

  @Get('requests/all')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'List all partner requests' })
  @ApiJsonResponse(PartnerRequestResponseDto, {
    isArray: true,
    description: 'List of partner requests',
  })
  async findAllRequests() {
    return this.partnersService.findAllRequests();
  }

  @Get('requests/my')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'List own partner requests' })
  @ApiJsonResponse(PartnerRequestResponseDto, {
    isArray: true,
    description: 'Own partner requests',
  })
  async findMyRequests(@CurrentUser() currentUser: JwtPayload) {
    return this.partnersService.findMyRequests(currentUser);
  }

  @Get('requests/:id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.PARTNER)
  @ApiOperation({ summary: 'Get partner request details' })
  @ApiJsonResponse(PartnerRequestResponseDto, {
    description: 'Partner request details',
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async findOneRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnersService.findOneRequest(id);
  }

  @Post('requests')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'Submit partner request' })
  @ApiJsonResponse(PartnerRequestResponseDto, {
    status: 201,
    description: 'Request submitted',
  })
  async createRequest(
    @Body() createDto: CreatePartnerRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.partnersService.createRequest(createDto, currentUser);
  }

  @Patch('requests/:id')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'Update partner request' })
  @ApiJsonResponse(PartnerRequestResponseDto, {
    description: 'Request updated',
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async updateRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePartnerRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.partnersService.updateRequest(id, updateDto, currentUser);
  }

  @Patch('requests/:id/review')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Review partner request (approve/reject)' })
  @ApiJsonResponse(PartnerRequestResponseDto, {
    description: 'Request reviewed',
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async reviewRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reviewDto: ReviewPartnerRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.partnersService.reviewRequest(id, reviewDto, currentUser);
  }
}
