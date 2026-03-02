import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Nested DTOs ────────────────────────────────────────────────────

class AdminSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn An' })
  fullName: string;
}

class ApartmentPolicySummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  apartmentId: string;

  @ApiProperty({ example: true })
  isRequired: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  effectiveDate: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  expiryDate: Date | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description: 'Thông tin căn hộ',
  })
  apartment: {
    id: string;
    apartmentNumber: string;
    buildingName: string | null;
  } | null;
}

// ─── Policy Response DTOs ───────────────────────────────────────────

export class PolicyListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'building_regulations' })
  policyType: string;

  @ApiProperty({ example: 'Nội quy tòa nhà Saigon Pearl' })
  title: string;

  @ApiProperty({ example: '1.0' })
  version: string;

  @ApiProperty({ example: 'vi' })
  language: string;

  @ApiProperty()
  effectiveDate: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  expiryDate: Date | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  requiresAcceptance: boolean;

  @ApiProperty({ example: 0 })
  displayOrder: number;

  @ApiProperty({
    example: { apartmentPolicies: 2 },
    description: 'Số căn hộ áp dụng',
  })
  _count: { apartmentPolicies: number };

  @ApiProperty()
  createdAt: Date;
}

export class PolicyDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'building_regulations' })
  policyType: string;

  @ApiProperty({ example: 'Nội quy tòa nhà Saigon Pearl' })
  title: string;

  @ApiProperty({
    example: 'Cư dân phải tuân thủ giờ giấc sinh hoạt...',
  })
  content: string;

  @ApiProperty({ example: '1.0' })
  version: string;

  @ApiProperty({ example: 'vi' })
  language: string;

  @ApiProperty()
  effectiveDate: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  expiryDate: Date | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  requiresAcceptance: boolean;

  @ApiProperty({ example: 0 })
  displayOrder: number;

  @ApiPropertyOptional({
    type: AdminSummaryDto,
    nullable: true,
  })
  createdByAdmin: AdminSummaryDto | null;

  @ApiPropertyOptional({
    type: AdminSummaryDto,
    nullable: true,
  })
  approvedByAdmin: AdminSummaryDto | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  approvedAt: Date | null;

  @ApiProperty({
    type: [ApartmentPolicySummaryDto],
    description: 'Danh sách căn hộ áp dụng chính sách này',
  })
  apartmentPolicies: ApartmentPolicySummaryDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PolicyMutationResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'building_regulations' })
  policyType: string;

  @ApiProperty({ example: 'Nội quy tòa nhà' })
  title: string;

  @ApiProperty({ example: '1.0' })
  version: string;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  approvedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── Legal Document Response DTO ────────────────────────────────────

export class LegalDocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'contract_template' })
  documentType: string;

  @ApiProperty({ example: 'Mẫu hợp đồng thuê nhà' })
  title: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({
    example: 'https://storage.example.com/docs/template.pdf',
  })
  fileUrl: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  fileType: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  fileSizeBytes: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  category: string | null;

  @ApiProperty({ example: 'vi' })
  language: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  version: string | null;

  @ApiProperty()
  isTemplate: boolean;

  @ApiProperty()
  requiresSignature: boolean;

  @ApiProperty()
  isPublic: boolean;

  @ApiPropertyOptional({ type: Object, nullable: true })
  tags: any;

  @ApiPropertyOptional({ type: Date, nullable: true })
  effectiveDate: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  createdByAdminId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
