import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PolicyType } from '@prisma/client';

export class CreatePolicyDto {
  @ApiProperty({
    enum: PolicyType,
    example: 'building_regulations',
    description: 'Loại chính sách căn hộ',
  })
  @IsEnum(PolicyType)
  policyType: PolicyType;

  @ApiProperty({
    example: 'Nội quy tòa nhà Saigon Pearl',
    description: 'Tiêu đề chính sách',
  })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    example:
      'Cư dân phải tuân thủ giờ giấc sinh hoạt, không gây tiếng ồn sau 22h...',
    description: 'Nội dung chi tiết chính sách',
  })
  @IsString()
  content: string;

  @ApiProperty({
    example: '1.0',
    description: 'Phiên bản chính sách',
  })
  @IsString()
  @MaxLength(50)
  version: string;

  @ApiPropertyOptional({
    example: 'vi',
    default: 'vi',
    description: 'Ngôn ngữ',
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({
    example: '2026-03-01',
    description: 'Ngày hiệu lực',
  })
  @IsDateString()
  effectiveDate: string;

  @ApiPropertyOptional({
    example: '2027-03-01',
    description: 'Ngày hết hạn',
  })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Cư dân có cần xác nhận đã đọc và đồng ý chính sách này không',
  })
  @IsBoolean()
  @IsOptional()
  requiresAcceptance?: boolean;

  @ApiPropertyOptional({
    example: 0,
    description: 'Thứ tự hiển thị',
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  displayOrder?: number;
}
