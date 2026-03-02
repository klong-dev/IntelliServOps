import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Nested DTOs ────────────────────────────────────────────────────

class ApartmentSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'R1-801' })
  apartmentNumber: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Saigon Pearl',
    nullable: true,
  })
  buildingName: string | null;

  @ApiProperty({ example: '92 Nguyễn Hữu Cảnh' })
  address: string;
}

class PolicySummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'rental_rules' })
  policyType: string;

  @ApiProperty({ example: 'Quy định nội quy tòa nhà' })
  title: string;

  @ApiProperty({ example: '1.0' })
  version: string;

  @ApiProperty()
  isActive: boolean;
}

// ─── ApartmentPolicy List Item DTO ──────────────────────────────────

export class ApartmentPolicyListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  apartmentId: string;

  @ApiProperty()
  policyId: string;

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty()
  effectiveDate: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  expiryDate: Date | null;

  @ApiProperty()
  createdAt: Date;
}

// ─── ApartmentPolicy Detail DTO ─────────────────────────────────────

export class ApartmentPolicyDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  apartmentId: string;

  @ApiProperty()
  policyId: string;

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty()
  effectiveDate: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  expiryDate: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty({ type: ApartmentSummaryDto })
  apartment: ApartmentSummaryDto;

  @ApiProperty({ type: PolicySummaryDto })
  policy: PolicySummaryDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── ApartmentPolicy Mutation Result DTO ────────────────────────────

export class ApartmentPolicyMutationResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  apartmentId: string;

  @ApiProperty()
  policyId: string;

  @ApiProperty()
  isRequired: boolean;

  @ApiProperty()
  effectiveDate: Date;

  @ApiProperty()
  createdAt: Date;
}
