import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateApartmentDto } from './create-apartment.dto';
import { Allow, IsEnum, IsOptional } from 'class-validator';
import { ApartmentStatus } from '@prisma/client';

export class UpdateApartmentDto extends PartialType(CreateApartmentDto) {
  @ApiPropertyOptional({
    enum: ApartmentStatus,
    description: 'Apartment status',
  })
  @IsEnum(ApartmentStatus)
  @IsOptional()
  status?: ApartmentStatus;
}

export class UpdateApartmentRequestDto extends OmitType(UpdateApartmentDto, [
  'images',
  'videoTourUrl',
] as const) {
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Apartment images (JPEG, PNG, WebP), max 10 files',
  })
  @Allow()
  images?: any[];

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Apartment video (MP4, MOV, WEBM), max 1 file',
  })
  @Allow()
  video?: any;
}
