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
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { PolicyType, DocumentType } from '@prisma/client';

@ApiTags('Policies')
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  // ─── Policies ───────────────────────────────────────────────────

  @Get()
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List policies' })
  @ApiQuery({ name: 'type', required: false, enum: PolicyType })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiJsonResponse(PolicyResponseDto, { isArray: true, description: 'List of policies' })
  async findAllPolicies(
    @Query('type') policyType?: PolicyType,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.policiesService.findAllPolicies(policyType, isActive);
  }

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'List active public policies' })
  @ApiJsonResponse(PolicyResponseDto, { isArray: true, description: 'Active public policies' })
  async findActivePublicPolicies() {
    return this.policiesService.findActivePublicPolicies();
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get policy details' })
  @ApiJsonResponse(PolicyResponseDto, { description: 'Policy details' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  async findOnePolicy(@Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.findOnePolicy(id);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create policy' })
  @ApiJsonResponse(PolicyResponseDto, { status: 201, description: 'Policy created' })
  async createPolicy(
    @Body() createDto: CreatePolicyDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.policiesService.createPolicy(createDto, currentUser);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update policy' })
  @ApiJsonResponse(PolicyResponseDto, { description: 'Policy updated' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  async updatePolicy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePolicyDto,
  ) {
    return this.policiesService.updatePolicy(id, updateDto);
  }

  @Patch(':id/approve')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve policy' })
  @ApiJsonResponse(PolicyResponseDto, { description: 'Policy approved' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  async approvePolicy(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.policiesService.approvePolicy(id, currentUser);
  }

  // ─── Legal Documents ────────────────────────────────────────────

  @Get('legal-documents/all')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List legal documents' })
  @ApiQuery({ name: 'documentType', required: false, enum: DocumentType })
  @ApiQuery({ name: 'isPublic', required: false, type: Boolean })
  @ApiJsonResponse(LegalDocumentResponseDto, { isArray: true, description: 'List of legal documents' })
  async findAllDocuments(
    @Query('documentType') documentType?: DocumentType,
    @Query('isPublic') isPublic?: boolean,
  ) {
    return this.policiesService.findAllDocuments(documentType, isPublic);
  }

  @Get('legal-documents/public')
  @Public()
  @ApiOperation({ summary: 'List public legal documents' })
  @ApiJsonResponse(LegalDocumentResponseDto, { isArray: true, description: 'Public legal documents' })
  async findPublicDocuments() {
    return this.policiesService.findPublicDocuments();
  }

  @Get('legal-documents/:id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get legal document details' })
  @ApiJsonResponse(LegalDocumentResponseDto, { description: 'Legal document details' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async findOneDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.findOneDocument(id);
  }

  @Post('legal-documents')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Upload legal document' })
  @ApiJsonResponse(LegalDocumentResponseDto, { status: 201, description: 'Document created' })
  async createDocument(
    @Body() createDto: CreateLegalDocumentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.policiesService.createDocument(createDto, currentUser);
  }

  @Patch('legal-documents/:id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update legal document' })
  @ApiJsonResponse(LegalDocumentResponseDto, { description: 'Document updated' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async updateDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateLegalDocumentDto,
  ) {
    return this.policiesService.updateDocument(id, updateDto);
  }
}
