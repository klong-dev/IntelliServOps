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
  PartnerResponseDto,
  PartnerRequestResponseDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
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
  @ApiJsonResponse(PartnerResponseDto, { isArray: true, description: 'List of partners' })
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
  @ApiJsonResponse(PartnerRequestResponseDto, { isArray: true, description: 'List of partner requests' })
  async findAllRequests() {
    return this.partnersService.findAllRequests();
  }

  @Get('requests/my')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'List own partner requests' })
  @ApiJsonResponse(PartnerRequestResponseDto, { isArray: true, description: 'Own partner requests' })
  async findMyRequests(@CurrentUser() currentUser: JwtPayload) {
    return this.partnersService.findMyRequests(currentUser);
  }

  @Get('requests/:id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.PARTNER)
  @ApiOperation({ summary: 'Get partner request details' })
  @ApiJsonResponse(PartnerRequestResponseDto, { description: 'Partner request details' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async findOneRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnersService.findOneRequest(id);
  }

  @Post('requests')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'Submit partner request' })
  @ApiJsonResponse(PartnerRequestResponseDto, { status: 201, description: 'Request submitted' })
  async createRequest(
    @Body() createDto: CreatePartnerRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.partnersService.createRequest(createDto, currentUser);
  }

  @Patch('requests/:id')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'Update partner request' })
  @ApiJsonResponse(PartnerRequestResponseDto, { description: 'Request updated' })
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
  @ApiJsonResponse(PartnerRequestResponseDto, { description: 'Request reviewed' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async reviewRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reviewDto: ReviewPartnerRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.partnersService.reviewRequest(id, reviewDto, currentUser);
  }
}
