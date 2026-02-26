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
  PolicyResponseDto,
  LegalDocumentResponseDto,
} from './dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { PolicyType, DocumentType } from '@prisma/client';

@ApiTags('Policies')
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  // ─── Policies ───────────────────────────────────────────────────

  @Get()
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List policies' })
  @ApiQuery({ name: 'type', required: false, enum: PolicyType })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of policies', type: [PolicyResponseDto] })
  async findAllPolicies(
    @Query('type') policyType?: PolicyType,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.policiesService.findAllPolicies(policyType, isActive);
  }

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'List active public policies' })
  @ApiResponse({ status: 200, description: 'Active public policies', type: [PolicyResponseDto] })
  async findActivePublicPolicies() {
    return this.policiesService.findActivePublicPolicies();
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get policy details' })
  @ApiResponse({ status: 200, description: 'Policy details', type: PolicyResponseDto })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  async findOnePolicy(@Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.findOnePolicy(id);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create policy' })
  @ApiResponse({ status: 201, description: 'Policy created', type: PolicyResponseDto })
  async createPolicy(
    @Body() createDto: CreatePolicyDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.policiesService.createPolicy(createDto, currentUser);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update policy' })
  @ApiResponse({ status: 200, description: 'Policy updated', type: PolicyResponseDto })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  async updatePolicy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePolicyDto,
  ) {
    return this.policiesService.updatePolicy(id, updateDto);
  }

  @Patch(':id/approve')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve policy' })
  @ApiResponse({ status: 200, description: 'Policy approved', type: PolicyResponseDto })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  async approvePolicy(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.policiesService.approvePolicy(id, currentUser);
  }

  // ─── Legal Documents ────────────────────────────────────────────

  @Get('legal-documents/all')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List legal documents' })
  @ApiQuery({ name: 'documentType', required: false, enum: DocumentType })
  @ApiQuery({ name: 'isPublic', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of legal documents', type: [LegalDocumentResponseDto] })
  async findAllDocuments(
    @Query('documentType') documentType?: DocumentType,
    @Query('isPublic') isPublic?: boolean,
  ) {
    return this.policiesService.findAllDocuments(documentType, isPublic);
  }

  @Get('legal-documents/public')
  @Public()
  @ApiOperation({ summary: 'List public legal documents' })
  @ApiResponse({ status: 200, description: 'Public legal documents', type: [LegalDocumentResponseDto] })
  async findPublicDocuments() {
    return this.policiesService.findPublicDocuments();
  }

  @Get('legal-documents/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get legal document details' })
  @ApiResponse({ status: 200, description: 'Legal document details', type: LegalDocumentResponseDto })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async findOneDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.findOneDocument(id);
  }

  @Post('legal-documents')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Upload legal document' })
  @ApiResponse({ status: 201, description: 'Document created', type: LegalDocumentResponseDto })
  async createDocument(
    @Body() createDto: CreateLegalDocumentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.policiesService.createDocument(createDto, currentUser);
  }

  @Patch('legal-documents/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update legal document' })
  @ApiResponse({ status: 200, description: 'Document updated', type: LegalDocumentResponseDto })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async updateDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateLegalDocumentDto,
  ) {
    return this.policiesService.updateDocument(id, updateDto);
  }
}
