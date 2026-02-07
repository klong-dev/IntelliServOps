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
import { PartnersService } from './partners.service';
import {
  CreatePartnerRequestDto,
  UpdatePartnerRequestDto,
  ReviewPartnerRequestDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { PartnerRequestStatus } from '@prisma/client';

@ApiTags('Partners')
@ApiBearerAuth()
@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  // ─── Partner Profile ────────────────────────────────────────

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'List all partners' })
  @ApiQuery({ name: 'isActive', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of partners' })
  async findAllPartners(@Query('isActive') isActive?: string) {
    return this.partnersService.findAllPartners(isActive);
  }

  @Get('profile')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'Get my partner profile' })
  @ApiResponse({ status: 200, description: 'Partner profile' })
  async getMyProfile(@CurrentUser() currentUser: JwtPayload) {
    return this.partnersService.getMyProfile(currentUser);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get partner details' })
  @ApiResponse({ status: 200, description: 'Partner details' })
  @ApiResponse({ status: 404, description: 'Partner not found' })
  async findOnePartner(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnersService.findOnePartner(id);
  }

  // ─── Partner Requests ───────────────────────────────────────

  @Get('requests/all')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'List all partner requests',
    description: 'Operator/Admin views all property listing requests',
  })
  @ApiQuery({ name: 'status', required: false, enum: PartnerRequestStatus })
  @ApiResponse({ status: 200, description: 'List of partner requests' })
  async findAllRequests(@Query('status') status?: PartnerRequestStatus) {
    return this.partnersService.findAllRequests(status);
  }

  @Get('requests/mine')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'List my requests' })
  @ApiResponse({ status: 200, description: 'My partner requests' })
  async findMyRequests(@CurrentUser() currentUser: JwtPayload) {
    return this.partnersService.findMyRequests(currentUser);
  }

  @Get('requests/:id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.PARTNER)
  @ApiOperation({ summary: 'Get request details' })
  @ApiResponse({ status: 200, description: 'Partner request details' })
  async findOneRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnersService.findOneRequest(id);
  }

  @Post('requests')
  @Roles(Role.PARTNER)
  @ApiOperation({
    summary: 'Submit property listing request',
    description: 'Partner submits a new property for review',
  })
  @ApiResponse({ status: 201, description: 'Request created' })
  async createRequest(
    @Body() createDto: CreatePartnerRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.partnersService.createRequest(createDto, currentUser);
  }

  @Patch('requests/:id')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'Update my request' })
  @ApiResponse({ status: 200, description: 'Request updated' })
  async updateRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePartnerRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.partnersService.updateRequest(id, updateDto, currentUser);
  }

  @Patch('requests/:id/review')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'Review partner request',
    description: 'Approve or reject a partner property request',
  })
  @ApiResponse({ status: 200, description: 'Request reviewed' })
  async reviewRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reviewDto: ReviewPartnerRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.partnersService.reviewRequest(id, reviewDto, currentUser);
  }
}
