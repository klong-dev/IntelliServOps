import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';

export class CreateLegalDocumentDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({ example: 'Mẫu hợp đồng thuê nhà' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'Hợp đồng mẫu cho căn hộ chung cư' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    example: 'https://storage.example.com/docs/contract-template.pdf',
  })
  @IsString()
  fileUrl: string;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @IsString()
  @IsOptional()
  fileType?: string;

  @ApiPropertyOptional({ example: 1048576, description: 'File size in bytes' })
  @IsOptional()
  fileSizeBytes?: bigint;

  @ApiPropertyOptional({ example: 'contracts' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ example: 'vi', default: 'vi' })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({ example: '1.0' })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isTemplate?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  requiresSignature?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({ example: ['contract', 'template'], type: [String] })
  @IsArray()
  @IsOptional()
  tags?: any;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsDateString()
  @IsOptional()
  effectiveDate?: string;
}
