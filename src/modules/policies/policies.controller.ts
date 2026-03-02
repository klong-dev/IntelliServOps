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
  PolicyListItemDto,
  PolicyDetailDto,
  PolicyMutationResultDto,
  LegalDocumentResponseDto,
} from './dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { PolicyType, DocumentType } from '@prisma/client';

@ApiTags('Policies — Chính sách căn hộ')
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  // ─── Policies (Chính sách căn hộ) ──────────────────────────────

  @Get()
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'Danh sách chính sách căn hộ',
    description:
      'Lấy tất cả chính sách (nội quy, quy định). ' +
      'Có thể lọc theo loại và trạng thái.',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: PolicyType,
    description: 'Loại chính sách',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Trạng thái kích hoạt',
  })
  @ApiJsonResponse(PolicyListItemDto, {
    isArray: true,
    description: 'Danh sách chính sách',
  })
  async findAllPolicies(
    @Query('type') policyType?: PolicyType,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.policiesService.findAllPolicies(policyType, isActive);
  }

  @Get('active')
  @Public()
  @ApiOperation({
    summary: 'Chính sách đang hiệu lực',
    description:
      'Danh sách chính sách căn hộ đang có hiệu lực. ' +
      'Dành cho khách/cư dân xem quy định chung.',
  })
  @ApiJsonResponse(PolicyListItemDto, {
    isArray: true,
    description: 'Chính sách đang hiệu lực',
  })
  async findActivePolicies() {
    return this.policiesService.findActivePolicies();
  }

  @Get('apartment/:apartmentId')
  @Public()
  @ApiOperation({
    summary: 'Chính sách theo căn hộ',
    description:
      'Lấy tất cả chính sách áp dụng cho 1 căn hộ cụ thể. ' +
      'Dùng khi cư dân/khách xem quy định của căn hộ mình.',
  })
  @ApiResponse({
    status: 404,
    description: 'Căn hộ không tồn tại',
  })
  async findPoliciesByApartment(
    @Param('apartmentId', ParseUUIDPipe) apartmentId: string,
  ) {
    return this.policiesService.findPoliciesByApartment(apartmentId);
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Chi tiết chính sách',
    description:
      'Xem chi tiết chính sách, bao gồm danh sách căn hộ đang áp dụng.',
  })
  @ApiJsonResponse(PolicyDetailDto, {
    description: 'Chi tiết chính sách',
  })
  @ApiResponse({
    status: 404,
    description: 'Chính sách không tồn tại',
  })
  async findOnePolicy(@Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.findOnePolicy(id);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'Tạo chính sách mới',
    description:
      'Admin tạo chính sách mới (nội quy, quy định đỗ xe, thú cưng...)',
  })
  @ApiJsonResponse(PolicyMutationResultDto, {
    status: 201,
    description: 'Tạo thành công',
  })
  async createPolicy(
    @Body() createDto: CreatePolicyDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.policiesService.createPolicy(createDto, currentUser);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Cập nhật chính sách',
    description: 'Cập nhật nội dung, trạng thái, thời hạn chính sách.',
  })
  @ApiJsonResponse(PolicyMutationResultDto, {
    description: 'Cập nhật thành công',
  })
  @ApiResponse({
    status: 404,
    description: 'Chính sách không tồn tại',
  })
  async updatePolicy(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePolicyDto,
  ) {
    return this.policiesService.updatePolicy(id, updateDto);
  }

  @Patch(':id/approve')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Duyệt chính sách',
    description:
      'Admin duyệt chính sách → tự động kích hoạt. ' +
      'Không thể duyệt lại chính sách đã duyệt.',
  })
  @ApiJsonResponse(PolicyMutationResultDto, {
    description: 'Duyệt thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Chính sách đã được duyệt trước đó',
  })
  @ApiResponse({
    status: 404,
    description: 'Chính sách không tồn tại',
  })
  async approvePolicy(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.policiesService.approvePolicy(id, currentUser);
  }

  // ─── Legal Documents (Tài liệu pháp lý) ───────────────────────

  @Get('legal-documents/all')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Danh sách tài liệu pháp lý',
    description: 'Lấy tài liệu pháp lý (hợp đồng mẫu, biên bản bàn giao...)',
  })
  @ApiQuery({
    name: 'documentType',
    required: false,
    enum: DocumentType,
  })
  @ApiQuery({
    name: 'isPublic',
    required: false,
    type: Boolean,
  })
  @ApiJsonResponse(LegalDocumentResponseDto, {
    isArray: true,
    description: 'Danh sách tài liệu pháp lý',
  })
  async findAllDocuments(
    @Query('documentType') documentType?: DocumentType,
    @Query('isPublic') isPublic?: boolean,
  ) {
    return this.policiesService.findAllDocuments(documentType, isPublic);
  }

  @Get('legal-documents/public')
  @Public()
  @ApiOperation({
    summary: 'Tài liệu pháp lý công khai',
    description:
      'Tài liệu pháp lý mà khách/cư dân có thể xem (hợp đồng mẫu...)',
  })
  @ApiJsonResponse(LegalDocumentResponseDto, {
    isArray: true,
    description: 'Tài liệu pháp lý công khai',
  })
  async findPublicDocuments() {
    return this.policiesService.findPublicDocuments();
  }

  @Get('legal-documents/:id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Chi tiết tài liệu pháp lý' })
  @ApiJsonResponse(LegalDocumentResponseDto, {
    description: 'Chi tiết tài liệu pháp lý',
  })
  @ApiResponse({
    status: 404,
    description: 'Tài liệu không tồn tại',
  })
  async findOneDocument(@Param('id', ParseUUIDPipe) id: string) {
    return this.policiesService.findOneDocument(id);
  }

  @Post('legal-documents')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Upload tài liệu pháp lý',
    description: 'Admin upload hợp đồng mẫu, biên bản, tài liệu pháp lý.',
  })
  @ApiJsonResponse(LegalDocumentResponseDto, {
    status: 201,
    description: 'Tạo thành công',
  })
  async createDocument(
    @Body() createDto: CreateLegalDocumentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.policiesService.createDocument(createDto, currentUser);
  }

  @Patch('legal-documents/:id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Cập nhật tài liệu pháp lý' })
  @ApiJsonResponse(LegalDocumentResponseDto, {
    description: 'Cập nhật thành công',
  })
  @ApiResponse({
    status: 404,
    description: 'Tài liệu không tồn tại',
  })
  async updateDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateLegalDocumentDto,
  ) {
    return this.policiesService.updateDocument(id, updateDto);
  }
}
