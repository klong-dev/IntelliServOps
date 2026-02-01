import { PartialType } from '@nestjs/swagger';
import { CreateApartmentDto } from './create-apartment.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
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
