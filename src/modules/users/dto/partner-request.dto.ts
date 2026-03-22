import { PartialType } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PartnerRequestStatus, PropertyType } from '@prisma/client';

const PROPERTY_TYPE_VALUES = ['apartment', 'house', 'condo', 'studio'] as const;
const PARTNER_REVIEW_STATUS_VALUES = [
  'approved',
  'rejected',
  'on_hold',
  'under_review',
] as const;
const PARTNER_STATUS_VALUES = [
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'on_hold',
] as const;

export class CreatePartnerRequestDto {
  @ApiPropertyOptional({
    enum: PROPERTY_TYPE_VALUES,
    example: 'apartment',
    description: 'Property type',
  })
  @IsOptional()
  @IsIn(PROPERTY_TYPE_VALUES)
  propertyType?: PropertyType;

  @ApiProperty({ example: '123 Nguyen Trai' })
  @IsString()
  @MaxLength(500)
  address: string;

  @ApiProperty({ example: 'Ho Chi Minh' })
  @IsString()
  @MaxLength(120)
  city: string;

  @ApiProperty({ example: 'District 1' })
  @IsString()
  @MaxLength(120)
  district: string;

  @ApiPropertyOptional({ example: 75.5, description: 'Total area in m2' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalArea?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  numberOfUnits?: number;

  @ApiPropertyOptional({
    example: 15000000,
    description: 'Expected rent in VND',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedRentPrice?: number;

  @ApiPropertyOptional({ example: 'Near metro, has balcony' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['parking', 'elevator', 'security'],
  })
  @IsOptional()
  @IsArray()
  amenities?: string[];
}

export class UpdatePartnerRequestDto extends PartialType(
  CreatePartnerRequestDto,
) {}

export class ReviewPartnerRequestDto {
  @ApiProperty({
    enum: PARTNER_REVIEW_STATUS_VALUES,
    example: 'approved',
  })
  @IsIn(PARTNER_REVIEW_STATUS_VALUES)
  status: Extract<
    PartnerRequestStatus,
    'approved' | 'rejected' | 'on_hold' | 'under_review'
  >;

  @ApiPropertyOptional({ example: 'Documents checked and valid' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNotes?: string;

  @ApiPropertyOptional({ example: 'Missing ownership proof' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;
}

class PartnerRequestUserSummaryDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiPropertyOptional({ example: 'ABC Investment Co., Ltd', nullable: true })
  companyName: string | null;
}

class PartnerRequestReviewerSummaryDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891' })
  id: string;

  @ApiProperty({ example: 'Operator One' })
  fullName: string;
}

export class PartnerRequestListItemDto {
  @ApiProperty({ example: 'd88c6858-ec67-4a37-9541-8e9bcf0f9328' })
  id: string;

  @ApiProperty({ enum: PROPERTY_TYPE_VALUES, example: 'apartment' })
  propertyType: PropertyType;

  @ApiProperty({ example: '123 Nguyen Trai' })
  address: string;

  @ApiProperty({ example: 'Ho Chi Minh' })
  city: string;

  @ApiProperty({ example: 'District 1' })
  district: string;

  @ApiProperty({ enum: PARTNER_STATUS_VALUES, example: 'submitted' })
  status: PartnerRequestStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ type: PartnerRequestUserSummaryDto, nullable: true })
  user?: PartnerRequestUserSummaryDto;

  @ApiPropertyOptional({
    example: 'Need additional legal papers',
    nullable: true,
  })
  reviewNotes?: string | null;

  @ApiPropertyOptional({ example: 'Invalid contact info', nullable: true })
  rejectionReason?: string | null;
}

export class PartnerRequestDetailDto {
  @ApiProperty({ example: 'd88c6858-ec67-4a37-9541-8e9bcf0f9328' })
  id: string;

  @ApiProperty({ enum: PROPERTY_TYPE_VALUES, example: 'apartment' })
  propertyType: PropertyType;

  @ApiProperty({ example: '123 Nguyen Trai' })
  address: string;

  @ApiProperty({ example: 'Ho Chi Minh' })
  city: string;

  @ApiProperty({ example: 'District 1' })
  district: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '75.50' })
  totalArea: string | null;

  @ApiProperty({ example: 1 })
  numberOfUnits: number;

  @ApiPropertyOptional({ type: String, nullable: true, example: '15000000.00' })
  expectedRentPrice: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Near metro' })
  description: string | null;

  @ApiPropertyOptional({
    type: [String],
    nullable: true,
    example: ['parking', 'elevator'],
  })
  amenities: string[] | null;

  @ApiProperty({ enum: PARTNER_STATUS_VALUES, example: 'submitted' })
  status: PartnerRequestStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  reviewNotes: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  rejectionReason: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  approvedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: PartnerRequestUserSummaryDto })
  user: PartnerRequestUserSummaryDto;

  @ApiPropertyOptional({
    type: PartnerRequestReviewerSummaryDto,
    nullable: true,
  })
  reviewedByOperator: PartnerRequestReviewerSummaryDto | null;
}

export class PartnerRequestMutationResultDto {
  @ApiProperty({ example: 'd88c6858-ec67-4a37-9541-8e9bcf0f9328' })
  id: string;

  @ApiProperty({ enum: PROPERTY_TYPE_VALUES, example: 'apartment' })
  propertyType: PropertyType;

  @ApiProperty({ example: '123 Nguyen Trai' })
  address: string;

  @ApiProperty({ enum: PARTNER_STATUS_VALUES, example: 'submitted' })
  status: PartnerRequestStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  reviewNotes?: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  createdAt?: Date;

  @ApiPropertyOptional({ type: Date, nullable: true })
  updatedAt?: Date;
}
