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
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';

@ApiTags('Partners')
@ApiBearerAuth()
@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  // ─── Partner Management ─────────────────────────────────────────

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'List all partners' })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiResponse({ status: 200, description: 'List of partners', type: [PartnerResponseDto] })
  async findAllPartners(@Query('isActive') isActive?: string) {
    return this.partnersService.findAllPartners(isActive);
  }

  @Get('profile')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'Get own partner profile' })
  @ApiResponse({ status: 200, description: 'Partner profile', type: PartnerResponseDto })
  async getMyProfile(@CurrentUser() currentUser: JwtPayload) {
    return this.partnersService.getMyProfile(currentUser);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get partner by ID' })
  @ApiResponse({ status: 200, description: 'Partner details', type: PartnerResponseDto })
  @ApiResponse({ status: 404, description: 'Partner not found' })
  async findOnePartner(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnersService.findOnePartner(id);
  }

  // ─── Partner Requests ───────────────────────────────────────────

  @Get('requests/all')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'List all partner requests' })
  @ApiResponse({ status: 200, description: 'List of partner requests', type: [PartnerRequestResponseDto] })
  async findAllRequests() {
    return this.partnersService.findAllRequests();
  }

  @Get('requests/my')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'List own partner requests' })
  @ApiResponse({ status: 200, description: 'Own partner requests', type: [PartnerRequestResponseDto] })
  async findMyRequests(@CurrentUser() currentUser: JwtPayload) {
    return this.partnersService.findMyRequests(currentUser);
  }

  @Get('requests/:id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.PARTNER)
  @ApiOperation({ summary: 'Get partner request details' })
  @ApiResponse({ status: 200, description: 'Partner request details', type: PartnerRequestResponseDto })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async findOneRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnersService.findOneRequest(id);
  }

  @Post('requests')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'Submit partner request' })
  @ApiResponse({ status: 201, description: 'Request submitted', type: PartnerRequestResponseDto })
  async createRequest(
    @Body() createDto: CreatePartnerRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.partnersService.createRequest(createDto, currentUser);
  }

  @Patch('requests/:id')
  @Roles(Role.PARTNER)
  @ApiOperation({ summary: 'Update partner request' })
  @ApiResponse({ status: 200, description: 'Request updated', type: PartnerRequestResponseDto })
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
  @ApiResponse({ status: 200, description: 'Request reviewed', type: PartnerRequestResponseDto })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async reviewRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reviewDto: ReviewPartnerRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.partnersService.reviewRequest(id, reviewDto, currentUser);
  }
}
