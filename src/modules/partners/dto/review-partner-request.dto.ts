import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartnerRequestStatus } from '@prisma/client';

export class ReviewPartnerRequestDto {
  @ApiProperty({
    enum: [PartnerRequestStatus.approved, PartnerRequestStatus.rejected],
    description: 'Approve or reject the request',
  })
  @IsEnum(PartnerRequestStatus)
  status: PartnerRequestStatus;

  @ApiPropertyOptional({ example: 'Đã xác minh thông tin bất động sản' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  reviewNotes?: string;

  @ApiPropertyOptional({ example: 'Thiếu giấy tờ sở hữu' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  rejectionReason?: string;
}
