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
import { PoliciesService } from './policies.service';
import {
  CreatePolicyDto,
  UpdatePolicyDto,
  CreateLegalDocumentDto,
  UpdateLegalDocumentDto,
} from './dto';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { PolicyType, DocumentType } from '@prisma/client';

@ApiTags('Policies')
@ApiBearerAuth()
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  // ─── Policies ───────────────────────────────────────────────

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'List all policies' })
  @ApiQuery({ name: 'policyType', required: false, enum: PolicyType })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of policies' })
  async findAllPolicies(
    @Query('policyType') policyType?: PolicyType,
    @Query('isActive') isActive?: string,
  ) {
    const active =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.policiesService.findAllPolicies(policyType, active);
  }

  @Get('public')
  @Public()
  @ApiOperation({
    summary: 'Get active public policies',
    description:
      'No auth required. Returns active policies for tenants/guests.',
  })
  @ApiResponse({ status: 200, description: 'Public policies' })
  async findActivePublicPolicies() {
    return this.policiesService.findActivePublicPolicies();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get policy details' })
  @ApiResponse({ status: 200, description: 'Policy details' })
  async findOnePolicy(@Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.findOnePolicy(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create policy' })
  @ApiResponse({ status: 201, description: 'Policy created' })
  async createPolicy(
    @Body() createDto: CreatePolicyDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.policiesService.createPolicy(createDto, currentUser);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update policy' })
  @ApiResponse({ status: 200, description: 'Policy updated' })
  async updatePolicy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePolicyDto,
  ) {
    return this.policiesService.updatePolicy(id, updateDto);
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve policy' })
  @ApiResponse({ status: 200, description: 'Policy approved and activated' })
  async approvePolicy(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.policiesService.approvePolicy(id, currentUser);
  }

  // ─── Legal Documents ────────────────────────────────────────

  @Get('documents/all')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'List all legal documents' })
  @ApiQuery({ name: 'documentType', required: false, enum: DocumentType })
  @ApiQuery({ name: 'isPublic', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of documents' })
  async findAllDocuments(
    @Query('documentType') documentType?: DocumentType,
    @Query('isPublic') isPublic?: string,
  ) {
    const pub =
      isPublic === 'true' ? true : isPublic === 'false' ? false : undefined;
    return this.policiesService.findAllDocuments(documentType, pub);
  }

  @Get('documents/public')
  @Public()
  @ApiOperation({ summary: 'Get public legal documents' })
  @ApiResponse({ status: 200, description: 'Public legal documents' })
  async findPublicDocuments() {
    return this.policiesService.findPublicDocuments();
  }

  @Get('documents/:id')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get legal document details' })
  @ApiResponse({ status: 200, description: 'Document details' })
  async findOneDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.findOneDocument(id);
  }

  @Post('documents')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create legal document' })
  @ApiResponse({ status: 201, description: 'Document created' })
  async createDocument(
    @Body() createDto: CreateLegalDocumentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.policiesService.createDocument(createDto, currentUser);
  }

  @Patch('documents/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update legal document' })
  @ApiResponse({ status: 200, description: 'Document updated' })
  async updateDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateLegalDocumentDto,
  ) {
    return this.policiesService.updateDocument(id, updateDto);
  }
}
