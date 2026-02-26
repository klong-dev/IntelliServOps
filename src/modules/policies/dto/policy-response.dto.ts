import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Policy Response DTO ────────────────────────────────────────────

export class PolicyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'terms_of_service' })
  policyType: string;

  @ApiProperty({ example: 'Điều khoản sử dụng' })
  title: string;

  @ApiProperty({ example: 'Nội dung điều khoản...' })
  content: string;

  @ApiProperty({ example: '1.0' })
  version: string;

  @ApiProperty({ example: 'vi' })
  language: string;

  @ApiProperty()
  effectiveDate: Date;

  @ApiPropertyOptional({ nullable: true })
  expiryDate: Date | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  requiresAcceptance: boolean;

  @ApiProperty({ example: 0 })
  displayOrder: number;

  @ApiPropertyOptional({ nullable: true })
  createdByAdminId: string | null;

  @ApiPropertyOptional({ nullable: true })
  approvedByAdminId: string | null;

  @ApiPropertyOptional({ nullable: true })
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

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ example: 'https://storage.example.com/docs/template.pdf' })
  fileUrl: string;

  @ApiPropertyOptional({ nullable: true })
  fileType: string | null;

  @ApiPropertyOptional({ nullable: true })
  fileSizeBytes: string | null;

  @ApiPropertyOptional({ nullable: true })
  category: string | null;

  @ApiProperty({ example: 'vi' })
  language: string;

  @ApiPropertyOptional({ nullable: true })
  version: string | null;

  @ApiProperty()
  isTemplate: boolean;

  @ApiProperty()
  requiresSignature: boolean;

  @ApiProperty()
  isPublic: boolean;

  @ApiPropertyOptional({ nullable: true })
  tags: any;

  @ApiPropertyOptional({ nullable: true })
  effectiveDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  createdByAdminId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
